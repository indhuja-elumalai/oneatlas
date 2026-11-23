import { z } from "zod";
import { ApiError, csv, handle, ok, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const query = z.object({
  benchmark: z.string().default("aider-polyglot"),
  lab: csv,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// GET /api/rankings?benchmark=aider-polyglot&lab=openai,anthropic&limit=50
export const GET = handle(async (req) => {
  const q = parseQuery(req, query);
  const benchmark = await prisma.benchmark.findUnique({ where: { slug: q.benchmark } });
  if (!benchmark) throw new ApiError(404, "BENCHMARK_NOT_FOUND", `No benchmark "${q.benchmark}"`);
  const scores = await prisma.benchmarkScore.findMany({
    where: { benchmarkId: benchmark.id, ...(q.lab.length ? { model: { lab: { slug: { in: q.lab } } } } : {}) },
    include: {
      model: { select: { slug: true, name: true, minInputPrice: true, minOutputPrice: true, lab: { select: { slug: true, name: true } } } },
    },
    orderBy: { score: benchmark.higherIsBetter ? "desc" : "asc" },
    take: q.limit,
  });
  return ok({ benchmark, data: scores.map((s, i) => ({ rank: i + 1, ...s })) }, { cache: 300 });
});
