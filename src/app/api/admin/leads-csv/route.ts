import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { serverClient } from "@/lib/supabase/server";
import { applyLeadFilters } from "@/lib/leadsQuery";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const HEAD = ["Name", "Email", "WhatsApp", "Location", "Describes Best", "Previously Done", "Investment", "Goal", "Income Target", "Weekly Time", "Challenges", "Roadmap", "Commitment", "Submitted At", "Host Name", "Host Email", "Event Type", "Call Date & Time", "Status"];
const KEYS = ["name", "email", "whatsapp", "location", "describes_best", "previously_done", "investment", "goal", "income_target", "weekly_time", "challenges", "roadmap", "commitment", "submitted_at", "host_name", "host_email", "event_name", "call_start", "status"];

export async function GET(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const g = (k: string) => sp.get(k) || undefined;
  const db = serverClient();
  const q = applyLeadFilters(db.from("leads").select(KEYS.join(",")).order("submitted_at", { ascending: false }).limit(10000), {
    q: g("q"), host: g("host"), status: g("status"), event: g("event"),
    submittedFrom: g("from"), submittedTo: g("to"), callDate: g("call"),
  });
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const csv = toCsv([HEAD, ...(data ?? []).map((r: any) => KEYS.map((k) => r[k]))]);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"' },
  });
}
