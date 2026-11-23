import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { capLabel, fmtDate, fmtPrice, fmtTokens } from "@/lib/format";
import { CompareSync, ModelPicker, RemoveFromCompare } from "@/components/compare-picker";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare models" };

const CAPS = ["tools", "vision", "reasoning", "structured_output", "web_search", "pdf_input", "audio_input"];

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const slugs = (m ?? "").split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean).slice(0, 4);

  const found = slugs.length
    ? await prisma.model.findMany({
        where: { slug: { in: slugs } },
        include: {
          lab: true,
          endpoints: { include: { provider: true }, orderBy: { inputPricePer1M: { sort: "asc", nulls: "last" } } },
          scores: { include: { benchmark: true } },
        },
      })
    : [];
  const models = slugs.map((s) => found.find((f) => f.slug === s)).filter((x): x is (typeof found)[number] => !!x);
  const benchmarks = [...new Map(models.flatMap((x) => x.scores.map((s) => [s.benchmark.slug, s.benchmark]))).values()];

  // index of the "best" model for a numeric row
  const best = (vals: (number | null)[], mode: "min" | "max") => {
    const nums = vals.map((v, i) => [v, i] as const).filter(([v]) => v !== null) as [number, number][];
    if (nums.length < 2) return -1;
    return nums.reduce((a, b) => (mode === "min" ? (b[0] < a[0] ? b : a) : b[0] > a[0] ? b : a))[1];
  };

  type Row = { label: string; cells: React.ReactNode[]; bestIdx?: number };
  const rows: Row[] = [
    { label: "Lab", cells: models.map((x) => <Link key={x.id} href={`/labs/${x.lab.slug}`} className="hover:text-accent">{x.lab.name}</Link>) },
    { label: "Input price / 1M", cells: models.map((x) => fmtPrice(x.minInputPrice)), bestIdx: best(models.map((x) => x.minInputPrice), "min") },
    { label: "Output price / 1M", cells: models.map((x) => fmtPrice(x.minOutputPrice)), bestIdx: best(models.map((x) => x.minOutputPrice), "min") },
    { label: "Cost of 1M in + 1M out", cells: models.map((x) => (x.minInputPrice !== null && x.minOutputPrice !== null ? fmtPrice(x.minInputPrice + x.minOutputPrice) : "—")), bestIdx: best(models.map((x) => (x.minInputPrice !== null && x.minOutputPrice !== null ? x.minInputPrice + x.minOutputPrice : null)), "min") },
    { label: "Cheapest provider", cells: models.map((x) => x.endpoints.find((e) => e.inputPricePer1M !== null)?.provider.name ?? "—") },
    { label: "Providers", cells: models.map((x) => String(x.endpoints.length)), bestIdx: best(models.map((x) => x.endpoints.length), "max") },
    { label: "Context window", cells: models.map((x) => fmtTokens(x.contextLength)), bestIdx: best(models.map((x) => x.contextLength), "max") },
    { label: "Max output", cells: models.map((x) => fmtTokens(x.maxOutputTokens)), bestIdx: best(models.map((x) => x.maxOutputTokens), "max") },
    { label: "Input modalities", cells: models.map((x) => x.inputModalities.join(", ")) },
    { label: "Released", cells: models.map((x) => fmtDate(x.releasedAt)) },
    ...CAPS.map((c) => ({ label: capLabel(c), cells: models.map((x) => (x.capabilities.includes(c) ? <span key={x.id} className="text-accent">✓</span> : <span key={x.id} className="text-zinc-700">—</span>)) })),
    ...benchmarks.map((b) => {
      const vals = models.map((x) => x.scores.find((s) => s.benchmarkId === b.id)?.score ?? null);
      return { label: b.name, cells: vals.map((v) => (v === null ? "—" : `${v.toFixed(1)}${b.unit}`)), bestIdx: best(vals, b.higherIsBetter ? "max" : "min") };
    }),
  ];

  return (
    <div>
      <CompareSync slugs={models.map((x) => x.slug)} />
      <PageHeader title="Compare models" subtitle="Side by side: pricing, context, capabilities and benchmarks. Best value in each row is highlighted.">
        {models.length < 4 && <ModelPicker current={models.map((x) => x.slug)} />}
      </PageHeader>
      {models.length === 0 ? (
        <EmptyState title="Pick models to compare" hint="Use the search above, or press “+ Compare” on any model." href="/models" cta="Browse models →" />
      ) : (
        <div className="scroll-x rounded-xl border border-zinc-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="w-48 p-4 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"></th>
                {models.map((x) => (
                  <th key={x.id} className="p-4 text-left align-top">
                    <Link href={`/models/${x.slug}`} className="font-medium text-white hover:text-accent">{x.name}</Link>
                    <div className="font-mono text-xs font-normal text-zinc-500">{x.slug}</div>
                    <RemoveFromCompare slug={x.slug} current={models.map((y) => y.slug)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-zinc-800/60 last:border-0">
                  <td className="p-4 text-zinc-400">{r.label}</td>
                  {r.cells.map((c, i) => (
                    <td key={i} className={`p-4 font-mono ${r.bestIdx === i ? "bg-accent-dim text-accent" : ""}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
