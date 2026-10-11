import { serverClient } from "@/lib/supabase/server";
import TeamPanel from "@/components/TeamPanel";

export const dynamic = "force-dynamic";
export default async function Team() {
  const db = serverClient();
  const { data: hosts } = await db.from("hosts").select("id,name,display_name,email,calendly_user_uri").order("name");
  const { data: profiles } = await db.from("profiles").select("email,role");
  const logins = Object.fromEntries((profiles ?? []).map((p: any) => [p.email.toLowerCase(), p.role]));
  const { data: ev } = await db.from("webhook_events").select("event,received_at,error").order("received_at", { ascending: false }).limit(10);
  return <TeamPanel hosts={hosts ?? []} logins={logins} events={ev ?? []} />;
}
