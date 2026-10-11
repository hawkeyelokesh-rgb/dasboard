"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setErr("Wrong email or password."); setBusy(false); return; }
    window.location.href = "/";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">Altira Dashboard</h1>
        <p className="text-sm text-slate-500">Sign in with your email and password.</p>
        <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="w-full bg-slate-900 text-white rounded py-2 disabled:opacity-50">{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
