"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

export default function TeamPanel({ hosts, logins, events }: { hosts: any[]; logins: Record<string, string>; events: any[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<{ email: string; name: string; password: string; role: string } | null>(null);

  async function act(url: string, body?: unknown, okText?: (j: any) => string) {
    setMsg("Working...");
    const { ok, j } = await post(url, body);
    setMsg(ok ? (okText?.(j) ?? "Done.") : `Error: ${j.error ?? "failed"}`);
    if (ok) router.refresh();
    return ok;
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <h2 className="font-semibold">Calendly connection</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <button className="bg-slate-900 text-white rounded px-3 py-1" onClick={() => act("/api/admin/sync-hosts", undefined, (j) => `Found ${j.total} people, ${j.added} new. Switch the closers on below.`)}>1. Sync hosts from Calendly</button>
          <button className="bg-slate-900 text-white rounded px-3 py-1" onClick={() => act("/api/admin/webhook", undefined, () => "Webhooks registered. New form answers and bookings will now appear here.")}>2. Register webhooks</button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
      </section>

      <section className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-semibold mb-2">Hosts</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>Name</th><th>Email</th><th>Active (closer)</th><th>Login</th></tr></thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id} className="border-t">
                <td className="py-2">{h.name}</td><td>{h.email}</td>
                <td><input type="checkbox" defaultChecked={h.active} onChange={(e) => act("/api/admin/host-active", { id: h.id, active: e.target.checked }, () => "Saved.")} /></td>
                <td>{logins[h.email.toLowerCase()] ? <span className="text-green-700">{logins[h.email.toLowerCase()]}</span>
                  : <button className="underline" onClick={() => setForm({ email: h.email, name: h.name, password: "", role: "host" })}>Create login</button>}</td>
              </tr>
            ))}
            {hosts.length === 0 && <tr><td className="py-2 text-slate-500" colSpan={4}>No hosts yet. Click "Sync hosts from Calendly".</td></tr>}
          </tbody>
        </table>
        <button className="underline text-sm mt-3" onClick={() => setForm({ email: "", name: "", password: "", role: "host" })}>Create another login</button>
      </section>

      {form && (
        <section className="bg-white rounded-lg shadow-sm p-4 space-y-2 text-sm max-w-md">
          <h2 className="font-semibold">New login</h2>
          <input className="w-full border rounded px-2 py-1" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="w-full border rounded px-2 py-1" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full border rounded px-2 py-1" placeholder="Password (min 8 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="border rounded px-2 py-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="host">Host (sees own meetings)</option><option value="admin">Admin (sees everything)</option></select>
          <p className="text-slate-500">A host only sees meetings where the host email matches this login email.</p>
          <div className="flex gap-2">
            <button className="bg-slate-900 text-white rounded px-3 py-1" onClick={async () => { if (await act("/api/admin/create-login", form, () => "Login created. Send them the email and password.")) setForm(null); }}>Create</button>
            <button className="underline" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </section>
      )}

      <section className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-semibold mb-2">Recent webhook events</h2>
        {events.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
          <ul className="text-sm space-y-1">{events.map((e, i) => <li key={i}>{new Date(e.received_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {e.event} · {e.error ? "error: " + e.error : "ok"}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
