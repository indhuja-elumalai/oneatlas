import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtPrice, fmtTokens } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.provider.findUnique({ where: { slug }, select: { name: true } });
  return { title: p ? `${p.name} — models & pricing` : "Provider not found" };
}

export default async function ProviderPage({ params }: { params: Params }) {
  const { slug } = await params;
  const provider = await prisma.provider.findUnique({
    where: { slug },
    include: {
      endpoints: {
        include: { model: { include: { lab: true } } },
        orderBy: { inputPricePer1M: { sort: "asc", nulls: "last" } },
      },
    },
  });
  if (!provider) notFound();
  const labs = new Set(provider.endpoints.map((e) => e.model.lab.name));
  return (
    <div>
      <PageHeader title={provider.name} subtitle={`Serves ${provider.endpoints.length} models from ${labs.size} labs · sorted by input price`} />
      <div className="scroll-x rounded-xl border border-zinc-800">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3">Model</th>
              <th className="p-3">Lab</th>
              <th className="p-3">Input / 1M</th>
              <th className="p-3">Output / 1M</th>
              <th className="p-3">Context</th>
            </tr>
          </thead>
          <tbody>
            {provider.endpoints.map((e) => (
              <tr key={e.id} className="border-t border-zinc-800/70">
                <td className="p-3">
                  <Link href={`/models/${e.model.slug}`} className="hover:text-accent">{e.model.name}</Link>
                  <div className="font-mono text-xs text-zinc-600">{e.externalId}</div>
                </td>
                <td className="p-3 text-zinc-400"><Link href={`/labs/${e.model.lab.slug}`} className="hover:text-white">{e.model.lab.name}</Link></td>
                <td className="p-3 font-mono">{fmtPrice(e.inputPricePer1M)}</td>
                <td className="p-3 font-mono">{fmtPrice(e.outputPricePer1M)}</td>
                <td className="p-3 font-mono">{fmtTokens(e.contextLength ?? e.model.contextLength)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
