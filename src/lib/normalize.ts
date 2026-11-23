/**
 * Entity resolution helpers.
 *
 * Every source names the same model differently:
 *   OpenRouter: "anthropic/claude-sonnet-4"
 *   LiteLLM:    "claude-sonnet-4-20250514", "bedrock/us.anthropic.claude-sonnet-4-20250514-v1:0"
 *   Aider:      "aider --model anthropic/claude-sonnet-4-20250514"
 * normalizeModelKey() reduces all of these to one key: "claude-sonnet-4".
 */

const REGION_OR_VENDOR_PREFIX =
  /^(?:(?:us|eu|apac|global|jp|au)\.)?(?:anthropic|meta|mistral|amazon|cohere|ai21|deepseek|qwen|openai|writer)\./;

export function normalizeModelKey(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.split("/").pop() ?? s; // keep last path segment
  s = s.replace(REGION_OR_VENDOR_PREFIX, "");
  s = s.replace(/:(free|beta|extended|thinking|nitro|floor|online)$/, "");
  s = s.replace(/-v\d+(?::\d+)?$/, ""); // bedrock "-v1:0"
  s = s.replace(/@\d{8}$/, ""); // vertex "@20240620"
  s = s.replace(/-\d{4}-\d{2}-\d{2}$/, ""); // "-2024-08-06"
  s = s.replace(/-\d{8}$/, ""); // "-20250514"
  s = s.replace(/-latest$/, "");
  s = s.replace(/\./g, "-"); // "claude-3.5-sonnet" == "claude-3-5-sonnet"
  s = s.replace(/_/g, "-");
  s = s.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s;
}

/**
 * Second-pass key: also drops deployment/marketing suffixes that providers add
 * ("-instruct-turbo", "-versatile", "-preview-03-25"). Only used when the
 * strict key finds nothing, and only if the loose key is unambiguous.
 */
export function looseModelKey(raw: string): string {
  return normalizeModelKey(raw)
    .replace(/-(\d{2}-\d{2}|\d{4})$/, "") // trailing short dates "-03-25", "-0528"
    .split("-")
    .filter((t) => !["instruct", "turbo", "versatile", "beta", "preview", "exp", "chat", "fp8", "hf", "it"].includes(t))
    .join("-");
}

/** Index for resolving raw names -> model ids: strict match first, then unique loose match */
export class ModelResolver {
  private strict = new Map<string, string>();
  private loose = new Map<string, string | null>(); // null = ambiguous

  constructor(models: { id: string; canonicalKey: string }[]) {
    for (const m of models) this.add(m.id, m.canonicalKey);
  }

  add(id: string, canonicalKey: string) {
    if (!this.strict.has(canonicalKey)) this.strict.set(canonicalKey, id);
    const lk = looseModelKey(canonicalKey);
    const prev = this.loose.get(lk);
    this.loose.set(lk, prev === undefined || prev === id ? id : null);
  }

  resolve(raw: string): { id: string; method: "normalized" | "loose" } | null {
    const s = this.strict.get(normalizeModelKey(raw));
    if (s) return { id: s, method: "normalized" };
    const l = this.loose.get(looseModelKey(raw));
    if (l) return { id: l, method: "loose" };
    return null;
  }
}

/** OpenRouter author slug -> display name for labs */
const LAB_NAMES: Record<string, { name: string; website?: string }> = {
  openai: { name: "OpenAI", website: "https://openai.com" },
  anthropic: { name: "Anthropic", website: "https://www.anthropic.com" },
  google: { name: "Google", website: "https://deepmind.google" },
  "meta-llama": { name: "Meta", website: "https://ai.meta.com" },
  mistralai: { name: "Mistral AI", website: "https://mistral.ai" },
  "x-ai": { name: "xAI", website: "https://x.ai" },
  deepseek: { name: "DeepSeek", website: "https://www.deepseek.com" },
  qwen: { name: "Qwen (Alibaba)", website: "https://qwenlm.github.io" },
  microsoft: { name: "Microsoft", website: "https://www.microsoft.com/ai" },
  nvidia: { name: "NVIDIA", website: "https://www.nvidia.com" },
  cohere: { name: "Cohere", website: "https://cohere.com" },
  amazon: { name: "Amazon", website: "https://aws.amazon.com/bedrock" },
  moonshotai: { name: "Moonshot AI", website: "https://www.moonshot.ai" },
  "z-ai": { name: "Z.ai", website: "https://z.ai" },
  minimax: { name: "MiniMax", website: "https://www.minimax.io" },
  perplexity: { name: "Perplexity", website: "https://www.perplexity.ai" },
  nousresearch: { name: "Nous Research", website: "https://nousresearch.com" },
  ai21: { name: "AI21 Labs", website: "https://www.ai21.com" },
  inflection: { name: "Inflection AI" },
  liquid: { name: "Liquid AI" },
  baidu: { name: "Baidu" },
  tencent: { name: "Tencent" },
  bytedance: { name: "ByteDance" },
  "bytedance-seed": { name: "ByteDance Seed" },
  ibm: { name: "IBM" },
  "ibm-granite": { name: "IBM" },
  allenai: { name: "Allen Institute for AI", website: "https://allenai.org" },
};

export function labFromAuthor(author: string): { slug: string; name: string; website?: string } {
  const known = LAB_NAMES[author];
  if (known) return { slug: author, ...known };
  const name = author
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { slug: author, name };
}

/** LiteLLM provider key -> display name */
const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google AI Studio",
  vertex_ai: "Google Vertex AI",
  "vertex_ai-language-models": "Google Vertex AI",
  "vertex_ai-anthropic_models": "Google Vertex AI",
  bedrock: "Amazon Bedrock",
  bedrock_converse: "Amazon Bedrock",
  azure: "Azure OpenAI",
  azure_ai: "Azure AI Foundry",
  groq: "Groq",
  together_ai: "Together AI",
  fireworks_ai: "Fireworks AI",
  deepinfra: "DeepInfra",
  mistral: "Mistral AI",
  deepseek: "DeepSeek",
  xai: "xAI",
  cohere_chat: "Cohere",
  perplexity: "Perplexity",
  cerebras: "Cerebras",
  sambanova: "SambaNova",
  novita: "Novita AI",
  openrouter: "OpenRouter",
  replicate: "Replicate",
  nscale: "Nscale",
  hyperbolic: "Hyperbolic",
  lambda_ai: "Lambda",
  moonshot: "Moonshot AI",
  dashscope: "Alibaba DashScope",
};

/** Several LiteLLM keys are the same real provider (bedrock vs bedrock_converse) */
const PROVIDER_MERGE: Record<string, string> = {
  bedrock_converse: "bedrock",
  "vertex_ai-language-models": "vertex_ai",
  "vertex_ai-anthropic_models": "vertex_ai",
  cohere_chat: "cohere",
};

export function providerFromLitellm(key: string): { slug: string; name: string } {
  const slug = (PROVIDER_MERGE[key] ?? key).replace(/_/g, "-");
  const name =
    PROVIDER_NAMES[key] ??
    key
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  return { slug, name };
}

/** USD per token (string or number) -> USD per 1M tokens, rounded to 6 dp */
export function perMillion(perToken: unknown): number | null {
  const n = typeof perToken === "string" ? Number(perToken) : (perToken as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1_000_000 * 1e6) / 1e6;
}
