"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompareList } from "@/lib/compare-store";
import { CommandPalette } from "./command-palette";

// 16px stroke icons (inline, no icon library needed)
const I = {
  home: "M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6",
  models: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  compare: "M8 3v18 M16 3v18 M3 8h5 M16 16h5",
  rankings: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  calculator: "M5 3h14v18H5z M8 7h8 M8 11h2 M14 11h2 M8 15h2 M14 15h2",
  labs: "M9 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L15 9V3 M8 3h8",
  providers: "M3 6h18v5H3z M3 13h18v5H3z M7 8.5h.01 M7 15.5h.01",
};

const NAV = [
  { href: "/", label: "Overview", icon: I.home },
  { href: "/models", label: "Models", icon: I.models },
  { href: "/compare", label: "Compare", icon: I.compare },
  { href: "/rankings", label: "Rankings", icon: I.rankings },
  { href: "/calculator", label: "Cost calculator", icon: I.calculator },
  { href: "/labs", label: "Labs", icon: I.labs },
  { href: "/providers", label: "Providers", icon: I.providers },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export type Pulse = { models: number; endpoints: number; lastSync: string | null };

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
}

export function Sidebar({ pulse }: { pulse: Pulse }) {
  const isActive = useActive();
  const compare = useCompareList();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-800/80 bg-zinc-950 lg:flex">
      <Link href="/" className="flex h-16 items-center gap-2.5 px-5 font-semibold tracking-tight">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-zinc-950">◎</span>
        <span>OneAtlas</span>
        <span className="ml-auto rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">beta</span>
      </Link>
      <div className="px-3">
        <CommandPalette full />
      </div>
      <nav className="mt-5 flex-1 space-y-0.5 px-3">
        <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Explore</div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
              isActive(n.href) ? "bg-zinc-800/80 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
            }`}
          >
            <span className={isActive(n.href) ? "text-accent" : ""}><Icon d={n.icon} /></span>
            {n.label}
            {n.href === "/compare" && compare.length > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 font-mono text-[10px] font-bold text-zinc-950">{compare.length}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="m-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Live data
        </div>
        <div className="mt-2 font-mono text-zinc-500">
          {pulse.models.toLocaleString()} models
          <br />
          {pulse.endpoints.toLocaleString()} priced endpoints
          <br />
          {pulse.lastSync ? `synced ${pulse.lastSync}` : "not synced yet"}
        </div>
      </div>
    </aside>
  );
}

/** Below lg: compact top bar with scrollable nav */
export function MobileBar() {
  const isActive = useActive();
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-xs font-bold text-zinc-950">◎</span>
          OneAtlas
        </Link>
        <div className="ml-auto"><CommandPalette /></div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 text-sm">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-md px-2.5 py-1 ${isActive(n.href) ? "bg-zinc-800 text-white" : "text-zinc-400"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
