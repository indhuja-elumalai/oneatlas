"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-10 text-center">
      <div className="font-medium">Something went wrong loading this page.</div>
      <button onClick={reset} className="mt-4 rounded-md bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">Try again</button>
    </div>
  );
}
