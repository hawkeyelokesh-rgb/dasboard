import crypto from "crypto";
import type { Busy, Schedule } from "./availability";

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

export async function getDefaultSchedule(userUri: string): Promise<Schedule | null> {
  const res = await calendly<{ collection: (Schedule & { default: boolean })[] }>("/user_availability_schedules", { params: { user: userUri } });
  return res.collection.find((s) => s.default) ?? res.collection[0] ?? null;
}

export async function getBusy(userUri: string, startMs: number, endMs: number): Promise<Busy[]> {
  const res = await calendly<any>("/user_busy_times", {
    params: { user: userUri, start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString() },
  });
  return res.collection.map((b: any) => ({
    start: new Date(b.buffered_start_time ?? b.start_time).getTime(),
    end: new Date(b.buffered_end_time ?? b.end_time).getTime(),
  }));
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
