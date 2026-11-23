"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { capLabel } from "@/lib/format";

type Facets = {
  labs: { slug: string; name: string; count: number }[];
  providers: { slug: string; name: string; count: number }[];
  capabilities: { value: string; count: number }[];
  inputModalities: { value: string; count: number }[];
};

const CONTEXT_OPTIONS = [
  { label: "Any", value: "" },
  { label: "32K+", value: "32000" },
  { label: "128K+", value: "128000" },
  { label: "200K+", value: "200000" },
  { label: "1M+", value: "1000000" },
];

export function ModelFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const list = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);

  // every filter lives in the URL -> shareable, back-button friendly, SSR'd
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("ask");
    next.delete("page");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`/models?${next}`, { scroll: false }));
  };
  const toggle = (k: string, v: string) => {
    const cur = list(k);
    update({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") || null });
  };

  // debounce text search
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: q || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const Chip = ({ k, v, label, count }: { k: string; v: string; label: string; count?: number }) => {
    const on = list(k).includes(v);
    return (
      <button
        onClick={() => toggle(k, v)}
        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition ${on ? "bg-accent-dim text-accent" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"}`}
      >
        <span className="truncate">{label}</span>
        {count !== undefined && <span className="ml-2 font-mono text-xs text-zinc-600">{count}</span>}
      </button>
    );
  };

  const hasFilters = [...params.keys()].some((k) => !["sort", "order", "page"].includes(k));

  return (
    <aside className={`space-y-6 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name…"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
      />
      {hasFilters && (
        <button onClick={() => { setQ(""); router.replace("/models"); }} className="text-xs text-zinc-500 hover:text-zinc-300">
          Clear all filters
        </button>
      )}
      <Section title="Context window">
        <div className="flex flex-wrap gap-1">
          {CONTEXT_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => update({ minContext: o.value || null })}
              className={`rounded-md border px-2 py-1 text-xs ${(params.get("minContext") ?? "") === o.value ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-800 text-zinc-400 hover:text-white"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Max input price / 1M">
        <div className="flex flex-wrap gap-1">
          {["", "0.5", "1", "3", "10"].map((v) => (
            <button
              key={v || "any"}
              onClick={() => update({ maxInputPrice: v || null })}
              className={`rounded-md border px-2 py-1 text-xs ${(params.get("maxInputPrice") ?? "") === v ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-800 text-zinc-400 hover:text-white"}`}
            >
              {v ? `≤ $${v}` : "Any"}
            </button>
          ))}
          <button
            onClick={() => update({ free: params.get("free") === "true" ? null : "true" })}
            className={`rounded-md border px-2 py-1 text-xs ${params.get("free") === "true" ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-800 text-zinc-400 hover:text-white"}`}
          >
            Free only
          </button>
        </div>
      </Section>
      <Section title="Capabilities">
        {facets.capabilities.map((c) => <Chip key={c.value} k="capability" v={c.value} label={capLabel(c.value)} count={c.count} />)}
      </Section>
      <Section title="Input modality">
        {facets.inputModalities.map((c) => <Chip key={c.value} k="inputModality" v={c.value} label={c.value} count={c.count} />)}
      </Section>
      <Section title="Lab" scroll>
        {facets.labs.map((l) => <Chip key={l.slug} k="lab" v={l.slug} label={l.name} count={l.count} />)}
      </Section>
      <Section title="Provider" scroll>
        {facets.providers.map((p) => <Chip key={p.slug} k="provider" v={p.slug} label={p.name} count={p.count} />)}
      </Section>
    </aside>
  );
}

function Section({ title, children, scroll }: { title: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      <div className={scroll ? "max-h-56 space-y-0.5 overflow-y-auto pr-1" : "space-y-0.5"}>{children}</div>
    </div>
  );
}

export function SortSelect() {
  const router = useRouter();
  const params = useSearchParams();
  const value = `${params.get("sort") ?? "released"}:${params.get("order") ?? ""}`;
  return (
    <select
      value={value}
      onChange={(e) => {
        const [sort, order] = e.target.value.split(":");
        const next = new URLSearchParams(params.toString());
        next.set("sort", sort);
        if (order) next.set("order", order); else next.delete("order");
        next.delete("page");
        router.replace(`/models?${next}`, { scroll: false });
      }}
      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none"
    >
      <option value="released:">Newest first</option>
      <option value="price_in:">Cheapest input</option>
      <option value="price_out:">Cheapest output</option>
      <option value="context:">Largest context</option>
      <option value="context:asc">Smallest context</option>
      <option value="name:">Name A–Z</option>
    </select>
  );
}
