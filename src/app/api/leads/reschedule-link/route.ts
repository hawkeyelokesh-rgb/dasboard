import { NextResponse } from "next/server";
import { canManageLeadOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getActiveInvitee } from "@/lib/calendly";

/** Body: { id }. Returns Calendly's own reschedule page URL for that booking. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = adminClient();
  const { data: lead } = await db.from("leads").select("id,event_uri,host_email,status").eq("id", b.id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!(await canManageLeadOrNull(lead.host_email))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (lead.status !== "booked" || !lead.event_uri) return NextResponse.json({ error: "Not an active booking." }, { status: 400 });

  try {
    const invitee = await getActiveInvitee(lead.event_uri);
    if (!invitee?.reschedule_url) return NextResponse.json({ error: "No active invitee found on this booking." }, { status: 404 });
    return NextResponse.json({ url: invitee.reschedule_url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
