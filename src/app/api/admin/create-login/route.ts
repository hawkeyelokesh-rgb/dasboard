import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";

/** Body: { email, password, name?, role?: "host" | "admin" } */
export async function POST(req: Request) {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const role = b.role === "admin" ? "admin" : "host";
  const name = b.name ? String(b.name) : null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password needs at least 8 characters." }, { status: 400 });

  const db = adminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Could not create user" }, { status: 400 });
  const { error: pErr } = await db.from("profiles").insert({ id: data.user.id, email, name, role });
  if (pErr) {
    await db.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
