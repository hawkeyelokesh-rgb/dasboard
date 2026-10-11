"use client";
import { useCallback, useEffect, useState } from "react";

const t = (ms: number) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ms));

export default function Availability({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const r = await fetch(`/api/availability?date=${date}`);
    const j = await r.json();
    if (!r.ok) setErr(j.error ?? "Failed"); else setData(j);
    setLoading(false);
  }, [date]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Availability</h1>
      <div className="card flex flex-wrap gap-4 items-center text-sm">
        <label className="flex items-center gap-2">Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" /></label>
        <button onClick={load} className="btn-primary">Refresh</button>
        <span className="text-ink-400">Times in India time. {loading && "Loading..."}</span>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {data?.hosts.length === 0 && <p className="text-sm text-ink-400">No hosts yet. Go to Team and sync hosts.</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {data?.hosts.map((h: any) => (
          <div key={h.host.id} className="card space-y-2">
            <b className="text-lg text-ink-900">{h.host.name}</b>
            {h.bookings.length > 0 ? (
              <div className="text-sm space-y-1 divide-y divide-ink-100">
                {h.bookings.map((b: any) => <div key={b.id} className="py-1.5">{t(Date.parse(b.call_start))} · {b.name} · {b.event_name}</div>)}
              </div>
            ) : (
              <p className="text-sm text-ink-400">No bookings.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
