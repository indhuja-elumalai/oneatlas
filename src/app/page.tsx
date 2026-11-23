import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listModels, modelListQuery } from "@/lib/models";
import { fmtDate, fmtPrice, fmtTokens } from "@/lib/format";
import { AskBox } from "@/components/ask-box";
import { ModelCard } from "@/components/model-card";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [models, labs, providers, endpoints, lastRun, newest, cheapLong, topCoding] = await Promise.all([
    prisma.model.count(),
    prisma.lab.count(),
    prisma.provider.count(),
    prisma.modelEndpoint.count(),
    prisma.ingestionRun.findFirst({ where: { status: { in: ["success", "partial"] } }, orderBy: { finishedAt: "desc" } }),
    listModels(modelListQuery.parse({ pageSize: "6" })),
    listModels(modelListQuery.parse({ sort: "price_in", minContext: "128000", capability: "tools", pageSize: "5", maxInputPrice: "100" })),
    prisma.benchmarkScore.findMany({ orderBy: { score: "desc" }, take: 5, include: { model: { include: { lab: true } }, benchmark: true } }),
  ]);

  return (
    <div className="space-y-14">
      <section className="pt-6 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Find the right AI model, <span className="text-accent">at the right price.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
          {models.toLocaleString()} models from {labs} labs, priced across {providers} providers ({endpoints.toLocaleString()} endpoints), with benchmarks. Synced from public sources
          {lastRun?.finishedAt ? `, last updated ${fmtDate(lastRun.finishedAt)}` : ""}.
        </p>
        <div className="mx-auto mt-8 max-w-2xl text-left">
          <AskBox large />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Cheapest 128K+ models with tool calling</h2>
            <Link href="/models?sort=price_in&minContext=128000&capability=tools" className="text-xs text-zinc-500 hover:text-white">See all →</Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {cheapLong.data.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <Link href={`/models/${m.slug}`} className="truncate hover:text-accent">{m.name}</Link>
                <span className="shrink-0 font-mono text-zinc-400">{fmtPrice(m.minInputPrice)} · {fmtTokens(m.contextLength)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Top coding models</h2>
            <Link href="/rankings" className="text-xs text-zinc-500 hover:text-white">Rankings →</Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {topCoding.map((s, i) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate"><span className="mr-2 font-mono text-zinc-600">{i + 1}</span><Link href={`/models/${s.model.slug}`} className="hover:text-accent">{s.model.name}</Link></span>
                <span className="shrink-0 font-mono text-zinc-400">{s.score.toFixed(1)}{s.benchmark.unit}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Newest models</h2>
          <Link href="/models" className="text-sm text-zinc-400 hover:text-white">Browse all {models.toLocaleString()} →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {newest.data.map((m) => <ModelCard key={m.id} m={m} />)}
        </div>
      </section>
    </div>
  );
}
