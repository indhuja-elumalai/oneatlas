import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtPrice } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { CompareButton } from "@/components/compare-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rankings & benchmarks" };

type SP = Promise<{ benchmark?: string; lab?: string; view?: string }>;

export default async function RankingsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const benchmarks = await prisma.benchmark.findMany({ include: { _count: { select: { scores: true } } }, orderBy: { name: "asc" } });
  const benchmark = benchmarks.find((b) => b.slug === sp.benchmark) ?? benchmarks[0];
  const view = sp.view === "value" ? "value" : "score";

  if (!benchmark) return <EmptyState title="No benchmarks yet" hint="Run npm run sync to ingest leaderboard data." />;

  const scores = await prisma.benchmarkScore.findMany({
    where: { benchmarkId: benchmark.id, ...(sp.lab ? { model: { lab: { slug: sp.lab } } } : {}) },
    include: { model: { include: { lab: true } } },
  });
  const labs = [...new Map(scores.map((s) => [s.model.lab.slug, s.model.lab])).values()];

  // "Value" = benchmark points per dollar of a typical workload (3:1 input:output blend)
  const blended = (s: (typeof scores)[number]) =>
    s.model.minInputPrice !== null && s.model.minOutputPrice !== null ? s.model.minInputPrice * 0.75 + s.model.minOutputPrice * 0.25 : null;
  const valueOf = (s: (typeof scores)[number]) => {
    const p = blended(s);
    return p && p > 0 ? s.score / p : null;
  };
  const rows = [...scores].sort((a, b) =>
    view === "value" ? (valueOf(b) ?? -1) - (valueOf(a) ?? -1) : benchmark.higherIsBetter ? b.score - a.score : a.score - b.score,
  );
  const top = Math.max(...scores.map((s) => s.score), 1);

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { benchmark: benchmark.slug, lab: sp.lab, view: sp.view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/rankings?${p}`;
  };

  return (
    <div>
      <PageHeader
        title="Rankings"
        subtitle={<>{benchmark.description} <a href={benchmark.sourceUrl} target="_blank" className="underline">Source</a></>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {benchmarks.map((b) => (
          <Link key={b.id} href={link({ benchmark: b.slug, lab: undefined })} className={`rounded-lg border px-3 py-1.5 text-sm ${b.id === benchmark.id ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-800 text-zinc-400 hover:text-white"}`}>
            {b.name} <span className="text-xs text-zinc-500">{b._count.scores}</span>
          </Link>
        ))}
        <div className="ml-auto flex rounded-lg border border-zinc-800 p-0.5 text-sm">
          <Link href={link({ view: undefined })} className={`rounded-md px-3 py-1 ${view === "score" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}>Top score</Link>
          <Link href={link({ view: "value" })} className={`rounded-md px-3 py-1 ${view === "value" ? "bg-zinc-800 text-white" : "text-zinc-400"}`}>Best value</Link>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
        <Link href={link({ lab: undefined })} className={`rounded-full border px-2.5 py-1 ${!sp.lab ? "border-zinc-500 text-white" : "border-zinc-800 text-zinc-400"}`}>All labs</Link>
        {labs.map((l) => (
          <Link key={l.slug} href={link({ lab: l.slug })} className={`rounded-full border px-2.5 py-1 ${sp.lab === l.slug ? "border-zinc-500 text-white" : "border-zinc-800 text-zinc-400"}`}>{l.name}</Link>
        ))}
      </div>
      {view === "value" && (
        <p className="mb-4 text-sm text-zinc-500">
          Best value = score ÷ blended price per 1M tokens (75% input, 25% output), using each model&apos;s cheapest provider. Models without pricing are listed last.
        </p>
      )}
      <div className="scroll-x rounded-xl border border-zinc-800">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-12 p-3">#</th>
              <th className="p-3">Model</th>
              <th className="p-3">Score</th>
              <th className="p-3">Blended $/1M</th>
              <th className="p-3">Points per $</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} className="border-t border-zinc-800/70">
                <td className="p-3 font-mono text-zinc-500">{i + 1}</td>
                <td className="p-3">
                  <Link href={`/models/${s.model.slug}`} className="font-medium hover:text-accent">{s.model.name}</Link>
                  <div className="text-xs text-zinc-500">{s.model.lab.name} · run as “{s.rawModelName}”</div>
                </td>
                <td className="w-64 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-zinc-800"><div className="h-2 rounded-full bg-accent" style={{ width: `${(s.score / top) * 100}%` }} /></div>
                    <span className="w-14 text-right font-mono">{s.score.toFixed(1)}{benchmark.unit}</span>
                  </div>
                </td>
                <td className="p-3 font-mono">{fmtPrice(blended(s))}</td>
                <td className="p-3 font-mono">{valueOf(s)?.toFixed(1) ?? "—"}</td>
                <td className="p-3 text-right"><CompareButton slug={s.model.slug} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
