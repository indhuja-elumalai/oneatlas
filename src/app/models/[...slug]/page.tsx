import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelBySlug } from "@/lib/models";
import { fmtDate, fmtPrice, fmtTokens } from "@/lib/format";
import { Badge, CapBadges, Card, Stat } from "@/components/ui";
import { CompareButton } from "@/components/compare-button";
import { PriceHistory } from "@/components/price-history";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const m = await getModelBySlug(slug.join("/"));
  return { title: m ? `${m.name} — pricing, context & benchmarks` : "Model not found" };
}

export default async function ModelPage({ params }: { params: Params }) {
  const { slug } = await params;
  const m = await getModelBySlug(slug.map(decodeURIComponent).join("/"));
  if (!m) notFound();

  const priced = m.endpoints.filter((e) => e.inputPricePer1M !== null);
  const blended = (e: (typeof priced)[number]) => (e.inputPricePer1M ?? 0) * 0.75 + (e.outputPricePer1M ?? 0) * 0.25;
  const cheapest = priced.length ? priced.reduce((a, b) => (blended(a) <= blended(b) ? a : b)) : null;
  const priciest = priced.length ? priced.reduce((a, b) => (blended(a) >= blended(b) ? a : b)) : null;
  const spread = cheapest && priciest && blended(priciest) > 0 ? Math.round((1 - blended(cheapest) / blended(priciest)) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-zinc-500">
          <Link href="/models" className="hover:text-zinc-300">Models</Link> /{" "}
          <Link href={`/labs/${m.lab.slug}`} className="hover:text-zinc-300">{m.lab.name}</Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{m.name}</h1>
          {m.isFree && <Badge tone="accent">Free</Badge>}
          <Badge>{m.modelType}</Badge>
          <div className="ml-auto"><CompareButton slug={m.slug} size="md" /></div>
        </div>
        <div className="mt-1 font-mono text-sm text-zinc-500">{m.slug}</div>
        {m.description && <p className="mt-4 max-w-3xl leading-relaxed text-zinc-300">{m.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Input / 1M" value={fmtPrice(m.minInputPrice)} hint="cheapest provider" />
        <Stat label="Output / 1M" value={fmtPrice(m.minOutputPrice)} hint="cheapest provider" />
        <Stat label="Context" value={fmtTokens(m.contextLength)} hint="tokens" />
        <Stat label="Max output" value={fmtTokens(m.maxOutputTokens)} hint="tokens" />
        <Stat label="Released" value={fmtDate(m.releasedAt)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="font-medium">Capabilities</h2>
          <div className="mt-3">{m.capabilities.length ? <CapBadges caps={m.capabilities} /> : <span className="text-sm text-zinc-500">None reported</span>}</div>
          <h2 className="mt-6 font-medium">Modalities</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div><span className="text-zinc-500">Input: </span>{m.inputModalities.join(", ") || "text"}</div>
            <div><span className="text-zinc-500">Output: </span>{m.outputModalities.join(", ") || "text"}</div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-medium">Benchmarks</h2>
          {m.scores.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No benchmark results from our sources yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {m.scores.map((s) => (
                <div key={s.id}>
                  <div className="flex justify-between text-sm">
                    <Link href={`/rankings?benchmark=${s.benchmark.slug}`} className="hover:text-accent">{s.benchmark.name}</Link>
                    <span className="font-mono">{s.score.toFixed(1)}{s.benchmark.unit}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-zinc-800">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, s.score)}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Reported as “{s.rawModelName}” · <a href={s.sourceUrl} className="underline" target="_blank">source</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 p-5">
          <h2 className="font-medium">Providers ({m.endpoints.length})</h2>
          {spread > 0 && priced.length > 1 && (
            <span className="text-sm text-zinc-400">
              Cheapest provider is <b className="text-accent">{spread}% cheaper</b> than the most expensive
            </span>
          )}
        </div>
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3">Input / 1M</th>
                <th className="px-5 py-3">Output / 1M</th>
                <th className="px-5 py-3">Context</th>
                <th className="px-5 py-3">Price history</th>
                <th className="px-5 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {m.endpoints.map((e) => (
                <tr key={e.id} className="border-t border-zinc-800/70">
                  <td className="px-5 py-3">
                    <Link href={`/providers/${e.provider.slug}`} className="hover:text-accent">{e.provider.name}</Link>
                    {cheapest?.id === e.id && priced.length > 1 && <span className="ml-2"><Badge tone="accent">Cheapest</Badge></span>}
                    <div className="font-mono text-xs text-zinc-600">{e.externalId}</div>
                  </td>
                  <td className="px-5 py-3 font-mono">{fmtPrice(e.inputPricePer1M)}</td>
                  <td className="px-5 py-3 font-mono">{fmtPrice(e.outputPricePer1M)}</td>
                  <td className="px-5 py-3 font-mono">{fmtTokens(e.contextLength)}</td>
                  <td className="px-5 py-3"><PriceHistory points={e.snapshots} /></td>
                  <td className="px-5 py-3">{e.sourceUrl ? <a href={e.sourceUrl} target="_blank" className="text-zinc-400 underline hover:text-white">{e.source}</a> : e.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
