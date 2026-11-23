"use client";
import { MAX_COMPARE, toggleCompare, useCompareList } from "@/lib/compare-store";

export function CompareButton({ slug, size = "sm" }: { slug: string; size?: "sm" | "md" }) {
  const list = useCompareList();
  const added = list.includes(slug);
  const full = !added && list.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      disabled={full}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(slug);
      }}
      title={full ? `You can compare up to ${MAX_COMPARE} models` : undefined}
      className={`rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
        size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs"
      } ${added ? "border-accent/50 bg-accent-dim text-accent" : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"}`}
    >
      {added ? "✓ Comparing" : "+ Compare"}
    </button>
  );
}
