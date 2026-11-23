"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearCompare, toggleCompare, useCompareList } from "@/lib/compare-store";

export function CompareTray() {
  const list = useCompareList();
  const path = usePathname();
  if (list.length === 0 || path.startsWith("/compare")) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 p-2 pl-4 shadow-2xl backdrop-blur">
        <span className="text-sm text-zinc-400">Compare:</span>
        {list.map((s) => (
          <button key={s} onClick={() => toggleCompare(s)} className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs hover:bg-zinc-700" title="Remove">
            {s.split("/").pop()} ✕
          </button>
        ))}
        <button onClick={clearCompare} className="px-2 text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
        <Link
          href={`/compare?m=${list.map(encodeURIComponent).join(",")}`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${list.length < 2 ? "pointer-events-none bg-zinc-800 text-zinc-500" : "bg-accent text-zinc-950"}`}
        >
          {list.length < 2 ? "Add 1 more" : `Compare ${list.length} →`}
        </Link>
      </div>
    </div>
  );
}
