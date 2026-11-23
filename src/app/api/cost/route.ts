import { z } from "zod";
import { Prisma } from "@prisma/client";
import { csv, handle, ok, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const query = z.object({
  input: z.coerce.number().min(0).max(1e13).default(10_000_000), // tokens / month
  output: z.coerce.number().min(0).max(1e13).default(2_000_000),
  capability: csv,
  minContext: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// GET /api/cost?input=10000000&output=2000000&capability=tools&minContext=128000
// Ranks models by monthly cost for this workload, using each model's cheapest provider.
// Done in SQL so it scales to every endpoint without loading them into memory.
export const GET = handle(async (req) => {
  const q = parseQuery(req, query);
  const caps = q.capability.length ? Prisma.sql`AND m.capabilities @> ${q.capability}::text[]` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { slug: string; name: string; lab: string; provider: string; providerSlug: string; inPrice: number; outPrice: number; context: number | null; monthly: number }[]
  >(Prisma.sql`
    SELECT * FROM (
    SELECT DISTINCT ON (m.id) m.slug, m.name, l.name AS lab, p.name AS provider, p.slug AS "providerSlug",
           e."inputPricePer1M" AS "inPrice", e."outputPricePer1M" AS "outPrice",
           COALESCE(e."contextLength", m."contextLength") AS context,
           (e."inputPricePer1M" * ${q.input} + e."outputPricePer1M" * ${q.output}) / 1000000.0 AS monthly
    FROM "ModelEndpoint" e
    JOIN "Model" m ON m.id = e."modelId"
    JOIN "Lab" l ON l.id = m."labId"
    JOIN "Provider" p ON p.id = e."providerId"
    WHERE e."inputPricePer1M" IS NOT NULL AND e."outputPricePer1M" IS NOT NULL
      AND (e."inputPricePer1M" + e."outputPricePer1M") > 0
      AND COALESCE(e."contextLength", m."contextLength", 0) >= ${q.minContext}
      ${caps}
    ORDER BY m.id, monthly ASC
    ) cheapest_per_model
    ORDER BY monthly ASC
    LIMIT ${q.limit}`);
  return ok({ input: q.input, output: q.output, data: rows.map((r) => ({ ...r, monthly: Number(r.monthly) })) });
});
