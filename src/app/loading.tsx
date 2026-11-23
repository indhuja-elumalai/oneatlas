export default function Loading() {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-40 rounded-xl border border-zinc-800 bg-zinc-900/40" />)}
    </div>
  );
}
