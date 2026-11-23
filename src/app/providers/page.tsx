import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const providers = await prisma.provider.findMany({
    include: { _count: { select: { endpoints: true } } },
    orderBy: { endpoints: { _count: "desc" } },
  });
  return (
    <div>
      <PageHeader title="Providers" subtitle={`${providers.length} inference providers and the models they serve`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((p) => (
          <Link key={p.id} href={`/providers/${p.slug}`} className="flex items-baseline justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-600">
            <span className="font-medium">{p.name}</span>
            <span className="font-mono text-xs text-zinc-500">{p._count.endpoints} models</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
