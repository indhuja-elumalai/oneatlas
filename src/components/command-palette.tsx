"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Results = {
  models: { slug: string; name: string; lab: { name: string } }[];
  labs: { slug: string; name: string }[];
  providers: { slug: string; name: string }[];
};
type Item = { href: string; label: string; meta: string };

export function CommandPalette({ full = false }: { full?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K toggles, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQ("");
  }, [open]);

  // debounced search; AbortController drops stale responses
  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const r: Results = await res.json();
        setItems([
          ...r.models.map((m) => ({ href: `/models/${m.slug}`, label: m.name, meta: m.lab.name })),
          ...r.labs.map((l) => ({ href: `/labs/${l.slug}`, label: l.name, meta: "Lab" })),
          ...r.providers.map((p) => ({ href: `/providers/${p.slug}`, label: p.name, meta: "Provider" })),
        ]);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-500 hover:border-zinc-700 ${full ? "w-full justify-between py-2" : ""}`}
      >
        <span>{full ? "Search or ask…" : "Search…"}</span>
        <kbd className="hidden rounded border border-zinc-700 px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter") {
                  if (items[active]) go(items[active].href);
                  else if (q.trim()) go(`/models?ask=${encodeURIComponent(q)}`);
                }
              }}
              placeholder="Search models, labs, providers…"
              className="w-full border-b border-zinc-800 bg-transparent px-4 py-3 outline-none placeholder:text-zinc-500"
            />
            <ul className="max-h-80 overflow-y-auto p-1">
              {items.map((it, i) => (
                <li key={it.href}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it.href)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${i === active ? "bg-zinc-800" : ""}`}
                  >
                    <span>{it.label}</span>
                    <span className="text-xs text-zinc-500">{it.meta}</span>
                  </button>
                </li>
              ))}
              {q.trim() && (
                <li>
                  <button onClick={() => go(`/models?ask=${encodeURIComponent(q)}`)} className="w-full rounded-md px-3 py-2 text-left text-sm text-accent hover:bg-zinc-800">
                    ✦ Ask AI: “{q}”
                  </button>
                </li>
              )}
              {!q.trim() && <li className="px-3 py-6 text-center text-sm text-zinc-500">Type to search, or describe what you need.</li>}
              {loading && items.length === 0 && q.trim() && <li className="px-3 py-2 text-sm text-zinc-500">Searching…</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
