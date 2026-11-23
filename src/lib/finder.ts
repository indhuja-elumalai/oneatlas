/**
 * Plain-English model finder.
 *   "cheap vision model with 128k context from google"
 *     -> { capability: ["vision"], minContext: 128000, lab: ["google"], sort: "price_in" }
 *
 * The LLM never returns models (which could be hallucinated): it only turns
 * the sentence into filters, and the database answers. Fallback chain:
 * Gemini -> Groq -> deterministic rule parser, so the feature never breaks.
 */
import { z } from "zod";

export const FinderFilters = z.object({
  q: z.string().max(60).optional(),
  lab: z.array(z.string()).max(5).default([]),
  capability: z.array(z.enum(["tools", "vision", "reasoning", "structured_output", "web_search", "pdf_input", "audio_input"])).default([]),
  inputModality: z.array(z.enum(["text", "image", "audio", "file", "video"])).default([]),
  minContext: z.number().int().positive().optional(),
  maxInputPrice: z.number().nonnegative().optional(),
  free: z.boolean().optional(),
  sort: z.enum(["price_in", "price_out", "context", "released", "name"]).optional(),
});
export type FinderFilters = z.infer<typeof FinderFilters>;
export type FinderResult = { filters: FinderFilters; engine: "gemini" | "groq" | "rules"; tried: string[] };

const LABS = ["openai", "anthropic", "google", "meta-llama", "mistralai", "x-ai", "deepseek", "qwen", "microsoft", "nvidia", "cohere", "amazon", "moonshotai", "z-ai", "minimax"];

const SYSTEM = `You convert a developer's request for an AI model into JSON search filters.
Return ONLY a JSON object with these optional keys:
- lab: array of lab slugs from ${JSON.stringify(LABS)}
- capability: array from ["tools","vision","reasoning","structured_output","web_search","pdf_input","audio_input"]
- inputModality: array from ["text","image","audio","file","video"]
- minContext: integer tokens (e.g. "128k" -> 128000, "1M" -> 1000000)
- maxInputPrice: USD per 1M input tokens (e.g. "under $1" -> 1)
- free: true only if they ask for free models
- sort: one of "price_in" (cheap/budget), "context" (longest context), "released" (newest/latest)
- q: a short model-name keyword ONLY if they name a specific model family (e.g. "llama", "claude")
Omit keys that the request does not mention. Never invent constraints.`;

const cache = new Map<string, FinderResult>();

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 8000): Promise<T> {
  return p(AbortSignal.timeout(ms));
}

async function askGemini(query: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await withTimeout((signal) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    }),
  );
  if (!res.ok) throw new Error(`gemini HTTP ${res.status}`);
  const json = await res.json();
  return JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
}

async function askGroq(query: string): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no GROQ_API_KEY");
  const res = await withTimeout((signal) =>
    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: query },
        ],
      }),
    }),
  );
  if (!res.ok) throw new Error(`groq HTTP ${res.status}`);
  const json = await res.json();
  return JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
}

/** Deterministic fallback: keyword rules. Always available, zero cost. */
export function ruleParse(query: string): FinderFilters {
  const s = query.toLowerCase();
  const f: FinderFilters = { lab: [], capability: [], inputModality: [] };
  const has = (re: RegExp) => re.test(s);
  if (has(/\b(vision|image|images|see|screenshot|multimodal)\b/)) f.capability.push("vision");
  if (has(/\b(tool|tools|function|agent|agents|agentic)\b/)) f.capability.push("tools");
  if (has(/\b(reason|reasoning|think|thinking|math)\b/)) f.capability.push("reasoning");
  if (has(/\b(json|structured)\b/)) f.capability.push("structured_output");
  if (has(/\bpdf\b/)) f.capability.push("pdf_input");
  if (has(/\b(audio|voice|speech)\b/)) f.capability.push("audio_input");
  if (has(/\bfree\b/)) f.free = true;
  if (has(/\b(cheap|cheapest|budget|affordable|low[- ]cost)\b/)) f.sort = "price_in";
  if (has(/\b(newest|latest|recent|new)\b/)) f.sort = "released";
  if (has(/\b(longest|largest|biggest) context\b/)) f.sort = "context";
  const ctx = s.match(/(\d+(?:\.\d+)?)\s*(k|m)\b/);
  if (ctx) f.minContext = Math.round(parseFloat(ctx[1]) * (ctx[2] === "m" ? 1_000_000 : 1_000));
  else if (has(/long context/)) f.minContext = 200_000;
  const price = s.match(/(?:under|below|less than|<)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (price) f.maxInputPrice = parseFloat(price[1]);
  const labWords: Record<string, string> = {
    openai: "openai", gpt: "openai", anthropic: "anthropic", claude: "anthropic", google: "google", gemini: "google",
    meta: "meta-llama", llama: "meta-llama", mistral: "mistralai", xai: "x-ai", grok: "x-ai", deepseek: "deepseek",
    qwen: "qwen", alibaba: "qwen", microsoft: "microsoft", nvidia: "nvidia", cohere: "cohere", amazon: "amazon",
  };
  for (const [w, slug] of Object.entries(labWords)) if (new RegExp(`\\b${w}\\b`).test(s) && !f.lab.includes(slug)) f.lab.push(slug);
  return f;
}

export async function interpret(query: string): Promise<FinderResult> {
  const key = query.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const tried: string[] = [];
  for (const [engine, fn] of [["gemini", askGemini], ["groq", askGroq]] as const) {
    try {
      const parsed = FinderFilters.safeParse(await fn(query));
      if (parsed.success) {
        const result = { filters: parsed.data, engine, tried };
        cache.set(key, result);
        return result;
      }
      tried.push(`${engine}: invalid JSON shape`);
    } catch (err) {
      tried.push(`${engine}: ${String(err).slice(0, 80)}`);
    }
  }
  const result = { filters: ruleParse(query), engine: "rules" as const, tried };
  cache.set(key, result);
  return result;
}

/** Filters -> /models query string */
export function filtersToParams(f: FinderFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.lab.length) p.set("lab", f.lab.join(","));
  if (f.capability.length) p.set("capability", f.capability.join(","));
  if (f.inputModality.length) p.set("inputModality", f.inputModality.join(","));
  if (f.minContext) p.set("minContext", String(f.minContext));
  if (f.maxInputPrice !== undefined) p.set("maxInputPrice", String(f.maxInputPrice));
  if (f.free) p.set("free", "true");
  if (f.sort) p.set("sort", f.sort);
  return p;
}
