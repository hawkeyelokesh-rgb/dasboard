import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { serverClient } from "@/lib/supabase/server";
import SignOut from "@/components/SignOut";
import LeadDetails, { Lead, StatusBadge } from "@/components/LeadDetails";
import { fmtTime, istDayBounds, todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function HostPage({ searchParams }: { searchParams: { date?: string } }) {
  const p = await requireRole("host");
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayIST();
  const { start, end } = istDayBounds(date);

  // RLS limits this to leads where host_email = this user's email.
  const { data } = await serverClient().from("leads").select("*")
    .not("call_start", "is", null).gte("call_start", start).lt("call_start", end)
    .order("call_start", { ascending: true });
  const meetings = (data ?? []) as Lead[];
  const isToday = date === todayIST();

  const Card = (l: Lead) => (
    <details key={l.id} className="bg-white rounded-lg shadow-sm p-3">
      <summary className="cursor-pointer flex flex-wrap gap-3 items-center">
        <b>{fmtTime(l.call_start!)}</b><span>{l.name}</span><span className="text-slate-500">{l.event_name}</span><StatusBadge s={l.status} />
      </summary>
      <div className="mt-3"><LeadDetails l={l} showHost={false} /></div>
    </details>
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b"><div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
        <span className="font-semibold flex-1">My meetings</span><span className="text-sm text-slate-500">{p.email}</span><SignOut />
      </div></header>
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/host?date=${shiftDate(date, -1)}`} className="border rounded px-2 py-1 hover:bg-slate-50">&larr; Prev</Link>
          <form className="flex items-center gap-2">
            <input type="date" name="date" defaultValue={date} className="border rounded px-2 py-1" />
            <button className="bg-slate-900 text-white rounded px-3 py-1">Go</button>
          </form>
          <Link href={`/host?date=${shiftDate(date, 1)}`} className="border rounded px-2 py-1 hover:bg-slate-50">Next &rarr;</Link>
          {!isToday && <Link href="/host" className="underline">Today</Link>}
        </div>
        <section className="space-y-2">
          <h2 className="font-semibold">{isToday ? "Today" : date} ({meetings.length})</h2>
          {meetings.length ? meetings.map(Card) : <p className="text-sm text-slate-500">No meetings on this date.</p>}
        </section>
      </main>
    </div>
  );
}
