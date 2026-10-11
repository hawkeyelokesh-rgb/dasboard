import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { parseCsv, parseSheetDate } from "@/lib/csv";

export const maxDuration = 60;

const COLS: Record<string, string> = {
  "name": "name", "email": "email", "whatsapp": "whatsapp", "location": "location",
  "describes best": "describes_best", "previously done": "previously_done", "investment": "investment",
  "goal": "goal", "income target": "income_target", "weekly time": "weekly_time",
  "challenges": "challenges", "roadmap": "roadmap", "commitment": "commitment",
  "submitted at": "submitted_at", "host name": "host_name", "host email": "host_email",
  "event type": "event_name", "call date & time": "call_start",
};

/** multipart/form-data: file (CSV exported from the Zappier sheet), callTz = "IST" | "UTC" for Call Date & Time without an offset. */
export async function POST(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const callTz = form.get("callTz") === "UTC" ? "UTC" : "IST";
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a CSV file." }, { status: 400 });

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });
  const header = rows[0].map((h) => COLS[h.trim().toLowerCase()] ?? null);
  if (!header.includes("email")) return NextResponse.json({ error: "No 'Email' column found. Use the first row of the sheet as headers." }, { status: 400 });

  const db = adminClient();
  let inserted = 0, skipped = 0, bad = 0;
  const batch: any[] = [];
  const seen = new Set<string>();

  for (const r of rows.slice(1)) {
    const rec: any = {};
    header.forEach((k, i) => { if (k) rec[k] = (r[i] ?? "").trim(); });
    if (!rec.email) { bad++; continue; }
    rec.email = rec.email.toLowerCase();
    rec.submitted_at = parseSheetDate(rec.submitted_at, "UTC");
    rec.call_start = parseSheetDate(rec.call_start, callTz);
    if (rec.host_email) rec.host_email = rec.host_email.toLowerCase();
    if (!rec.submitted_at) rec.submitted_at = new Date().toISOString();
    if (rec.call_start) {
      rec.call_end = new Date(Date.parse(rec.call_start) + 3600000).toISOString();
      rec.status = "booked";
    } else rec.status = "submitted";
    for (const k of Object.keys(rec)) if (rec[k] === "") rec[k] = null;
    const key = `${rec.email}|${rec.submitted_at}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    batch.push(rec);
  }

  // Skip rows already in the database (same email + same submitted time).
  const emails = Array.from(new Set(batch.map((b) => b.email)));
  const existing = new Set<string>();
  for (let i = 0; i < emails.length; i += 100) {
    const { data } = await db.from("leads").select("email,submitted_at").in("email", emails.slice(i, i + 100));
    for (const d of data ?? []) existing.add(`${d.email}|${new Date(d.submitted_at).toISOString()}`);
  }
  const fresh = batch.filter((b) => {
    if (existing.has(`${b.email}|${b.submitted_at}`)) { skipped++; return false; }
    return true;
  });
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await db.from("leads").insert(fresh.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message, inserted }, { status: 500 });
    inserted += Math.min(200, fresh.length - i);
  }
  return NextResponse.json({ ok: true, inserted, skipped, bad });
}
