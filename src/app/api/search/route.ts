import { z } from "zod";
import { handle, ok, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const query = z.object({ q: z.string().trim().min(1).max(100) });

// GET /api/search?q=claude -> grouped results for the Cmd+K palette
export const GET = handle(async (req) => {
  const { q } = parseQuery(req, query);
  const contains = { contains: q, mode: "insensitive" as const };
  const [models, labs, providers] = await Promise.all([
    prisma.model.findMany({
      where: { OR: [{ name: contains }, { slug: contains }] },
      select: { slug: true, name: true, lab: { select: { name: true } } },
      orderBy: { releasedAt: { sort: "desc", nulls: "last" } },
      take: 8,
    }),
    prisma.lab.findMany({ where: { name: contains }, select: { slug: true, name: true }, take: 4 }),
    prisma.provider.findMany({ where: { name: contains }, select: { slug: true, name: true }, take: 4 }),
  ]);
  return ok({ models, labs, providers });
});
