"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/models", label: "Models" },
  { href: "/compare", label: "Compare" },
  { href: "/rankings", label: "Rankings" },
  { href: "/calculator", label: "Cost calculator" },
  { href: "/labs", label: "Labs" },
  { href: "/providers", label: "Providers" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm md:flex">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-2.5 py-1.5 transition ${active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  return (
    <nav className="flex gap-3 overflow-x-auto text-sm text-zinc-400 md:hidden">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="whitespace-nowrap hover:text-white">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
