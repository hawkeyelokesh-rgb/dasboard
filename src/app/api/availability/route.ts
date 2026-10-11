import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { istDayBounds, todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Bad date" }, { status: 400 });

  const db = adminClient();
  const { data: hosts, error } = await db.from("hosts").select("id,name,display_name,email").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { start: istStart, end: istEnd } = istDayBounds(date);
  const { data: meetings } = await db
    .from("leads")
    .select("id,name,host_email,event_name,call_start,status")
    .eq("status", "booked")
    .gte("call_start", istStart)
    .lt("call_start", istEnd)
    .order("call_start");

  const result = (hosts ?? []).map((h: any) => ({
    host: { id: h.id, name: h.display_name || h.name, email: h.email },
    bookings: (meetings ?? []).filter((m: any) => m.host_email?.toLowerCase() === h.email.toLowerCase()),
  }));
  return NextResponse.json({ date, hosts: result });
}
