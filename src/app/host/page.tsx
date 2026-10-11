import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { serverClient } from "@/lib/supabase/server";
import SignOut from "@/components/SignOut";
import Logo from "@/components/Logo";
import LeadDetails, { Lead, StatusBadge } from "@/components/LeadDetails";
import { fmtDateTime, fmtTime, istDayBounds, todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function HostPage({ searchParams }: { searchParams: { date?: string; view?: string } }) {
  const p = await requireRole("host");
  const view = searchParams.view === "all" ? "all" : "today";
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayIST();
  const { start, end } = istDayBounds(date);
  const isToday = date === todayIST();

  const db = serverClient();
  // RLS limits this to leads where host_email = this user's email.
  const { data: todayRows } = await db.from("leads").select("*")
    .not("call_start", "is", null).gte("call_start", start).lt("call_start", end)
    .order("call_start", { ascending: true });
  const { data: upcomingRows } = await db.from("leads").select("*")
    .eq("status", "booked").gte("call_start", new Date().toISOString())
    .order("call_start", { ascending: true });

  const today = (todayRows ?? []) as Lead[];
  const upcoming = (upcomingRows ?? []) as Lead[];
  const list = view === "all" ? upcoming : today;

  const Card = (l: Lead) => (
    <details key={l.id} className="card">
      <summary className="cursor-pointer flex flex-wrap gap-3 items-center text-base">
        <b className="text-ink-900">{view === "all" ? fmtDateTime(l.call_start!) : fmtTime(l.call_start!)}</b>
        <span>{l.name}</span><span className="text-ink-400">{l.event_name}</span><StatusBadge s={l.status} />
      </summary>
      <div className="mt-4 pt-4 border-t border-ink-100"><LeadDetails l={l} showHost={false} /></div>
    </details>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-10 bg-white border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Logo className="h-10 w-auto" />
          <span className="font-semibold flex-1 text-lg text-ink-900">My meetings</span>
          <span className="text-sm text-ink-400">{p.email}</span>
          <SignOut />
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Link href="/host" className={`card border-t-4 ${view === "today" ? "border-t-gold-500" : "border-t-transparent"}`}>
            <div className="text-4xl font-bold text-ink-900">{today.length}</div>
            <div className="text-sm text-ink-400 mt-1">Today</div>
          </Link>
          <Link href="/host?view=all" className={`card border-t-4 ${view === "all" ? "border-t-gold-500" : "border-t-transparent"}`}>
            <div className="text-4xl font-bold text-ink-900">{upcoming.length}</div>
            <div className="text-sm text-ink-400 mt-1">All upcoming</div>
          </Link>
        </div>

        {view === "today" && (
          <div className="card flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/host?date=${shiftDate(date, -1)}`} className="btn-ghost border border-ink-100">&larr; Prev</Link>
            <form className="flex items-center gap-2">
              <input type="date" name="date" defaultValue={date} className="field" />
              <button className="btn-primary">Go</button>
            </form>
            <Link href={`/host?date=${shiftDate(date, 1)}`} className="btn-ghost border border-ink-100">Next &rarr;</Link>
            {!isToday && <Link href="/host" className="link">Jump to today</Link>}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="card-title mb-0">{view === "all" ? "All upcoming" : isToday ? "Today" : date} ({list.length})</h2>
          {list.length ? list.map(Card) : <p className="text-sm text-ink-400">No meetings{view === "today" ? " on this date." : "."}</p>}
        </section>
      </main>
    </div>
  );
}
