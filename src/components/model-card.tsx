import Link from "next/link";
import type { ModelSummary } from "@/lib/models";
import { fmtDate, fmtPrice, fmtTokens } from "@/lib/format";
import { CapBadges } from "./ui";
import { CompareButton } from "./compare-button";

export function ModelCard({ m }: { m: ModelSummary }) {
  return (
    <Link
      href={`/models/${m.slug}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-white group-hover:text-accent">{m.name}</div>
          <div className="truncate font-mono text-xs text-zinc-500">{m.slug}</div>
        </div>
        <CompareButton slug={m.slug} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-zinc-500">Input /1M</div>
          <div className="font-mono text-sm text-zinc-200">{fmtPrice(m.minInputPrice)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Output /1M</div>
          <div className="font-mono text-sm text-zinc-200">{fmtPrice(m.minOutputPrice)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Context</div>
          <div className="font-mono text-sm text-zinc-200">{fmtTokens(m.contextLength)}</div>
        </div>
      </div>
      <div className="mt-3">
        <CapBadges caps={m.capabilities} max={3} />
      </div>
      <div className="mt-auto flex justify-between pt-3 text-xs text-zinc-500">
        <span>{m.lab.name}</span>
        <span>
          {m._count.endpoints} provider{m._count.endpoints === 1 ? "" : "s"} · {fmtDate(m.releasedAt)}
        </span>
      </div>
    </Link>
  );
}
