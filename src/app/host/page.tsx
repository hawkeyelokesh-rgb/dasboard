import { requireRole } from "@/lib/auth";
import { serverClient } from "@/lib/supabase/server";
import SignOut from "@/components/SignOut";
import LeadDetails, { Lead, StatusBadge } from "@/components/LeadDetails";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  const p = await requireRole("host");
  // RLS limits this to leads where host_email = this user's email.
  const { data } = await serverClient().from("leads").select("*").not("call_start", "is", null).order("call_start", { ascending: true }).limit(500);
  const all = (data ?? []) as Lead[];
  const now = Date.now();
  const upcoming = all.filter((l) => l.status === "booked" && Date.parse(l.call_start!) >= now - 3600000);
  const past = all.filter((l) => !upcoming.includes(l)).reverse();

  const Card = (l: Lead) => (
    <details key={l.id} className="bg-white rounded-lg shadow-sm p-3">
      <summary className="cursor-pointer flex flex-wrap gap-3 items-center">
        <b>{fmtDateTime(l.call_start)}</b><span>{l.name}</span><span className="text-slate-500">{l.event_name}</span><StatusBadge s={l.status} />
      </summary>
      <div className="mt-3"><LeadDetails l={l} showHost={false} /></div>
    </details>
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b"><div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
        <span className="font-semibold flex-1">My meetings</span><span className="text-sm text-slate-500">{p.email}</span><SignOut />
      </div></header>
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <section className="space-y-2"><h2 className="font-semibold">Upcoming ({upcoming.length})</h2>
          {upcoming.length ? upcoming.map(Card) : <p className="text-sm text-slate-500">No upcoming meetings.</p>}</section>
        <section className="space-y-2"><h2 className="font-semibold">Past / canceled ({past.length})</h2>
          {past.length ? past.map(Card) : <p className="text-sm text-slate-500">Nothing yet.</p>}</section>
      </main>
    </div>
  );
}
