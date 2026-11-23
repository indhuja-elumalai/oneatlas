import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listModels, modelListQuery } from "@/lib/models";
import { fmtDate, fmtPrice, fmtTokens } from "@/lib/format";
import { AskBox } from "@/components/ask-box";
import { CompareButton } from "@/components/compare-button";

export const dynamic = "force-dynamic";

type Spread = { slug: string; name: string; providers: number; minIn: number; maxIn: number; cheapest: string; priciest: string };

export default async function Home() {
  const [models, labs, providers, endpoints, newest, cheapLong, topCoding, spreads, typeMix] = await Promise.all([
    prisma.model.count(),
    prisma.lab.count(),
    prisma.provider.count(),
    prisma.modelEndpoint.count(),
    listModels(modelListQuery.parse({ pageSize: "8" })),
    listModels(modelListQuery.parse({ sort: "price_in", minContext: "128000", capability: "tools", pageSize: "5" })),
    prisma.benchmarkScore.findMany({ orderBy: { score: "desc" }, take: 5, include: { model: true, benchmark: true } }),
    // "Same model, different price": models whose providers disagree most on price
    prisma.$queryRaw<Spread[]>`
      SELECT m.slug, m.name, COUNT(*)::int AS providers,
             MIN(e."inputPricePer1M") AS "minIn", MAX(e."inputPricePer1M") AS "maxIn",
             (ARRAY_AGG(p.name ORDER BY e."inputPricePer1M" ASC))[1]  AS cheapest,
             (ARRAY_AGG(p.name ORDER BY e."inputPricePer1M" DESC))[1] AS priciest
      FROM "ModelEndpoint" e
      JOIN "Model" m ON m.id = e."modelId"
      JOIN "Provider" p ON p.id = e."providerId"
      WHERE e."inputPricePer1M" > 0
      GROUP BY m.id
      HAVING COUNT(*) >= 3
      ORDER BY MAX(e."inputPricePer1M") / MIN(e."inputPricePer1M") DESC
      LIMIT 4`,
    prisma.$queryRaw<{ cap: string; n: number }[]>`
      SELECT c AS cap, COUNT(*)::int AS n FROM "Model", unnest(capabilities) c GROUP BY c ORDER BY n DESC LIMIT 5`,
  ]);

  const tile = "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5";

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-accent">Overview</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">What are you building?</h1>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid gap-4 md:grid-cols-6">
        {/* AI finder: the hero of the page */}
        <section className={`${tile} relative overflow-hidden md:col-span-4`}>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <h2 className="text-lg font-medium">Describe your use case. We&apos;ll shortlist the models.</h2>
          <p className="mb-4 mt-1 text-sm text-zinc-400">
            An LLM turns your sentence into filters; the answers come straight from the database, so nothing is made up.
          </p>
          <AskBox large />
        </section>

        <section className={`${tile} grid grid-cols-2 gap-4 md:col-span-2`}>
          {[
            ["Models", models],
            ["Labs", labs],
            ["Providers", providers],
            ["Price points", endpoints],
          ].map(([label, n]) => (
            <div key={label as string}>
              <div className="font-mono text-2xl text-white">{(n as number).toLocaleString()}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
            </div>
          ))}
          <div className="col-span-2 border-t border-zinc-800 pt-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Most common capabilities</div>
            {typeMix.map((t) => (
              <div key={t.cap} className="mb-1.5 flex items-center gap-2 text-xs">
                <span className="w-28 truncate text-zinc-400">{t.cap.replace(/_/g, " ")}</span>
                <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
                  <div className="h-1.5 rounded-full bg-accent/80" style={{ width: `${Math.round((t.n / Math.max(models, 1)) * 100)}%` }} />
                </div>
                <span className="w-9 text-right font-mono text-zinc-500">{Math.round((t.n / Math.max(models, 1)) * 100)}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* Unique insight: provider price spread */}
        <section className={`${tile} md:col-span-3`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Same model, different price</h2>
            <span className="text-xs text-zinc-500">input $/1M across providers</span>
          </div>
          <ul className="mt-4 space-y-3">
            {spreads.map((s) => (
              <li key={s.slug}>
                <div className="flex justify-between gap-2 text-sm">
                  <Link href={`/models/${s.slug}`} className="truncate hover:text-accent">{s.name}</Link>
                  <span className="shrink-0 font-mono text-accent">{(s.maxIn / s.minIn).toFixed(1)}× gap</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {fmtPrice(s.minIn)} on {s.cheapest} → {fmtPrice(s.maxIn)} on {s.priciest} · {s.providers} providers
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${tile} md:col-span-3`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Top coding models</h2>
            <Link href="/rankings" className="text-xs text-zinc-500 hover:text-white">Full leaderboard →</Link>
          </div>
          <ul className="mt-4 space-y-2.5">
            {topCoding.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-4 font-mono text-zinc-600">{i + 1}</span>
                <Link href={`/models/${s.model.slug}`} className="w-40 truncate hover:text-accent">{s.model.name}</Link>
                <div className="h-1.5 flex-1 rounded-full bg-zinc-800"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${s.score}%` }} /></div>
                <span className="w-12 text-right font-mono text-zinc-300">{s.score.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-zinc-600">Aider Polyglot · % of 225 coding exercises solved</div>
        </section>

        <section className={`${tile} md:col-span-2`}>
          <h2 className="font-medium">Cheapest long-context agents</h2>
          <p className="text-xs text-zinc-500">128K+ context with tool calling</p>
          <ul className="mt-4 space-y-2 text-sm">
            {cheapLong.data.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <Link href={`/models/${m.slug}`} className="truncate hover:text-accent">{m.name}</Link>
                <span className="shrink-0 font-mono text-zinc-400">{fmtPrice(m.minInputPrice)}</span>
              </li>
            ))}
          </ul>
          <Link href="/models?sort=price_in&minContext=128000&capability=tools" className="mt-3 inline-block text-xs text-zinc-500 hover:text-white">See all →</Link>
        </section>

        {/* Newest releases as a compact table, not cards */}
        <section className={`${tile} md:col-span-4`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Just released</h2>
            <Link href="/models" className="text-xs text-zinc-500 hover:text-white">All {models.toLocaleString()} models →</Link>
          </div>
          <div className="scroll-x mt-3">
            <table className="w-full min-w-[520px] text-sm">
              <tbody>
                {newest.data.map((m) => (
                  <tr key={m.id} className="border-t border-zinc-800/70 first:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/models/${m.slug}`} className="hover:text-accent">{m.name}</Link>
                      <span className="ml-2 text-xs text-zinc-500">{m.lab.name}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{fmtTokens(m.contextLength)} ctx</td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{fmtPrice(m.minInputPrice)} in</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">{fmtDate(m.releasedAt)}</td>
                    <td className="py-2 text-right"><CompareButton slug={m.slug} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
