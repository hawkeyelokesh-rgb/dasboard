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
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-3 flex flex-wrap gap-4 items-center text-sm">
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1" /></label>
        <button onClick={load} className="bg-slate-900 text-white rounded px-3 py-1">Refresh</button>
        <span className="text-slate-500">Times in India time. {loading && "Loading..."}</span>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {data?.hosts.length === 0 && <p className="text-sm text-slate-500">No hosts yet. Go to Team and sync hosts.</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {data?.hosts.map((h: any) => (
          <div key={h.host.id} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
            <b>{h.host.name}</b>
            {h.bookings.length > 0 ? (
              <div className="text-sm space-y-1">
                {h.bookings.map((b: any) => <div key={b.id}>{t(Date.parse(b.call_start))} · {b.name} · {b.event_name}</div>)}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No bookings.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
