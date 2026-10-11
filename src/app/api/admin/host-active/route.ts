import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

/** Body: { id, active } */
export async function POST(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await adminClient().from("hosts").update({ active: !!b.active }).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
