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
  const f = { q: sp.q, host: sp.host, status: sp.status, event: sp.event, investment: sp.investment, submittedFrom: sp.from, submittedTo: sp.to, callDate: sp.call };
  const { data, count } = await applyLeadFilters(
    db.from("leads").select("*", { count: "exact" }).order("submitted_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1), f);
  const { data: hosts } = await db.from("hosts").select("name,display_name,email").order("name");
  const { data: investmentRows } = await db.from("leads").select("investment").not("investment", "is", null);
  const INVESTMENT_ORDER = ["30,000 - 50,000", "50,000 - 75,000", "75,000 - 1 L", "1 L- 3 L", "3 L - 5 L", "5 lakh above"];
  const investments = [...new Set((investmentRows ?? []).map((r: any) => r.investment as string))]
    .sort((a, b) => { const ia = INVESTMENT_ORDER.indexOf(a), ib = INVESTMENT_ORDER.indexOf(b); return ia === -1 || ib === -1 ? a.localeCompare(b) : ia - ib; });
  const leads = (data ?? []) as Lead[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const params = (over: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) u.set(k, v);
    return u.toString();
  };
  const csvQs = params({ page: "" });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Leads</h1>
      <form className="card grid sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
        <input name="q" defaultValue={sp.q} placeholder="Search name / email / phone" className="field" />
        <select name="host" defaultValue={sp.host ?? ""} className="field">
          <option value="">All hosts</option>{(hosts ?? []).map((h: any) => <option key={h.email} value={h.email}>{h.display_name || h.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="field">
          <option value="">Any status</option><option value="submitted">Not booked</option><option value="booked">Booked</option><option value="canceled">Canceled</option>
        </select>
        <select name="investment" defaultValue={sp.investment ?? ""} className="field">
          <option value="">Any investment capacity</option>{investments.map((v) => <option key={v} value={v}>{v}</option>)}
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
      <p className="text-sm text-ink-400 font-medium">{count ?? 0} results</p>
      <div className="space-y-3">
        {leads.map((l) => (
          <details key={l.id} className="card">
            <summary className="cursor-pointer flex flex-wrap gap-3 items-center text-base">
              <b className="text-ink-900">{l.name ?? l.email}</b><StatusBadge s={l.status} />
              <span className="text-ink-400">{l.event_name ?? "no event"}</span>
              <span>{l.host_name ?? "no host"}</span>
              <span className="text-ink-400">{l.call_start ? fmtDateTime(l.call_start) : `form: ${fmtDateTime(l.submitted_at)}`}</span>
            </summary>
            <div className="mt-4 pt-4 border-t border-ink-100"><LeadDetails l={l} /></div>
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
