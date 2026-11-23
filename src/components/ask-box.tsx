"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = ["cheap vision model with 128k context", "best free model for tool calling", "newest reasoning model from google under $2"];

export function AskBox({ initial = "", large = false }: { initial?: string; large?: boolean }) {
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const submit = (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    router.push(`/models?ask=${encodeURIComponent(text.trim())}`);
    setTimeout(() => setBusy(false), 4000);
  };
  return (
    <div className="mb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className={`flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 focus-within:border-accent/60 ${large ? "p-2" : ""}`}
      >
        <span className="pl-2 text-accent">✦</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe the model you need, in plain English…"
          className={`flex-1 bg-transparent outline-none placeholder:text-zinc-500 ${large ? "py-2 text-lg" : "py-1.5 text-sm"}`}
        />
        <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60">
          {busy ? "Thinking…" : "Find models"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => { setQ(ex); submit(ex); }} className="rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-400 hover:border-zinc-600 hover:text-white">
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
