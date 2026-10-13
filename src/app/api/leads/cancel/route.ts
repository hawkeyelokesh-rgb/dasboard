import { NextResponse } from "next/server";
import { canManageLeadOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getActiveInvitee, cancelInvitee } from "@/lib/calendly";

/** Body: { id, reason? }. Cancels the real Calendly booking, then marks the lead canceled. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = adminClient();
  const { data: lead } = await db.from("leads").select("id,event_uri,host_email,status").eq("id", b.id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const profile = await canManageLeadOrNull(lead.host_email);
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (lead.status === "canceled") return NextResponse.json({ ok: true, alreadyCanceled: true });
  if (lead.status !== "booked" || !lead.event_uri) return NextResponse.json({ error: "Not an active booking." }, { status: 400 });

  try {
    const invitee = await getActiveInvitee(lead.event_uri);
    if (!invitee) return NextResponse.json({ error: "No active invitee found on this booking." }, { status: 404 });
    await cancelInvitee(invitee, b.reason ? String(b.reason) : `Canceled by ${profile.email} from the Altira Dashboard`);
    await db.from("leads").update({ status: "canceled" }).eq("id", lead.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
