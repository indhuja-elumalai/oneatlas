"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCompareList, clearCompare, toggleCompare } from "@/lib/compare-store";

const href = (slugs: string[]) => `/compare${slugs.length ? `?m=${slugs.map(encodeURIComponent).join(",")}` : ""}`;

/** Keeps the floating tray in sync with what this page is showing */
export function CompareSync({ slugs }: { slugs: string[] }) {
  const list = useCompareList();
  const key = slugs.join(",");
  useEffect(() => {
    if (list.join(",") === key) return;
    clearCompare();
    slugs.forEach((s) => toggleCompare(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

export function RemoveFromCompare({ slug, current }: { slug: string; current: string[] }) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(href(current.filter((s) => s !== slug)))} className="mt-1 text-xs font-normal text-zinc-500 hover:text-red-400">
      Remove
    </button>
  );
}

export function ModelPicker({ current }: { current: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ slug: string; name: string; lab: { name: string } }[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { models: [] }))
        .then((r) => setResults(r.models.filter((m: { slug: string }) => !current.includes(m.slug))))
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, current]);

  return (
    <div ref={boxRef} className="relative w-72">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="+ Add a model to compare…"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
      />
      {results.length > 0 && (
        <ul className="absolute right-0 z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.map((r) => (
            <li key={r.slug}>
              <button
                onClick={() => { setQ(""); router.push(href([...current, r.slug])); }}
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-zinc-800"
              >
                <span className="truncate">{r.name}</span>
                <span className="ml-2 shrink-0 text-xs text-zinc-500">{r.lab.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
