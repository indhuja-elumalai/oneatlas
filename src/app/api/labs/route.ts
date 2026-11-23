import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/labs -> all labs with model counts and latest releases
export const GET = handle(async () => {
  const labs = await prisma.lab.findMany({
    include: {
      _count: { select: { models: true } },
      models: { select: { slug: true, name: true, releasedAt: true }, orderBy: { releasedAt: { sort: "desc", nulls: "last" } }, take: 3 },
    },
    orderBy: { models: { _count: "desc" } },
  });
  return ok({ data: labs }, { cache: 300 });
});
