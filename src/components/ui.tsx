import Link from "next/link";
import { capLabel } from "@/lib/format";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-800 bg-zinc-900/40 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "accent" }) {
  const cls =
    tone === "accent"
      ? "border-accent/30 bg-accent-dim text-accent"
      : "border-zinc-700 bg-zinc-800/60 text-zinc-300";
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function CapBadges({ caps, max = 99 }: { caps: string[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {caps.slice(0, max).map((c) => (
        <Badge key={c}>{capLabel(c)}</Badge>
      ))}
      {caps.length > max && <Badge>+{caps.length - max}</Badge>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-xl text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, href, cta }: { title: string; hint?: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
      <div className="font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-zinc-500">{hint}</div>}
      {href && cta && (
        <Link href={href} className="mt-4 inline-block text-sm text-accent hover:underline">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function modelHref(slug: string) {
  return `/models/${slug}`;
}
