/**
 * Model query layer. API routes and server components both call these
 * functions, so filtering/sorting logic lives in exactly one place.
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { csv } from "./api";

export const SORT_FIELDS = {
  price_in: "minInputPrice",
  price_out: "minOutputPrice",
  context: "contextLength",
  released: "releasedAt",
  name: "name",
} as const;

export const modelListQuery = z.object({
  q: z.string().max(100).optional(),
  lab: csv, // lab slugs
  provider: csv, // provider slugs
  capability: csv, // ALL must match
  inputModality: csv, // ALL must match
  type: z.enum(["chat", "image", "audio", "video"]).optional(),
  minContext: z.coerce.number().int().min(0).optional(),
  maxInputPrice: z.coerce.number().min(0).optional(), // USD / 1M tokens
  free: z.enum(["true", "false"]).optional(),
  sort: z.enum(Object.keys(SORT_FIELDS) as [keyof typeof SORT_FIELDS, ...(keyof typeof SORT_FIELDS)[]]).default("released"),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
export type ModelListQuery = z.infer<typeof modelListQuery>;

export const modelSummarySelect = {
  id: true,
  slug: true,
  name: true,
  modelType: true,
  contextLength: true,
  maxOutputTokens: true,
  inputModalities: true,
  outputModalities: true,
  capabilities: true,
  releasedAt: true,
  minInputPrice: true,
  minOutputPrice: true,
  isFree: true,
  lab: { select: { slug: true, name: true } },
  _count: { select: { endpoints: true } },
} satisfies Prisma.ModelSelect;

export type ModelSummary = Prisma.ModelGetPayload<{ select: typeof modelSummarySelect }>;

export function buildModelWhere(q: ModelListQuery): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = [];
  if (q.q) {
    and.push({
      OR: [
        { name: { contains: q.q, mode: "insensitive" } },
        { slug: { contains: q.q, mode: "insensitive" } },
        { lab: { name: { contains: q.q, mode: "insensitive" } } },
      ],
    });
  }
  if (q.lab.length) and.push({ lab: { slug: { in: q.lab } } });
  if (q.provider.length) and.push({ endpoints: { some: { provider: { slug: { in: q.provider } } } } });
  if (q.capability.length) and.push({ capabilities: { hasEvery: q.capability } });
  if (q.inputModality.length) and.push({ inputModalities: { hasEvery: q.inputModality } });
  if (q.type) and.push({ modelType: q.type });
  if (q.minContext !== undefined) and.push({ contextLength: { gte: q.minContext } });
  if (q.maxInputPrice !== undefined) and.push({ minInputPrice: { lte: q.maxInputPrice } });
  if (q.free === "true") and.push({ isFree: true });
  return and.length ? { AND: and } : {};
}

export async function listModels(q: ModelListQuery) {
  const where = buildModelWhere(q);
  const field = SORT_FIELDS[q.sort];
  // sensible default direction per field: cheapest first, biggest/newest first
  const order = q.order ?? (q.sort.startsWith("price") || q.sort === "name" ? "asc" : "desc");
  const [total, data] = await prisma.$transaction([
    prisma.model.count({ where }),
    prisma.model.findMany({
      where,
      select: modelSummarySelect,
      // nulls (unknown price/context) always go last so they never top a sort
      orderBy: [{ [field]: { sort: order, nulls: "last" } }, { name: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    data,
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) },
  };
}

export async function getModelBySlug(slug: string) {
  return prisma.model.findUnique({
    where: { slug },
    include: {
      lab: true,
      endpoints: {
        include: {
          provider: { select: { slug: true, name: true } },
          snapshots: { orderBy: { capturedAt: "asc" }, select: { inputPricePer1M: true, outputPricePer1M: true, capturedAt: true } },
        },
        orderBy: { inputPricePer1M: { sort: "asc", nulls: "last" } },
      },
      scores: { include: { benchmark: true }, orderBy: { score: "desc" } },
    },
  });
}

/** Distinct values for filter dropdowns */
export async function getFacets() {
  const [labs, providers, caps, mods] = await Promise.all([
    prisma.lab.findMany({
      select: { slug: true, name: true, _count: { select: { models: true } } },
      orderBy: { models: { _count: "desc" } },
    }),
    prisma.provider.findMany({
      select: { slug: true, name: true, _count: { select: { endpoints: true } } },
      orderBy: { endpoints: { _count: "desc" } },
    }),
    prisma.$queryRaw<{ v: string; n: bigint }[]>`SELECT unnest(capabilities) v, COUNT(*) n FROM "Model" GROUP BY v ORDER BY n DESC`,
    prisma.$queryRaw<{ v: string; n: bigint }[]>`SELECT unnest("inputModalities") v, COUNT(*) n FROM "Model" GROUP BY v ORDER BY n DESC`,
  ]);
  return {
    labs: labs.map((l) => ({ slug: l.slug, name: l.name, count: l._count.models })),
    providers: providers.map((p) => ({ slug: p.slug, name: p.name, count: p._count.endpoints })),
    capabilities: caps.map((c) => ({ value: c.v, count: Number(c.n) })),
    inputModalities: mods.map((m) => ({ value: m.v, count: Number(m.n) })),
  };
}
