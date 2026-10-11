"use client";
import { useCallback, useEffect, useState } from "react";

const t = (ms: number) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ms));

export default function Availability({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState(60);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const r = await fetch(`/api/availability?date=${date}&slot=${slot}`);
    const j = await r.json();
    if (!r.ok) setErr(j.error ?? "Failed"); else setData(j);
    setLoading(false);
  }, [date, slot]);
  useEffect(() => { load(); }, [load]);

  const cls: Record<string, string> = { free: "bg-green-100 text-green-800", busy: "bg-red-100 text-red-800", past: "bg-slate-100 text-slate-400" };
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-3 flex flex-wrap gap-4 items-center text-sm">
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1" /></label>
        <label>Slot length <select value={slot} onChange={(e) => setSlot(Number(e.target.value))} className="border rounded px-2 py-1">
          {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
        <button onClick={load} className="bg-slate-900 text-white rounded px-3 py-1">Refresh</button>
        <span className="text-slate-500">Times in India time. {loading && "Loading..."}</span>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {data?.hosts.length === 0 && <p className="text-sm text-slate-500">No active hosts. Go to Team, sync hosts and switch the closers on.</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {data?.hosts.map((h: any) => (
          <div key={h.host.id} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
            <div className="flex justify-between"><b>{h.host.name}</b>
              {h.total !== undefined && <span className="text-sm">{h.free} free / {h.total} slots</span>}</div>
            {h.note && <p className="text-sm text-amber-700">{h.note}</p>}
            {h.hours && <p className="text-xs text-slate-500">Hours: {h.hours.join(", ") || "Day off"} ({h.timezone})</p>}
            <div className="flex flex-wrap gap-1">
              {h.slots?.map((s: any) => <span key={s.start} className={`px-2 py-0.5 rounded text-xs ${cls[s.status]}`}>{t(s.start)}</span>)}
            </div>
            <div className="text-xs"><span className="text-green-700">green = free</span> · <span className="text-red-700">red = busy</span> · grey = passed</div>
            {h.bookings.length > 0 && (
              <div className="border-t pt-2 text-sm"><div className="font-medium">Bookings</div>
                {h.bookings.map((b: any) => <div key={b.id}>{t(Date.parse(b.call_start))} · {b.name} · {b.event_name}</div>)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
