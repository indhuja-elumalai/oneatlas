import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getFacets, listModels, modelListQuery } from "@/lib/models";
import { filtersToParams, interpret } from "@/lib/finder";
import { ModelCard } from "@/components/model-card";
import { ModelFilters, SortSelect } from "@/components/model-filters";
import { AskBox } from "@/components/ask-box";
import { EmptyState, PageHeader } from "@/components/ui";
import { capLabel, fmtTokens } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Models" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ModelsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (v !== undefined) raw[k] = Array.isArray(v) ? v.join(",") : v;

  // "ask" = plain-English query -> LLM turns it into filters -> DB answers
  let interpreted: Awaited<ReturnType<typeof interpret>> | null = null;
  if (raw.ask) {
    interpreted = await interpret(raw.ask);
    const p = filtersToParams(interpreted.filters);
    for (const [k, v] of p) raw[k] = v;
  }

  const parsed = modelListQuery.safeParse(raw);
  const query = parsed.success ? parsed.data : modelListQuery.parse({});
  const [result, facets] = await Promise.all([listModels(query), getFacets()]);

  const pageHref = (page: number) => {
    const p = new URLSearchParams(raw);
    p.delete("ask");
    p.set("page", String(page));
    return `/models?${p}`;
  };

  return (
    <div>
      <PageHeader title="Models" subtitle={`${result.meta.total.toLocaleString()} models match`}>
        <Suspense>
          <SortSelect />
        </Suspense>
      </PageHeader>

      <AskBox initial={raw.ask} />

      {interpreted && (
        <div className="mb-6 rounded-lg border border-accent/20 bg-accent-dim/30 p-3 text-sm">
          <span className="text-zinc-400">
            Interpreted by <b className="text-accent">{interpreted.engine === "rules" ? "rule parser" : interpreted.engine}</b> as:
          </span>{" "}
          {describe(interpreted.filters) || <span className="text-zinc-500">no specific filters</span>}
          {interpreted.tried.length > 0 && (
            <div className="mt-1 text-xs text-zinc-500">Fallback used — {interpreted.tried.join(" · ")}</div>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <Suspense>
          <ModelFilters facets={facets} />
        </Suspense>
        <div>
          {result.data.length === 0 ? (
            <EmptyState title="No models match these filters" hint="Try removing a filter." href="/models" cta="Reset filters" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.data.map((m) => (
                <ModelCard key={m.id} m={m} />
              ))}
            </div>
          )}
          {result.meta.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4 text-sm">
              {query.page > 1 ? <Link className="text-zinc-300 hover:text-white" href={pageHref(query.page - 1)}>← Previous</Link> : <span className="text-zinc-700">← Previous</span>}
              <span className="text-zinc-500">
                Page {query.page} of {result.meta.totalPages}
              </span>
              {query.page < result.meta.totalPages ? <Link className="text-zinc-300 hover:text-white" href={pageHref(query.page + 1)}>Next →</Link> : <span className="text-zinc-700">Next →</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function describe(f: Awaited<ReturnType<typeof interpret>>["filters"]) {
  const parts: string[] = [];
  if (f.q) parts.push(`name contains “${f.q}”`);
  if (f.lab.length) parts.push(`lab: ${f.lab.join(", ")}`);
  if (f.capability.length) parts.push(f.capability.map(capLabel).join(" + "));
  if (f.inputModality.length) parts.push(`input: ${f.inputModality.join(", ")}`);
  if (f.minContext) parts.push(`context ≥ ${fmtTokens(f.minContext)}`);
  if (f.maxInputPrice !== undefined) parts.push(`input ≤ $${f.maxInputPrice}/1M`);
  if (f.free) parts.push("free");
  if (f.sort) parts.push(`sorted by ${{ price_in: "cheapest", price_out: "cheapest output", context: "largest context", released: "newest", name: "name" }[f.sort]}`);
  return parts.join(" · ");
}
