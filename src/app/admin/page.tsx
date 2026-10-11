import { serverClient } from "@/lib/supabase/server";
import { fmtTime, istDayBounds, todayIST } from "@/lib/format";
import { StatusBadge } from "@/components/LeadDetails";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const db = serverClient();
  const today = istDayBounds(todayIST());
  const weekEnd = new Date(Date.parse(today.start) + 7 * 86400000).toISOString();
  const count = async (f: (q: any) => any) => {
    const { count } = await f(db.from("leads").select("id", { count: "exact", head: true }));
    return count ?? 0;
  };
  const [total, notBooked, todayN, week] = await Promise.all([
    count((q) => q),
    count((q) => q.eq("status", "submitted")),
    count((q) => q.eq("status", "booked").gte("call_start", today.start).lt("call_start", today.end)),
    count((q) => q.eq("status", "booked").gte("call_start", today.start).lt("call_start", weekEnd)),
  ]);
  const { data: todays } = await db.from("leads").select("id,name,email,host_name,event_name,call_start,status")
    .eq("status", "booked").gte("call_start", today.start).lt("call_start", today.end).order("call_start");
  const { data: upcoming } = await db.from("leads").select("host_name").eq("status", "booked").gte("call_start", today.start).lt("call_start", weekEnd);
  const perHost: Record<string, number> = {};
  for (const r of upcoming ?? []) perHost[r.host_name ?? "Unassigned"] = (perHost[r.host_name ?? "Unassigned"] ?? 0) + 1;

  const stats = [["All leads", total], ["Filled form, not booked", notBooked], ["Meetings today", todayN], ["Meetings next 7 days", week]];
  return (
    <div className="space-y-6">
      <h1 className="page-title">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(([t, n]) => (
          <div key={t as string} className="card border-t-4 border-t-gold-500">
            <div className="text-4xl font-bold text-ink-900">{n}</div>
            <div className="text-sm text-ink-400 mt-1">{t}</div>
          </div>
        ))}
      </div>
      <section className="card">
        <h2 className="card-title">Today's meetings</h2>
        {(todays ?? []).length === 0 ? <p className="text-sm text-ink-400">None.</p> : (
          <table className="data-table"><tbody>
            {todays!.map((m: any) => (
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
