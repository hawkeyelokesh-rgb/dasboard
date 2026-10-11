import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getBusy, getDefaultSchedule } from "@/lib/calendly";
import { dayBoundsUtc, intervalsForDate, isSlotFree, slotsForDate } from "@/lib/availability";
import { istDayBounds, todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayIST();
  const slotMin = Math.min(240, Math.max(15, Number(url.searchParams.get("slot")) || 60));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Bad date" }, { status: 400 });

  const db = adminClient();
  const { data: hosts, error } = await db.from("hosts").select("*").eq("active", true).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const { start: istStart, end: istEnd } = istDayBounds(date);
  const { data: meetings } = await db
    .from("leads")
    .select("id,name,email,host_email,event_name,call_start,call_end,meeting_url,status")
    .eq("status", "booked")
    .gte("call_start", istStart)
    .lt("call_start", istEnd)
    .order("call_start");

  const result = await Promise.all(
    (hosts ?? []).map(async (h: any) => {
      const bookings = (meetings ?? []).filter((m: any) => m.host_email?.toLowerCase() === h.email.toLowerCase());
      const base = { host: { id: h.id, name: h.name, email: h.email }, bookings };
      if (!h.calendly_user_uri) return { ...base, note: "Not linked to Calendly. Use Team > Sync hosts." };
      try {
        const schedule = await getDefaultSchedule(h.calendly_user_uri);
        if (!schedule) return { ...base, note: "No availability schedule in Calendly." };
        const hours = intervalsForDate(schedule, date).map((i) => `${i.from}-${i.to}`);
        const slots = slotsForDate(schedule, date, slotMin);
        const { start: dayStart, end: dayEnd } = dayBoundsUtc(date, schedule.timezone);
        const from = Math.max(dayStart, now + 60000);
        let busy: { start: number; end: number }[] = [];
        // Calendly only answers for future windows (max 7 days).
        if (slots.length && from < dayEnd && from - now < 7 * 86400000 && dayEnd - from <= 7 * 86400000) {
          busy = await getBusy(h.calendly_user_uri, from, dayEnd);
        }
        const list = slots.map((t) => ({
          start: t,
          status: t < now ? "past" : isSlotFree(t, busy, now, slotMin) ? "free" : "busy",
        }));
        return {
          ...base,
          timezone: schedule.timezone,
          hours,
          total: list.length,
          free: list.filter((s) => s.status === "free").length,
          busy: list.filter((s) => s.status === "busy").length,
          slots: list,
        };
      } catch (e: any) {
        return { ...base, note: `Calendly error: ${String(e.message).slice(0, 160)}` };
      }
    })
  );
  return NextResponse.json({ date, slotMin, hosts: result });
}
