import Link from "next/link";
import { serverClient } from "@/lib/supabase/server";
import { applyLeadFilters } from "@/lib/leadsQuery";
import LeadDetails, { Lead, StatusBadge } from "@/components/LeadDetails";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE = 25;

export default async function Leads({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const sp = searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = serverClient();
  const f = { q: sp.q, host: sp.host, status: sp.status, event: sp.event, submittedFrom: sp.from, submittedTo: sp.to, callDate: sp.call };
  const { data, count } = await applyLeadFilters(
    db.from("leads").select("*", { count: "exact" }).order("submitted_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1), f);
  const { data: hosts } = await db.from("hosts").select("name,display_name,email").order("name");
  const leads = (data ?? []) as Lead[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const params = (over: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) u.set(k, v);
    return u.toString();
  };
  const csvQs = params({ page: "" });

  return (
    <div className="space-y-4">
      <form className="card grid sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="Search name / email / phone" className="field" />
        <select name="host" defaultValue={sp.host ?? ""} className="field">
          <option value="">All hosts</option>{(hosts ?? []).map((h: any) => <option key={h.email} value={h.email}>{h.display_name || h.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="field">
          <option value="">Any status</option><option value="submitted">Not booked</option><option value="booked">Booked</option><option value="canceled">Canceled</option>
        </select>
        <input name="event" defaultValue={sp.event} placeholder="Event name" className="field" />
        <label className="flex items-center gap-1">Submitted from <input type="date" name="from" defaultValue={sp.from} className="field" /></label>
        <label className="flex items-center gap-1">to <input type="date" name="to" defaultValue={sp.to} className="field" /></label>
        <label className="flex items-center gap-1">Call date <input type="date" name="call" defaultValue={sp.call} className="field" /></label>
        <div className="flex items-center gap-3">
          <button className="btn-primary">Filter</button>
          <Link href="/admin/leads" className="link">Clear</Link>
          <a href={`/api/admin/leads-csv?${csvQs}`} className="link">CSV</a>
        </div>
      </form>
      <p className="text-sm text-ink-400">{count ?? 0} results</p>
      <div className="space-y-2">
        {leads.map((l) => (
          <details key={l.id} className="card">
            <summary className="cursor-pointer flex flex-wrap gap-3 items-center">
              <b>{l.name ?? l.email}</b><StatusBadge s={l.status} />
              <span className="text-ink-400">{l.event_name ?? "no event"}</span>
              <span>{l.host_name ?? "no host"}</span>
              <span className="text-ink-400">{l.call_start ? fmtDateTime(l.call_start) : `form: ${fmtDateTime(l.submitted_at)}`}</span>
            </summary>
            <div className="mt-3"><LeadDetails l={l} /></div>
          </details>
        ))}
        {leads.length === 0 && <p className="text-sm text-ink-400">No leads match.</p>}
      </div>
      <div className="flex gap-4 text-sm items-center">
        {page > 1 && <Link className="link" href={`/admin/leads?${params({ page: String(page - 1) })}`}>Previous</Link>}
        <span className="text-ink-700">Page {page} of {pages}</span>
        {page < pages && <Link className="link" href={`/admin/leads?${params({ page: String(page + 1) })}`}>Next</Link>}
      </div>
    </div>
  );
}
