import Link from "next/link";
import { serverClient } from "@/lib/supabase/server";
import { fmtTime, istDayBounds, todayIST } from "@/lib/format";
import { StatusBadge } from "@/components/LeadDetails";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: { date?: string } }) {
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayIST();
  const isToday = date === todayIST();
  const db = serverClient();
  const chosenDay = istDayBounds(date);
  const realToday = istDayBounds(todayIST());
  const weekEnd = new Date(Date.parse(realToday.start) + 7 * 86400000).toISOString();
  const count = async (f: (q: any) => any) => {
    const { count } = await f(db.from("leads").select("id", { count: "exact", head: true }));
    return count ?? 0;
  };
  const [total, notBooked, dayN, week] = await Promise.all([
    count((q) => q),
    count((q) => q.eq("status", "submitted")),
    count((q) => q.eq("status", "booked").gte("call_start", chosenDay.start).lt("call_start", chosenDay.end)),
    count((q) => q.eq("status", "booked").gte("call_start", realToday.start).lt("call_start", weekEnd)),
  ]);
  const { data: dayMeetings } = await db.from("leads").select("id,name,email,host_name,event_name,call_start,status")
    .eq("status", "booked").gte("call_start", chosenDay.start).lt("call_start", chosenDay.end).order("call_start");
  const { data: upcoming } = await db.from("leads").select("host_name").eq("status", "booked").gte("call_start", realToday.start).lt("call_start", weekEnd);
  const perHost: Record<string, number> = {};
  for (const r of upcoming ?? []) perHost[r.host_name ?? "Unassigned"] = (perHost[r.host_name ?? "Unassigned"] ?? 0) + 1;

  const stats: [string, number, string | null][] = [
    ["All leads", total, "/admin/leads"],
    ["Filled form, not booked", notBooked, "/admin/leads?status=submitted"],
    [isToday ? "Meetings today" : `Meetings on ${date}`, dayN, `/admin/leads?status=booked&call=${date}`],
    ["Meetings next 7 days", week, null],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Overview</h1>
        <form className="flex items-center gap-2 text-sm">
          <input type="date" name="date" defaultValue={date} className="field" />
          <button className="btn-primary">Go</button>
          {!isToday && <Link href="/admin" className="link">Today</Link>}
        </form>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(([t, n, href]) => {
          const tile = (
            <div className="text-4xl font-bold text-ink-900">{n}</div>
          );
          return href ? (
            <Link key={t} href={href} className="card border-t-4 border-t-gold-500 hover:shadow-md hover:border-t-gold-600 transition-shadow">
              {tile}
              <div className="text-sm text-ink-400 mt-1">{t}</div>
            </Link>
          ) : (
            <div key={t} className="card border-t-4 border-t-gold-500">
              {tile}
              <div className="text-sm text-ink-400 mt-1">{t}</div>
            </div>
          );
        })}
      </div>
      <section className="card">
        <h2 className="card-title">{isToday ? "Today's meetings" : `Meetings on ${date}`}</h2>
        {(dayMeetings ?? []).length === 0 ? <p className="text-sm text-ink-400">None.</p> : (
          <table className="data-table"><tbody>
            {dayMeetings!.map((m: any) => (
              <tr key={m.id}><td className="font-medium">{fmtTime(m.call_start)}</td><td>{m.name}</td><td className="text-ink-400">{m.event_name}</td><td>{m.host_name}</td><td><StatusBadge s={m.status} /></td></tr>
            ))}
          </tbody></table>
        )}
      </section>
      <section className="card">
        <h2 className="card-title">Meetings per host (next 7 days)</h2>
        {Object.keys(perHost).length === 0 ? <p className="text-sm text-ink-400">None.</p> : (
          <ul className="text-sm divide-y divide-ink-100">{Object.entries(perHost).sort((a, b) => b[1] - a[1]).map(([h, n]) => <li key={h} className="flex justify-between py-2"><span>{h}</span><b className="text-ink-900">{n}</b></li>)}</ul>
        )}
      </section>
    </div>
  );
}
