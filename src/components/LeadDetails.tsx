"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";

export type Lead = {
  id: string; name: string | null; email: string | null; whatsapp: string | null; location: string | null;
  describes_best: string | null; previously_done: string | null; investment: string | null; goal: string | null;
  income_target: string | null; weekly_time: string | null; challenges: string | null; roadmap: string | null;
  commitment: string | null; submitted_at: string | null; host_name: string | null; host_email: string | null;
  event_name: string | null; call_start: string | null; meeting_url: string | null; status: string;
};

const FIELDS: [keyof Lead, string][] = [
  ["whatsapp", "WhatsApp"], ["location", "Location"], ["describes_best", "Describes best"], ["previously_done", "Previously done"],
  ["investment", "Investment"], ["goal", "Goal"], ["income_target", "Income target"], ["weekly_time", "Weekly time"],
  ["challenges", "Challenges"], ["roadmap", "Roadmap"], ["commitment", "Commitment"],
];

export function StatusBadge({ s }: { s: string }) {
  const c = s === "booked" ? "bg-green-100 text-green-800" : s === "canceled" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <span className={`badge ${c}`}>{s}</span>;
}

export default function LeadDetails({ l, showHost = true }: { l: Lead; showHost?: boolean }) {
  return (
    <div className="space-y-4">
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div><dt className="text-ink-400">Email</dt><dd>{l.email ?? "-"}</dd></div>
        <div><dt className="text-ink-400">Submitted</dt><dd>{fmtDateTime(l.submitted_at)}</dd></div>
        {showHost && <div><dt className="text-ink-400">Host</dt><dd>{l.host_name ?? "-"} {l.host_email ? `(${l.host_email})` : ""}</dd></div>}
        <div><dt className="text-ink-400">Event</dt><dd>{l.event_name ?? "-"}</dd></div>
        {FIELDS.map(([k, label]) => (
          <div key={k}><dt className="text-ink-400">{label}</dt><dd className="whitespace-pre-wrap">{(l[k] as string) || "-"}</dd></div>
        ))}
        {l.meeting_url && <div><dt className="text-ink-400">Meeting link</dt><dd><a className="link" href={l.meeting_url} target="_blank">Open</a></dd></div>}
      </dl>
      {l.status === "booked" && <MeetingActions id={l.id} />}
    </div>
  );
}

function MeetingActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"cancel" | "reschedule" | null>(null);
  const [msg, setMsg] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState("");

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, j };
  }

  async function reschedule() {
    setBusy("reschedule"); setMsg("");
    const { ok, j } = await post("/api/leads/reschedule-link", { id });
    setBusy(null);
    if (ok) window.open(j.url, "_blank"); else setMsg(j.error ?? "Failed to get reschedule link.");
  }

  async function confirmCancel() {
    if (!reason.trim()) return;
    setBusy("cancel"); setMsg("");
    const { ok, j } = await post("/api/leads/cancel", { id, reason: reason.trim() });
    setBusy(null);
    if (ok) { setShowCancelForm(false); router.refresh(); } else setMsg(j.error ?? "Failed to cancel.");
  }

  return (
    <div className="pt-2 border-t border-ink-100" onClick={(e) => e.stopPropagation()}>
      {!showCancelForm ? (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-ghost border border-ink-100" disabled={busy !== null} onClick={reschedule}>
            {busy === "reschedule" ? "Opening..." : "Reschedule"}
          </button>
          <button className="btn-ghost border border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setShowCancelForm(true); setMsg(""); }}>
            Cancel meeting
          </button>
          {msg && <span className="text-sm text-red-600">{msg}</span>}
        </div>
      ) : (
        <div className="space-y-2 max-w-md">
          <label className="text-sm font-medium text-ink-900">Why is this meeting being canceled?</label>
          <textarea className="field w-full" rows={2} placeholder="e.g. Client requested, no longer interested, duplicate booking..."
            value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy !== null} autoFocus />
          <div className="flex items-center gap-3">
            <button className="btn-primary bg-red-700 hover:bg-red-800" disabled={busy !== null || !reason.trim()} onClick={confirmCancel}>
              {busy === "cancel" ? "Canceling..." : "Confirm cancellation"}
            </button>
            <button className="link text-sm text-ink-400" disabled={busy !== null} onClick={() => { setShowCancelForm(false); setReason(""); setMsg(""); }}>Back</button>
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
