/**
 * OneAtlas ingestion pipeline.
 *
 *   npm run sync
 *
 * Sources (all public, every record keeps its source URL):
 *   1. OpenRouter models API  -> canonical model catalog, OpenRouter pricing
 *   2. LiteLLM pricing map     -> per-provider endpoints and prices
 *   3. Aider Polyglot leaderboard -> coding benchmark scores
 *
 * Each source runs as its own IngestionRun: one failing source never
 * blocks the others. Every step is idempotent (upserts), so the script
 * can be re-run on a schedule (Vercel Cron / GitHub Actions).
 */
import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  ModelResolver,
  labFromAuthor,
  normalizeModelKey,
  perMillion,
  providerFromLitellm,
} from "../src/lib/normalize";

const prisma = new PrismaClient();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";
const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const LITELLM_SOURCE =
  "https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json";
const AIDER_URL =
  "https://raw.githubusercontent.com/Aider-AI/aider/main/aider/website/_data/polyglot_leaderboard.yml";
const AIDER_SOURCE = "https://aider.chat/docs/leaderboards/";

// ---------- small utilities ----------

async function fetchWithRetry(url: string, attempts = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "OneAtlas-sync/1.0" } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} (not retried)`);
      return res;
    } catch (err) {
      lastErr = err;
      if (String(err).includes("not retried")) break;
      // exponential backoff with full jitter: 0..(2^i * 500ms)
      await new Promise((r) => setTimeout(r, Math.random() * 2 ** i * 500));
    }
  }
  throw lastErr;
}

/** Run fn over items with bounded concurrency */
async function pMap<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

/**
 * Concurrency-safe "get or create": the first caller for a key starts the
 * upsert, every concurrent caller awaits the SAME promise. Without this,
 * parallel workers race to insert the same new lab/provider and one fails
 * with a unique-constraint error.
 */
function memoAsync<T>(fn: (key: string) => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  return (key: string) => {
    let p = cache.get(key);
    if (!p) {
      p = fn(key);
      cache.set(key, p);
      p.catch(() => cache.delete(key)); // allow a retry after a failure
    }
    return p;
  };
}

const getLabId = memoAsync(async (author: string) => {
  const info = labFromAuthor(author);
  const lab = await prisma.lab.upsert({ where: { slug: info.slug }, update: {}, create: info });
  return lab.id;
});

const getProviderId = memoAsync(async (litellmKey: string) => {
  const p = litellmKey === "openrouter-native" ? { slug: "openrouter", name: "OpenRouter" } : providerFromLitellm(litellmKey);
  const row = await prisma.provider.upsert({
    where: { slug: p.slug },
    update: { name: p.name },
    create: { slug: p.slug, name: p.name, website: p.slug === "openrouter" ? "https://openrouter.ai" : undefined },
  });
  return row.id;
});

type Counters = { fetched: number; upserted: number; skipped: number; errors: string[] };

const isTransient = (err: unknown) =>
  /Can't reach database server|P1001|P1017|ECONNRESET|ETIMEDOUT|fetch failed/i.test(String(err));

async function runStep(source: string, fn: (c: Counters) => Promise<void>) {
  const run = await prisma.ingestionRun.create({ data: { source } });
  let c: Counters = { fetched: 0, upserted: 0, skipped: 0, errors: [] };
  const t0 = Date.now();
  let status = "success";
  // a transient network/DB failure retries the whole step (safe: every write is an upsert)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      c = { fetched: 0, upserted: 0, skipped: 0, errors: [] };
      await fn(c);
      status = c.errors.length ? "partial" : "success";
      break;
    } catch (err) {
      status = "failed";
      c.errors.push(String(err).slice(0, 300));
      if (!isTransient(err) || attempt === 3) break;
      console.log(`[${source}] transient error, retrying (attempt ${attempt + 1}/3)…`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status,
      fetched: c.fetched,
      upserted: c.upserted,
      skipped: c.skipped,
      errors: c.errors.slice(0, 50),
      finishedAt: new Date(),
    },
  });
  console.log(
    `[${source}] ${status} in ${((Date.now() - t0) / 1000).toFixed(1)}s — fetched ${c.fetched}, upserted ${c.upserted}, skipped ${c.skipped}, errors ${c.errors.length}`,
  );
  if (c.errors.length) console.log("  first errors:", c.errors.slice(0, 3));
}

/** Upsert an endpoint and write a PriceSnapshot only when the price changed */
async function upsertEndpoint(data: {
  modelId: string;
  providerId: string;
  externalId: string;
  inputPricePer1M: number | null;
  outputPricePer1M: number | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  source: string;
  sourceUrl: string;
}) {
  const existing = await prisma.modelEndpoint.findUnique({
    where: { providerId_externalId: { providerId: data.providerId, externalId: data.externalId } },
  });
  const ep = await prisma.modelEndpoint.upsert({
    where: { providerId_externalId: { providerId: data.providerId, externalId: data.externalId } },
    update: data,
    create: data,
  });
  const changed =
    !existing ||
    existing.inputPricePer1M !== data.inputPricePer1M ||
    existing.outputPricePer1M !== data.outputPricePer1M;
  if (changed && (data.inputPricePer1M !== null || data.outputPricePer1M !== null)) {
    await prisma.priceSnapshot.create({
      data: {
        endpointId: ep.id,
        inputPricePer1M: data.inputPricePer1M,
        outputPricePer1M: data.outputPricePer1M,
      },
    });
  }
}

async function logAlias(source: string, rawName: string, modelId: string | null, method: string) {
  await prisma.entityAlias.upsert({
    where: { source_rawName: { source, rawName } },
    update: { modelId, method, normKey: normalizeModelKey(rawName) },
    create: { source, rawName, modelId, method, normKey: normalizeModelKey(rawName) },
  });
}

function capabilitiesFromOpenRouter(params: string[], inputMods: string[]): string[] {
  const caps = new Set<string>();
  if (params.includes("tools")) caps.add("tools");
  if (params.includes("reasoning") || params.includes("include_reasoning")) caps.add("reasoning");
  if (params.includes("structured_outputs") || params.includes("response_format"))
    caps.add("structured_output");
  if (params.includes("web_search_options")) caps.add("web_search");
  if (inputMods.includes("image")) caps.add("vision");
  if (inputMods.includes("file")) caps.add("pdf_input");
  if (inputMods.includes("audio")) caps.add("audio_input");
  return [...caps].sort();
}

function capabilitiesFromLitellm(e: Record<string, unknown>): string[] {
  const caps = new Set<string>();
  if (e.supports_function_calling) caps.add("tools");
  if (e.supports_vision) caps.add("vision");
  if (e.supports_reasoning) caps.add("reasoning");
  if (e.supports_response_schema) caps.add("structured_output");
  if (e.supports_web_search) caps.add("web_search");
  if (e.supports_pdf_input) caps.add("pdf_input");
  if (e.supports_audio_input) caps.add("audio_input");
  return [...caps].sort();
}

// ---------- 1. OpenRouter ----------

const OpenRouterModel = z.object({
  id: z.string(),
  name: z.string(),
  created: z.number().optional(),
  description: z.string().optional().nullable(),
  context_length: z.number().optional().nullable(),
  architecture: z
    .object({
      input_modalities: z.array(z.string()).optional(),
      output_modalities: z.array(z.string()).optional(),
    })
    .optional(),
  pricing: z
    .object({ prompt: z.union([z.string(), z.number()]), completion: z.union([z.string(), z.number()]) })
    .partial()
    .optional(),
  top_provider: z
    .object({ max_completion_tokens: z.number().nullable().optional() })
    .partial()
    .optional()
    .nullable(),
  supported_parameters: z.array(z.string()).optional(),
});

async function syncOpenRouter(c: Counters) {
  const res = await fetchWithRetry(OPENROUTER_URL);
  const json = (await res.json()) as { data: unknown[] };
  c.fetched = json.data.length;
  const openrouterProviderId = await getProviderId("openrouter-native");

  await pMap(json.data, 8, async (raw) => {
    const parsed = OpenRouterModel.safeParse(raw);
    if (!parsed.success) {
      c.skipped++;
      c.errors.push(`invalid model: ${JSON.stringify(raw).slice(0, 80)}`);
      return;
    }
    const m = parsed.data;
    // ":free" / ":thinking" etc. are variants of a base model, not new models
    if (m.id.includes(":") || !m.id.includes("/")) {
      c.skipped++;
      return;
    }
    try {
      const [author] = m.id.split("/");
      const labId = await getLabId(author);
      const inputMods = m.architecture?.input_modalities ?? ["text"];
      const outputMods = m.architecture?.output_modalities ?? ["text"];
      const modelData = {
        canonicalKey: normalizeModelKey(m.id),
        // "OpenAI: GPT-4o" -> "GPT-4o"
        name: m.name.includes(": ") ? m.name.split(": ").slice(1).join(": ") : m.name,
        description: m.description ?? null,
        labId,
        modelType: outputMods.includes("image") ? "image" : "chat",
        contextLength: m.context_length ?? null,
        maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
        inputModalities: inputMods,
        outputModalities: outputMods,
        capabilities: capabilitiesFromOpenRouter(m.supported_parameters ?? [], inputMods),
        // OpenRouter's "created" = when the model was listed; a close proxy for release date
        releasedAt: m.created ? new Date(m.created * 1000) : null,
        sourceUrl: `https://openrouter.ai/${m.id}`,
      };
      const model = await prisma.model.upsert({
        where: { slug: m.id },
        update: modelData,
        create: { slug: m.id, ...modelData },
      });
      await upsertEndpoint({
        modelId: model.id,
        providerId: openrouterProviderId,
        externalId: m.id,
        inputPricePer1M: perMillion(m.pricing?.prompt),
        outputPricePer1M: perMillion(m.pricing?.completion),
        contextLength: m.context_length ?? null,
        maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
        source: "openrouter",
        sourceUrl: `https://openrouter.ai/${m.id}`,
      });
      await logAlias("openrouter", m.id, model.id, "exact");
      c.upserted++;
    } catch (err) {
      c.errors.push(`${m.id}: ${String(err).slice(0, 200)}`);
    }
  });
}

// ---------- 2. LiteLLM provider pricing ----------

/** First-party providers: an unmatched model here is still a real model of that lab */
const FIRST_PARTY: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  gemini: "google",
  mistral: "mistralai",
  deepseek: "deepseek",
  xai: "x-ai",
};

async function syncLitellm(c: Counters) {
  const res = await fetchWithRetry(LITELLM_URL);
  const json = (await res.json()) as Record<string, Record<string, unknown>>;
  const entries = Object.entries(json).filter(
    ([key, v]) => key !== "sample_spec" && typeof v === "object" && v?.mode === "chat",
  );
  c.fetched = entries.length;

  // Build matching index from the catalog we already have
  const resolver = new ModelResolver(
    await prisma.model.findMany({ select: { id: true, canonicalKey: true } }),
  );

  const firstPartyEntry = new Map<string, { rawKey: string; entry: Record<string, unknown> }>();
  // first-party models: several raw keys can normalize to the same new model
  // ("gpt-4o", "gpt-4o-2024-08-06") -> create each model exactly once
  const createFirstParty = memoAsync(async (slug: string) => {
    const [author, key] = slug.split("|");
    const e = firstPartyEntry.get(slug)!;
    const caps = capabilitiesFromLitellm(e.entry);
    const created = await prisma.model.upsert({
      where: { slug: `${author}/${key}` },
      update: {},
      create: {
        slug: `${author}/${key}`,
        canonicalKey: key,
        name: e.rawKey.split("/").pop() ?? key,
        labId: await getLabId(author),
        contextLength: (e.entry.max_input_tokens as number) ?? null,
        maxOutputTokens: (e.entry.max_output_tokens as number) ?? null,
        inputModalities: caps.includes("vision") ? ["text", "image"] : ["text"],
        outputModalities: ["text"],
        capabilities: caps,
        sourceUrl: (e.entry.source as string) ?? LITELLM_SOURCE,
      },
    });
    resolver.add(created.id, key);
    return created.id;
  });

  await pMap(entries, 8, async ([rawKey, e]) => {
    try {
      const providerKey = String(e.litellm_provider ?? "unknown");
      const inP = perMillion(e.input_cost_per_token);
      const outP = perMillion(e.output_cost_per_token);
      // LiteLLM uses 0/0 for "unknown" on many entries -> treat as no data
      if ((inP === null || inP === 0) && (outP === null || outP === 0)) {
        c.skipped++;
        return;
      }
      const key = normalizeModelKey(rawKey);
      const hit = resolver.resolve(rawKey);
      let modelId = hit?.id ?? null;
      let method: string = hit?.method ?? "unmatched";

      if (!modelId && FIRST_PARTY[providerKey]) {
        const memoKey = `${FIRST_PARTY[providerKey]}|${key}`;
        if (!firstPartyEntry.has(memoKey)) firstPartyEntry.set(memoKey, { rawKey, entry: e });
        modelId = await createFirstParty(memoKey);
        method = "created_first_party";
      }

      await logAlias("litellm", rawKey, modelId, method);
      if (!modelId) {
        c.skipped++;
        return;
      }

      const providerId = await getProviderId(providerKey);
      await upsertEndpoint({
        modelId,
        providerId,
        externalId: rawKey,
        inputPricePer1M: inP,
        outputPricePer1M: outP,
        contextLength: (e.max_input_tokens as number) ?? null,
        maxOutputTokens: (e.max_output_tokens as number) ?? null,
        source: "litellm",
        sourceUrl: (e.source as string) ?? LITELLM_SOURCE,
      });
      c.upserted++;
    } catch (err) {
      c.errors.push(`${rawKey}: ${String(err).slice(0, 200)}`);
    }
  });
}

// ---------- 3. Aider Polyglot benchmark ----------

const AiderRow = z.object({
  model: z.string(),
  command: z.string().optional(),
  pass_rate_2: z.number(),
  edit_format: z.string().optional(),
  date: z.union([z.string(), z.date()]).optional(),
});

async function syncAider(c: Counters) {
  const res = await fetchWithRetry(AIDER_URL);
  const rows = parseYaml(await res.text()) as unknown[];
  c.fetched = rows.length;
  const bench = await prisma.benchmark.upsert({
    where: { slug: "aider-polyglot" },
    update: {},
    create: {
      slug: "aider-polyglot",
      name: "Aider Polyglot",
      category: "coding",
      description:
        "225 hard Exercism coding exercises across C++, Go, Java, JavaScript, Python and Rust. Score = % solved within two attempts.",
      unit: "%",
      higherIsBetter: true,
      sourceUrl: AIDER_SOURCE,
    },
  });

  const resolver = new ModelResolver(
    await prisma.model.findMany({ select: { id: true, canonicalKey: true } }),
  );

  // A model can appear several times (different settings): keep its best run
  const best = new Map<string, { score: number; raw: string; variant: string; date?: Date }>();
  for (const raw of rows) {
    const r = AiderRow.safeParse(raw);
    if (!r.success) {
      c.skipped++;
      continue;
    }
    const cmdModel = r.data.command?.match(/--model\s+(\S+)/)?.[1];
    const candidates = [cmdModel, r.data.model].filter(Boolean) as string[];
    const hit = candidates.map((s) => resolver.resolve(s)).find(Boolean) ?? null;
    const modelId = hit?.id;
    await logAlias("aider-polyglot", r.data.model, modelId ?? null, hit?.method ?? "unmatched");
    if (!modelId) {
      c.skipped++;
      continue;
    }
    const prev = best.get(modelId);
    if (!prev || r.data.pass_rate_2 > prev.score) {
      best.set(modelId, {
        score: r.data.pass_rate_2,
        raw: r.data.model,
        variant: r.data.edit_format ?? "",
        date: r.data.date ? new Date(r.data.date) : undefined,
      });
    }
  }
  for (const [modelId, b] of best) {
    await prisma.benchmarkScore.upsert({
      where: { benchmarkId_modelId: { benchmarkId: bench.id, modelId } },
      update: { score: b.score, rawModelName: b.raw, variant: b.variant, measuredAt: b.date },
      create: {
        benchmarkId: bench.id,
        modelId,
        score: b.score,
        rawModelName: b.raw,
        variant: b.variant,
        measuredAt: b.date,
        sourceUrl: AIDER_SOURCE,
      },
    });
    c.upserted++;
  }
}

// ---------- 4. Denormalize cheapest price per model ----------

async function recomputeMinPrices() {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "Model" m SET
      "minInputPrice"  = sub.min_in,
      "minOutputPrice" = sub.min_out,
      "isFree"         = (sub.min_in = 0 AND sub.min_out = 0)
    FROM (
      SELECT "modelId",
             MIN("inputPricePer1M")  AS min_in,
             MIN("outputPricePer1M") AS min_out
      FROM "ModelEndpoint"
      WHERE "inputPricePer1M" IS NOT NULL
      GROUP BY "modelId"
    ) sub
    WHERE m.id = sub."modelId"`);
  console.log("[prices] recomputed cheapest price per model");
}

async function main() {
  const t0 = Date.now();
  // `npm run sync` runs everything; `npm run sync -- aider` runs only matching steps
  const only = process.argv.slice(2).map((a) => a.toLowerCase());
  const steps: [string, (c: Counters) => Promise<void>][] = [
    ["openrouter", syncOpenRouter],
    ["litellm", syncLitellm],
    ["aider-polyglot", syncAider],
  ];
  for (const [name, fn] of steps) {
    if (only.length && !only.some((o) => name.includes(o))) continue;
    await runStep(name, fn);
  }
  await recomputeMinPrices();
  const [models, endpoints, labs, providers, scores] = await Promise.all([
    prisma.model.count(),
    prisma.modelEndpoint.count(),
    prisma.lab.count(),
    prisma.provider.count(),
    prisma.benchmarkScore.count(),
  ]);
  console.log(
    `\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${models} models, ${endpoints} endpoints, ${labs} labs, ${providers} providers, ${scores} benchmark scores`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
