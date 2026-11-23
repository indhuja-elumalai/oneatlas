"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { capLabel, fmtPrice, fmtTokens, fmtUsd } from "@/lib/format";
import { CompareButton } from "./compare-button";

type Row = { slug: string; name: string; lab: string; provider: string; providerSlug: string; inPrice: number; outPrice: number; context: number | null; monthly: number };

const PRESETS = [
  { label: "Chatbot (10K chats/day)", input: 600_000_000, output: 150_000_000 },
  { label: "RAG app", input: 300_000_000, output: 20_000_000 },
  { label: "Coding agent", input: 1_000_000_000, output: 50_000_000 },
  { label: "Side project", input: 5_000_000, output: 1_000_000 },
];
const CAPS = ["tools", "vision", "reasoning", "structured_output"];

export function CostCalculator() {
  const [input, setInput] = useState(PRESETS[0].input);
  const [output, setOutput] = useState(PRESETS[0].output);
  const [caps, setCaps] = useState<string[]>([]);
  const [minContext, setMinContext] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setState("loading");
      try {
        const p = new URLSearchParams({ input: String(input), output: String(output), minContext: String(minContext), limit: "30" });
        if (caps.length) p.set("capability", caps.join(","));
        const res = await fetch(`/api/cost?${p}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        setRows((await res.json()).data);
        setState("ok");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [input, output, caps, minContext]);

  const cheapest = rows[0]?.monthly ?? 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Presets</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => { setInput(p.input); setOutput(p.output); }}
                className={`rounded-md border px-2 py-1 text-xs ${input === p.input && output === p.output ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-800 text-zinc-400 hover:text-white"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <TokenInput label="Input tokens / month" value={input} onChange={setInput} />
        <TokenInput label="Output tokens / month" value={output} onChange={setOutput} />
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Must support</div>
          <div className="flex flex-wrap gap-1.5">
            {CAPS.map((c) => (
              <button key={c} onClick={() => setCaps((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}
                className={`rounded-md border px-2 py-1 text-xs ${caps.includes(c) ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-800 text-zinc-400 hover:text-white"}`}>
                {capLabel(c)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Min context</div>
          <select value={minContext} onChange={(e) => setMinContext(Number(e.target.value))} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
            {[0, 32000, 128000, 200000, 1000000].map((v) => <option key={v} value={v}>{v ? `${fmtTokens(v)}+` : "Any"}</option>)}
          </select>
        </div>
      </div>

      <div>
        {state === "error" && <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">Couldn&apos;t load prices. Try again.</div>}
        <div className={`scroll-x rounded-xl border border-zinc-800 transition-opacity ${state === "loading" ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Model</th>
                <th className="p-3">Cheapest provider</th>
                <th className="p-3 text-right">Monthly cost</th>
                <th className="p-3 text-right">vs cheapest</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.slug} className="border-t border-zinc-800/70">
                  <td className="p-3 font-mono text-zinc-500">{i + 1}</td>
                  <td className="p-3">
                    <Link href={`/models/${r.slug}`} className="hover:text-accent">{r.name}</Link>
                    <div className="text-xs text-zinc-500">{r.lab} · {fmtTokens(r.context)} ctx</div>
                  </td>
                  <td className="p-3 text-zinc-400">
                    {r.provider}
                    <div className="font-mono text-xs text-zinc-600">{fmtPrice(r.inPrice)} in · {fmtPrice(r.outPrice)} out</div>
                  </td>
                  <td className="p-3 text-right font-mono text-base text-white">{fmtUsd(r.monthly)}</td>
                  <td className="p-3 text-right font-mono text-xs text-zinc-500">{i === 0 ? "—" : cheapest > 0 ? `${(r.monthly / cheapest).toFixed(1)}×` : ""}</td>
                  <td className="p-3 text-right"><CompareButton slug={r.slug} /></td>
                </tr>
              ))}
              {state === "ok" && rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No priced models match these requirements.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TokenInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-2 flex justify-between text-xs font-medium uppercase tracking-wide text-zinc-500">
        <span>{label}</span>
        <span className="font-mono normal-case text-zinc-300">{fmtTokens(value)}</span>
      </div>
      <input
        type="range" min={0} max={100} step={1}
        // log scale slider: 1M .. 10B tokens
        value={Math.round((Math.log10(Math.max(value, 1_000_000)) - 6) * 25)}
        onChange={(e) => onChange(Math.round(10 ** (6 + Number(e.target.value) / 25)))}
        className="w-full accent-[#c6f432]"
      />
    </label>
  );
}
