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
      <h1 className="page-title">Team</h1>

      <section className="card space-y-3">
        <h2 className="card-title mb-0">Calendly connection</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => act("/api/admin/sync-hosts", undefined, (j) => `Found ${j.total} people, ${j.added} new.`)}>1. Sync hosts from Calendly</button>
          <button className="btn-primary" onClick={() => act("/api/admin/webhook", undefined, () => "Webhooks registered. New form answers and bookings will now appear here.")}>2. Register webhooks</button>
        </div>
        {msg && <p className="text-sm text-ink-700">{msg}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Hosts</h2>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Login</th></tr></thead>
          <tbody>
            {hosts.map((h) => (
              <tr key={h.id}>
                <td className="font-medium text-ink-900"><NameCell host={h} onSaved={() => router.refresh()} /></td>
                <td className="text-ink-400">{h.email}</td>
                <td>{logins[h.email.toLowerCase()]
                  ? <span className="flex items-center gap-2"><span className="badge bg-green-100 text-green-800">{logins[h.email.toLowerCase()]}</span><ResetPasswordCell email={h.email} /></span>
                  : <button className="link text-sm" onClick={() => setForm({ email: h.email, name: h.display_name || h.name, password: "", role: "host" })}>Create login</button>}</td>
              </tr>
            ))}
            {hosts.length === 0 && <tr><td className="py-2 text-ink-400" colSpan={3}>No hosts yet. Click "Sync hosts from Calendly".</td></tr>}
          </tbody>
        </table>
        <button className="link text-sm mt-4" onClick={() => setForm({ email: "", name: "", password: "", role: "host" })}>Create another login</button>
      </section>

      {form && (
        <section className="card space-y-3 max-w-md">
          <h2 className="card-title mb-0">New login</h2>
          <input className="field w-full" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field w-full" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field w-full" placeholder="Password (min 8 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="host">Host (sees own meetings)</option><option value="admin">Admin (sees everything)</option></select>
          <p className="text-sm text-ink-400">A host only sees meetings where the host email matches this login email.</p>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={async () => { if (await act("/api/admin/create-login", form, () => "Login created. Send them the email and password.")) setForm(null); }}>Create</button>
            <button className="link text-sm" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Recent webhook events</h2>
        {events.length === 0 ? <p className="text-sm text-ink-400">None yet.</p> : (
          <ul className="text-sm divide-y divide-ink-100">{events.map((e, i) => <li key={i} className="py-2">{new Date(e.received_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {e.event} · {e.error ? <span className="text-red-600">error: {e.error}</span> : "ok"}</li>)}</ul>
        )}
      </section>
    </div>
  );
}

/** Click the name to rename what this host shows as everywhere (Availability, Leads, Overview) instead of Calendly's raw account name. */
function NameCell({ host, onSaved }: { host: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(host.display_name || host.name);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { ok } = await post("/api/admin/host-name", { id: host.id, display_name: value });
    setBusy(false);
    if (ok) { setEditing(false); onSaved(); }
  }

  if (!editing) {
    return (
      <button className="hover:text-gold-700 text-left" onClick={() => setEditing(true)} title="Click to rename">
        {host.display_name || host.name}
        {host.display_name && host.display_name !== host.name && <span className="text-ink-400 font-normal text-xs"> (Calendly: {host.name})</span>}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <input className="field" value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} autoFocus />
      <button className="link text-sm" onClick={save} disabled={busy}>Save</button>
      <button className="link text-sm text-ink-400" onClick={() => { setValue(host.display_name || host.name); setEditing(false); }} disabled={busy}>Cancel</button>
    </span>
  );
}

/** Lets admin set a new password for an existing login without needing the old one. */
function ResetPasswordCell({ email }: { email: string }) {
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    const { ok, j } = await post("/api/admin/reset-password", { email, password });
    setBusy(false);
    if (ok) { setMsg("Password updated."); setEditing(false); setPassword(""); } else { setMsg(j.error ?? "Failed"); }
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <button className="link text-sm" onClick={() => { setEditing(true); setMsg(""); }}>Reset password</button>
        {msg && <span className="text-xs text-ink-400">{msg}</span>}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <input className="field" type="text" placeholder="New password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoFocus />
      <button className="link text-sm" onClick={save} disabled={busy || password.length < 8}>Save</button>
      <button className="link text-sm text-ink-400" onClick={() => { setEditing(false); setPassword(""); setMsg(""); }} disabled={busy}>Cancel</button>
    </span>
  );
}
