import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { modelSummarySelect } from "@/lib/models";
import { ModelCard } from "@/components/model-card";
import { PageHeader, Stat } from "@/components/ui";
import { fmtPrice, fmtTokens } from "@/lib/format";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const lab = await prisma.lab.findUnique({ where: { slug }, select: { name: true } });
  return { title: lab ? `${lab.name} models` : "Lab not found" };
}

export default async function LabPage({ params }: { params: Params }) {
  const { slug } = await params;
  const lab = await prisma.lab.findUnique({
    where: { slug },
    include: { models: { select: modelSummarySelect, orderBy: { releasedAt: { sort: "desc", nulls: "last" } } } },
  });
  if (!lab) notFound();
  const prices = lab.models.map((m) => m.minInputPrice).filter((p): p is number => p !== null && p > 0);
  const maxCtx = Math.max(0, ...lab.models.map((m) => m.contextLength ?? 0));
  return (
    <div>
      <PageHeader title={lab.name} subtitle={lab.website ? <a href={lab.website} target="_blank" className="underline">{lab.website.replace("https://", "")}</a> : undefined} />
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Models" value={lab.models.length} />
        <Stat label="Cheapest input / 1M" value={fmtPrice(prices.length ? Math.min(...prices) : null)} />
        <Stat label="Largest context" value={fmtTokens(maxCtx)} />
        <Stat label="With vision" value={lab.models.filter((m) => m.capabilities.includes("vision")).length} />
      </div>
      <h2 className="mb-3 font-medium">Models & releases</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lab.models.map((m) => <ModelCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}
