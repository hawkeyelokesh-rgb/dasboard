import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { getMe, listOrgMembers } from "@/lib/calendly";

export async function POST() {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const me = await getMe();
    const members = await listOrgMembers(me.current_organization);
    const db = adminClient();
    // Resync only touches the raw Calendly name + uri; display_name (admin override) is never overwritten.
    const { data: existing } = await db.from("hosts").select("email");
    const have = new Set((existing ?? []).map((h: any) => h.email.toLowerCase()));
    let added = 0;
    for (const m of members) {
      const email = m.email.toLowerCase();
      if (have.has(email)) {
        await db.from("hosts").update({ name: m.name, calendly_user_uri: m.uri }).eq("email", email);
      } else {
        await db.from("hosts").insert({ name: m.name, email, calendly_user_uri: m.uri });
        added++;
      }
    }
    return NextResponse.json({ ok: true, total: members.length, added });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
