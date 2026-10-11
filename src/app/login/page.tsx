"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import Logo from "@/components/Logo";

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
    <main className="min-h-screen flex items-center justify-center bg-ink-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow-md border border-ink-100 p-8 space-y-5">
        <Logo className="h-14 w-auto mx-auto" />
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-ink-900">Altira Dashboard</h1>
          <p className="text-sm text-ink-400">Sign in with your email and password.</p>
        </div>
        <input className="field w-full" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field w-full" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="btn-primary w-full py-2.5">{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
