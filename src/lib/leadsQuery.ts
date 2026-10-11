import { istDayBounds } from "./format";

export type LeadFilters = {
  q?: string; host?: string; status?: string; event?: string;
  submittedFrom?: string; submittedTo?: string; callDate?: string;
};

/** Applies the dashboard filters to a Supabase `leads` select query. */
export function applyLeadFilters<T extends { [k: string]: any }>(query: T, f: LeadFilters): T {
  let q: any = query;
  if (f.status) q = q.eq("status", f.status);
  if (f.host) q = q.eq("host_email", f.host.toLowerCase());
  if (f.event) q = q.ilike("event_name", `%${f.event.replace(/[%_]/g, "")}%`);
  if (f.q) {
    const s = f.q.replace(/[%,()_]/g, " ").trim();
    if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,whatsapp.ilike.%${s}%`);
  }
  if (f.submittedFrom) q = q.gte("submitted_at", istDayBounds(f.submittedFrom).start);
  if (f.submittedTo) q = q.lt("submitted_at", istDayBounds(f.submittedTo).end);
  if (f.callDate) {
    const b = istDayBounds(f.callDate);
    q = q.gte("call_start", b.start).lt("call_start", b.end);
  }
  return q;
}
