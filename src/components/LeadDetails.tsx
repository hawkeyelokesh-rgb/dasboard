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
  );
}
