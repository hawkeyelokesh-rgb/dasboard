import { requireRole } from "@/lib/auth";
import SignOut from "@/components/SignOut";
import Logo from "@/components/Logo";
import NavLinks from "@/components/NavLinks";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const p = await requireRole("admin");
  const nav: [string, string][] = [["/admin", "Overview"], ["/admin/availability", "Availability"], ["/admin/leads", "Leads"], ["/admin/team", "Team"]];
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-6">
          <Logo className="h-11 w-auto" />
          <NavLinks items={nav} />
          <span className="text-sm text-ink-400">{p.email}</span>
          <SignOut />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6 space-y-6">{children}</main>
    </div>
  );
}
