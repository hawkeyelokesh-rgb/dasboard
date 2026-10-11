"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ items }: { items: [string, string][] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm flex-1">
      {items.map(([href, label]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={`px-3 py-1.5 rounded-lg transition-colors ${active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
