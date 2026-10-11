import Link from "next/link";
import { requireRole } from "@/lib/auth";
import SignOut from "@/components/SignOut";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const p = await requireRole("admin");
  const nav = [["/admin", "Overview"], ["/admin/availability", "Availability"], ["/admin/leads", "Leads"], ["/admin/team", "Team"]];
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
          <span className="font-semibold">Altira Dashboard</span>
          <nav className="flex gap-4 text-sm flex-1">
            {nav.map(([h, t]) => <Link key={h} href={h} className="hover:underline">{t}</Link>)}
          </nav>
          <span className="text-sm text-slate-500">{p.email}</span>
          <SignOut />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">{children}</main>
    </div>
  );
}
