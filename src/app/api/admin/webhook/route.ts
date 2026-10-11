import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth";
import { registerWebhook } from "@/lib/calendly";

export async function POST() {
  if (!(await adminOrNull())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!appUrl || !key) return NextResponse.json({ error: "Set NEXT_PUBLIC_APP_URL and CALENDLY_WEBHOOK_SIGNING_KEY in Vercel first." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await registerWebhook(appUrl, key)) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
