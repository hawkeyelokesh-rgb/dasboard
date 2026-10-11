import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

/** Body: { email, password } */
export async function POST(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password needs at least 8 characters." }, { status: 400 });

  const db = adminClient();
  const { data: profile, error: pErr } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "No login found for this email." }, { status: 404 });

  const { error } = await db.auth.admin.updateUserById(profile.id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
