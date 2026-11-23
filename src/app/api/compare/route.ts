import { z } from "zod";
import { ApiError, csv, handle, ok, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const query = z.object({ models: csv });

// GET /api/compare?models=openai/gpt-4o,anthropic/claude-sonnet-4  (2-4 models)
export const GET = handle(async (req) => {
  const { models: slugs } = parseQuery(req, query);
  if (slugs.length < 2 || slugs.length > 4)
    throw new ApiError(400, "INVALID_COMPARISON", "Compare between 2 and 4 models");
  const models = await prisma.model.findMany({
    where: { slug: { in: slugs } },
    include: {
      lab: { select: { slug: true, name: true } },
      endpoints: {
        select: { inputPricePer1M: true, outputPricePer1M: true, provider: { select: { slug: true, name: true } } },
        orderBy: { inputPricePer1M: { sort: "asc", nulls: "last" } },
      },
      scores: { include: { benchmark: { select: { slug: true, name: true, unit: true } } } },
    },
  });
  const missing = slugs.filter((s) => !models.some((m) => m.slug === s));
  if (missing.length) throw new ApiError(404, "MODEL_NOT_FOUND", "Some models were not found", { missing });
  // keep the order the user asked for
  return ok({ models: slugs.map((s) => models.find((m) => m.slug === s)!) }, { cache: 60 });
});
