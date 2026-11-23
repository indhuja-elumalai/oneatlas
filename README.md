# OneAtlas — AI Model Discovery & Intelligence Platform

Discover, compare and evaluate AI models across labs and providers — built on **real, continuously synced data**, not mock data.

**Stack:** Next.js 15 (App Router) · TypeScript · TailwindCSS · PostgreSQL (Neon) · Prisma · Zod · Vercel

## Features

- **Model discovery**: search, filter by lab, provider, capability, modality, context and price; sort by price, context or release date; everything kept in the URL, so any view can be shared.
- **✦ Plain-English model finder**: "cheap vision model with 128k context" → the LLM turns the sentence into filters and **the database answers**, so the AI can never invent a model. Fallback chain: **Gemini → Groq → deterministic rule parser**, with timeouts. The UI shows which engine answered.
- **Model detail pages**: specs, capabilities, modalities, every provider's price for that model (with "cheapest provider is X% cheaper"), price-history sparklines and benchmark scores with source links.
- **Compare**: 2–4 models side by side, with the best value in each row highlighted. Shareable `/compare?m=a,b` URLs, plus a floating compare tray across the site.
- **Rankings**: benchmark leaderboard, filterable by lab, with a **Best value** view (score per blended $/1M).
- **Cost calculator**: enter a monthly token workload and rank every model by monthly cost on its cheapest provider (computed in SQL).
- **Labs and Providers directories**, **⌘K global search**, responsive layouts, loading, error and empty states.

## Architecture

```
 OpenRouter API ─┐
 LiteLLM prices ─┼─► scripts/sync.ts ──► PostgreSQL (Neon) ◄── src/lib/models.ts (query layer)
 Aider bench   ──┘   validate (Zod)            ▲                     │            │
                     normalize $/1M            │            API routes (/api/*)  Server components
                     resolve entities     IngestionRun,              │            │
                     upsert + snapshots   EntityAlias logs      client widgets ◄──┘
                                                                (⌘K, compare, calculator, finder)
 GitHub Actions cron (every 6h) ──► npm run sync
```

- **Server components** render pages straight from the shared query layer (no client waterfalls, SEO-friendly). **Interactive widgets** (⌘K, calculator, compare picker) call the public JSON API.
- API responses set `s-maxage` / `stale-while-revalidate` so Vercel's edge cache serves repeated queries.

## Quick start

```bash
npm install
cp .env.example .env        # paste your Neon connection strings
npm run db:push             # create tables
npm run sync                # ingest real data (~2-5 min)
npm run dev                 # http://localhost:3000
```

## Data pipeline (`scripts/sync.ts`)

| Source | What it gives | Stored as |
|---|---|---|
| OpenRouter models API | canonical catalog, modalities, context, capabilities, prices | `Model`, `Lab`, `ModelEndpoint` |
| LiteLLM pricing map | per-provider prices (Bedrock, Azure, Groq, Together, Fireworks…) | `Provider`, `ModelEndpoint` |
| Aider Polyglot leaderboard | coding benchmark scores | `Benchmark`, `BenchmarkScore` |

- Every source runs as its own `IngestionRun` (status, counts, errors) — one failing source never blocks the others.
- All writes are idempotent upserts, so the sync can run on a schedule.
- Every record keeps a `sourceUrl`.
- Prices are normalized to **USD per 1M tokens**. A `PriceSnapshot` row is written only when a price changes → price history.

### Entity resolution
Each source names models differently (`anthropic/claude-sonnet-4`, `bedrock/us.anthropic.claude-sonnet-4-20250514-v1:0`, `claude-sonnet-4-20250514`). `src/lib/normalize.ts` resolves them in two passes:
1. **Strict key** — strip provider paths, region prefixes, date stamps, version tags, `.`→`-`.
2. **Loose key** — also drop deployment suffixes (`-instruct-turbo`, `-versatile`, `-preview-06-05`), used **only if unambiguous**.

Every decision is logged in `EntityAlias` (raw name → model, method), so matching is auditable.

## Key design decision: pricing lives on endpoints
The same model is sold by many providers at different prices and limits, so price is a property of **model × provider** (`ModelEndpoint`), not of the model. `Model.minInputPrice` is a denormalized "from $X" value, recomputed after each sync, so list pages sort fast without joins.

## API

All routes validate input with Zod and return a consistent error envelope `{ error: { code, message, details } }`.

| Route | Purpose |
|---|---|
| `GET /api/models` | search, filter (`lab`, `provider`, `capability`, `inputModality`, `type`, `minContext`, `maxInputPrice`, `free`), sort (`price_in`, `price_out`, `context`, `released`, `name`), paginate |
| `GET /api/models/{lab}/{model}` | full detail: endpoints, price history, benchmarks |
| `GET /api/compare?models=a,b` | 2–4 models side by side |
| `GET /api/rankings?benchmark=aider-polyglot` | leaderboard, filterable by lab |
| `GET /api/labs`, `/api/labs/{slug}` | lab directory |
| `GET /api/providers`, `/api/providers/{slug}` | provider directory |
| `GET /api/search?q=` | grouped results for Cmd+K |
| `GET /api/facets` | filter values with counts |
| `GET /api/finder?q=` | plain English → validated filters (Gemini → Groq → rules) |
| `GET /api/cost?input=&output=&capability=&minContext=` | models ranked by monthly cost for a workload |

## What I'd build next
- Plug in the GraphOne ingestion pipeline (research papers, GitHub stars, news) so each model page links to its paper and repo
- More benchmark sources (LMArena, SWE-bench), and latency/throughput per provider
- `pg_trgm` fuzzy search, and API keys with rate limits for the public API
