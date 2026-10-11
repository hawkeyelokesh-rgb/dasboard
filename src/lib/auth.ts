import { redirect } from "next/navigation";
import { serverClient } from "./supabase/server";

export type Profile = { id: string; email: string; name: string | null; role: "admin" | "host" };

export async function getProfile(): Promise<Profile | null> {
  const supabase = serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id,email,name,role").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

/** For pages: redirects instead of returning. */
export async function requireRole(role: "admin" | "host"): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  if (p.role !== role) redirect(p.role === "admin" ? "/admin" : "/host");
  return p;
}

/** For API routes: returns the admin profile or null. */
export async function adminOrNull(): Promise<Profile | null> {
  const p = await getProfile();
  return p && p.role === "admin" ? p : null;
}
