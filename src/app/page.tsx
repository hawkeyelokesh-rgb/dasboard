import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const p = await getProfile();
  if (!p) redirect("/login");
  redirect(p.role === "admin" ? "/admin" : "/host");
}
