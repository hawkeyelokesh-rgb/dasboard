import crypto from "crypto";

const API = "https://api.calendly.com";

function token(): string {
  const t = process.env.CALENDLY_TOKEN;
  if (!t) throw new Error("CALENDLY_TOKEN is not set");
  return t;
}

export async function calendly<T = any>(
  path: string,
  opts: { params?: Record<string, string | number | undefined>; method?: string; body?: unknown } = {}
): Promise<T> {
  const qs = opts.params
    ? "?" + Object.entries(opts.params).filter(([, v]) => v !== undefined).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  const res = await fetch(API + path + qs, {
    method: opts.method ?? "GET",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Calendly ${res.status} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : ({} as T);
}

/** Same as `calendly()` but takes a full URL (the `event_uri`/`invitee_uri` values we store are already full Calendly API URLs). */
async function calendlyUrl<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Calendly ${res.status} ${url}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : ({} as T);
}

/** The active invitee on a scheduled event -- has `cancel_url`, `reschedule_url`, and `uri` (used to cancel via API). */
export async function getActiveInvitee(eventUri: string) {
  const res = await calendlyUrl<{ collection: any[] }>(`${eventUri}/invitees?status=active&count=1`);
  return res.collection[0] ?? null;
}

/** Cancels a booking via Calendly's API (not just our own status field). Cancellation is an event-level action. */
export async function cancelEvent(eventUri: string, reason: string) {
  await calendlyUrl(`${eventUri}/cancellation`, { method: "POST", body: { reason } });
}

export async function getMe() {
  return (await calendly<{ resource: { uri: string; name: string; email: string; current_organization: string } }>("/users/me")).resource;
}

export async function listOrgMembers(org: string) {
  const rows: { name: string; email: string; uri: string }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendly<any>("/organization_memberships", { params: { organization: org, count: 100, page_token: pageToken } });
    for (const m of res.collection) rows.push({ name: m.user.name, email: m.user.email, uri: m.user.uri });
    pageToken = res.pagination?.next_page_token ?? undefined;
  } while (pageToken);
  return rows;
}

export const WEBHOOK_EVENTS = ["routing_form_submission.created", "invitee.created", "invitee.canceled"];

export async function registerWebhook(appUrl: string, signingKey: string) {
  const me = await getMe();
  const target = `${appUrl.replace(/\/$/, "")}/api/webhooks/calendly`;
  const existing = await calendly<any>("/webhook_subscriptions", {
    params: { organization: me.current_organization, scope: "organization" },
  });
  const same = existing.collection.find((w: any) => w.callback_url === target);
  if (same) {
    await calendly(`/webhook_subscriptions/${same.uri.split("/").pop()}`, { method: "DELETE" });
  }
  const created = await calendly<any>("/webhook_subscriptions", {
    method: "POST",
    body: { url: target, events: WEBHOOK_EVENTS, organization: me.current_organization, scope: "organization", signing_key: signingKey },
  });
  return { callback_url: target, events: WEBHOOK_EVENTS, replacedExisting: !!same, state: created.resource?.state };
}

/** Verifies the `Calendly-Webhook-Signature` header: "t=<unix>,v1=<hex hmac of `${t}.${body}`>". */
export function verifySignature(rawBody: string, header: string | null, signingKey: string, nowMs = Date.now(), toleranceMs = 5 * 60 * 1000): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = parts["t"], v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(nowMs - Number(t) * 1000) > toleranceMs) return false;
  const expected = crypto.createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex"), b = Buffer.from(v1, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
