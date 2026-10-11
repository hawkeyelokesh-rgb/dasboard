"use client";
import { useState } from "react";

export default function ImportForm() {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("Importing...");
    const r = await fetch("/api/admin/import", { method: "POST", body: new FormData(e.currentTarget) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Done. Added ${j.inserted}, skipped ${j.skipped} duplicates, ${j.bad} rows without email.` : `Error: ${j.error}`);
  }
  return (
    <form onSubmit={submit} className="bg-white rounded-lg shadow-sm p-4 space-y-3 max-w-lg text-sm">
      <h2 className="font-semibold">Import the Zappier sheet</h2>
      <p className="text-slate-500">In Google Sheets: File &gt; Download &gt; Comma Separated Values (.csv). Upload it here. Running it twice is safe: duplicates are skipped.</p>
      <input type="file" name="file" accept=".csv,text/csv" required />
      <label className="block">Call Date &amp; Time in the sheet is in{" "}
        <select name="callTz" className="border rounded px-2 py-1"><option value="IST">India time</option><option value="UTC">UTC</option></select>
      </label>
      <button className="bg-slate-900 text-white rounded px-3 py-1">Import</button>
      {msg && <p>{msg}</p>}
    </form>
  );
}
