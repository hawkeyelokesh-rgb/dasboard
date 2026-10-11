// One-time (re-runnable) backfill: pulls every routing form submission from Calendly
// for the forms named below, resolves booking/host/call details where the submission
// led to a scheduled event, and upserts into Supabase `leads` (keyed on submission_uri,
// so safe to run more than once). Going forward, new submissions/bookings arrive via
// the Calendly webhook (Team page > "Register webhooks") -- this script is only for
// history that predates the webhook.
//
// Usage: node scripts/backfill-calendly.mjs [--limit N] [--form "Form Name"]
//   --limit N     stop after N submissions per form (for a quick test run)
//   --form NAME   only backfill the form with this exact name (case-insensitive)
//
// Reads CALENDLY_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY from .env.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    let text;
    try { text = readFileSync(path.join(ROOT, file), "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}

const env = loadEnv();
const CALENDLY_TOKEN = env.CALENDLY_TOKEN;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

for (const [k, v] of Object.entries({ CALENDLY_TOKEN, SUPABASE_URL, SERVICE_KEY })) {
  if (!v || v.startsWith("your-") || v.startsWith("https://your-")) {
    console.error(`Missing/placeholder ${k} in .env -- fill it in first.`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
const formIdx = args.indexOf("--form");
const ONLY_FORM = formIdx >= 0 ? args[formIdx + 1].toLowerCase() : null;

// "Altira Qualified Form" is a 2-question pre-screen that routes externally and never
// collects name/email -- there's nothing in it to turn into a contactable lead, so it's
// excluded here. Pass --form "Altira Qualified Form" explicitly if you ever need it anyway.
const FORM_NAMES = ["Organic Route With Robin"];

// ---------- rate-limited Calendly fetch (conservative: ~5 req/sec, retry on 429) ----------
let lastCall = 0;
async function calendlyFetch(url) {
  for (;;) {
    const now = Date.now();
    const wait = Math.max(0, lastCall + 200 - now); // >=200ms between calls
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${CALENDLY_TOKEN}` } });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      console.log(`  rate limited, waiting ${retryAfter}s...`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Calendly ${res.status} ${url}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }
}

// ---------- answer-column mapping (same rules as src/lib/answers.ts) ----------
const RULES = [
  ["email", /^\s*e-?mail/i],
  ["name", /^\s*(full\s+)?name\s*\??\s*$/i],
  ["whatsapp", /whats\s?app|phone|mobile/i],
  ["location", /currently located|where are you/i],
  ["describes_best", /describes?\s+you\s+best/i],
  ["previously_done", /previously done|export or import\?/i],
  ["investment", /investment capacity|approximate investment/i],
  ["goal", /primary goal/i],
  ["income_target", /monthly income|income target/i],
  ["weekly_time", /dedicate weekly|time can you dedicate/i],
  ["challenges", /challenges/i],
  ["roadmap", /clear roadmap|willing to take action/i],
  ["commitment", /call will take place|show up for the call/i],
];
function flat(a) {
  if (a == null) return null;
  const s = Array.isArray(a) ? a.join(", ") : String(a);
  const t = s.replace(/\s*\n\s*/g, ", ").trim();
  return t === "" ? null : t;
}
function mapAnswers(qa) {
  const out = { name: null, email: null, whatsapp: null, location: null, describes_best: null, previously_done: null, investment: null, goal: null, income_target: null, weekly_time: null, challenges: null, roadmap: null, commitment: null };
  for (const item of qa ?? []) {
    const q = item.question ?? "";
    const rule = RULES.find(([key, re]) => out[key] === null && re.test(q));
    if (rule) out[rule[0]] = flat(item.answer);
  }
  return out;
}

// ---------- Supabase upsert (bulk per page) ----------
async function upsertLeads(rows) {
  if (rows.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?on_conflict=submission_uri`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase upsert ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

// Calendly's routing_form_submissions don't link to the resulting booking (submitter/
// submitter_type are always null on this account) -- so instead, for each submission's
// email we look up that person's scheduled events directly and pick the one created
// closest in time to the submission. `claimedEvents` stops two different submissions
// from the same email grabbing the same booking.
const claimedEvents = new Set();

async function resolveBooking(org, email, submittedAtMs) {
  if (!email) return null;
  const qs = new URLSearchParams({ organization: org, invitee_email: email, count: "25" });
  const page = await calendlyFetch(`https://api.calendly.com/scheduled_events?${qs}`);
  let best = null, bestDiff = Infinity;
  for (const se of page.collection) {
    if (claimedEvents.has(se.uri)) continue;
    const diff = Math.abs(new Date(se.created_at).getTime() - submittedAtMs);
    if (diff < bestDiff) { best = se; bestDiff = diff; }
  }
  if (!best) return null;
  claimedEvents.add(best.uri);
  const host = best.event_memberships?.[0];
  return {
    event_uri: best.uri,
    event_name: best.name ?? null,
    host_name: host?.user_name ?? null,
    host_email: host?.user_email ? String(host.user_email).toLowerCase() : null,
    call_start: best.start_time ?? null,
    call_end: best.end_time ?? null,
    meeting_url: best.location?.join_url ?? null,
    status: best.status === "canceled" ? "canceled" : "booked",
  };
}

async function backfillForm(org, formUri, formName) {
  console.log(`\n=== ${formName} ===`);
  let pageToken;
  let processed = 0, booked = 0, canceled = 0, submittedOnly = 0, errors = 0;
  do {
    const qs = new URLSearchParams({ form: formUri, count: "100" });
    if (pageToken) qs.set("page_token", pageToken);
    const page = await calendlyFetch(`https://api.calendly.com/routing_form_submissions?${qs}`);
    const rows = [];
    for (const sub of page.collection) {
      if (processed >= LIMIT) break;
      const qa = sub.questions_and_answers ?? [];
      const m = mapAnswers(qa);
      const row = {
        submission_uri: sub.uri,
        submitted_at: sub.created_at,
        ...m,
        email: m.email ? m.email.toLowerCase() : null,
        answers: qa,
        routed_to: sub.result?.value ?? null,
        status: "submitted",
        // Bulk upsert requires every row to have the same keys; these fill in once a
        // booking is found below, otherwise stay null.
        event_uri: null, event_name: null, host_name: null, host_email: null,
        call_start: null, call_end: null, meeting_url: null,
      };
      try {
        const booking = await resolveBooking(org, row.email, new Date(sub.created_at).getTime());
        if (booking) Object.assign(row, booking);
      } catch (e) {
        errors++;
        console.log(`  booking lookup failed for ${sub.uri}: ${e.message.slice(0, 150)}`);
      }
      if (row.status === "booked") booked++;
      else if (row.status === "canceled") canceled++;
      else submittedOnly++;
      rows.push(row);
      processed++;
    }
    await upsertLeads(rows);
    console.log(`  ${processed} processed (booked=${booked} canceled=${canceled} submitted=${submittedOnly} errors=${errors})`);
    pageToken = page.pagination?.next_page_token ?? undefined;
  } while (pageToken && processed < LIMIT);
  console.log(`${formName}: done. ${processed} total.`);
}

async function main() {
  const me = (await calendlyFetch("https://api.calendly.com/users/me")).resource;
  console.log(`Calendly account: ${me.email}`);

  let forms = [];
  let pageToken;
  do {
    const qs = new URLSearchParams({ organization: me.current_organization, count: "100" });
    if (pageToken) qs.set("page_token", pageToken);
    const page = await calendlyFetch(`https://api.calendly.com/routing_forms?${qs}`);
    forms.push(...page.collection);
    pageToken = page.pagination?.next_page_token ?? undefined;
  } while (pageToken);

  const wanted = ONLY_FORM ? [ONLY_FORM] : FORM_NAMES.map((n) => n.toLowerCase());
  const matched = forms.filter((f) => wanted.includes(f.name.toLowerCase()));
  if (matched.length === 0) {
    console.error(`No routing forms matched. Available forms: ${forms.map((f) => f.name).join(", ")}`);
    process.exit(1);
  }
  for (const f of matched) await backfillForm(me.current_organization, f.uri, f.name);
  console.log("\nAll done.");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
