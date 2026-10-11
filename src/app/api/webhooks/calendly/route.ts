import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/calendly";
import { handleCalendlyEvent } from "@/lib/webhook";
import { supabaseStore } from "@/lib/store";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!key) return NextResponse.json({ error: "signing key not configured" }, { status: 500 });
  if (!verifySignature(raw, req.headers.get("calendly-webhook-signature"), key)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let env: any;
  try { env = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const db = adminClient();
  try {
    const result = await handleCalendlyEvent(env, supabaseStore());
    await db.from("webhook_events").insert({ event: `${env.event}: ${result}`, payload: env });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    await db.from("webhook_events").insert({ event: env?.event ?? "unknown", payload: env, error: String(e?.message ?? e) });
    // 500 makes Calendly retry delivery
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
