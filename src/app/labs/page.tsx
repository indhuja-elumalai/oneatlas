import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI labs" };

export default async function LabsPage() {
  const labs = await prisma.lab.findMany({
    include: {
      _count: { select: { models: true } },
      models: { select: { name: true, slug: true, releasedAt: true }, orderBy: { releasedAt: { sort: "desc", nulls: "last" } }, take: 3 },
    },
    orderBy: { models: { _count: "desc" } },
  });
  return (
    <div>
      <PageHeader title="AI labs" subtitle={`${labs.length} companies and research labs building models`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {labs.map((l) => (
          <Link key={l.id} href={`/labs/${l.slug}`} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-600">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{l.name}</span>
              <span className="font-mono text-xs text-zinc-500">{l._count.models} models</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-zinc-400">
              {l.models.map((m) => (
                <li key={m.slug} className="flex justify-between gap-2">
                  <span className="truncate">{m.name}</span>
                  <span className="shrink-0 text-xs text-zinc-600">{fmtDate(m.releasedAt)}</span>
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </div>
  );
}
