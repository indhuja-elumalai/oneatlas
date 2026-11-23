export function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "Free";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3).replace(/0$/, "")}`;
  return `$${v.toFixed(2)}`;
}

export function fmtTokens(v: number | null | undefined): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtUsd(v: number): string {
  if (v === 0) return "$0";
  if (v < 1) return `$${v.toFixed(3)}`;
  if (v < 1000) return `$${v.toFixed(2)}`;
  return `$${Math.round(v).toLocaleString()}`;
}

export const CAPABILITY_LABELS: Record<string, string> = {
  tools: "Tool calling",
  vision: "Vision",
  reasoning: "Reasoning",
  structured_output: "Structured output",
  web_search: "Web search",
  pdf_input: "PDF input",
  audio_input: "Audio input",
};

export const capLabel = (c: string) => CAPABILITY_LABELS[c] ?? c.replace(/_/g, " ");
