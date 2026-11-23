import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const GET = handle(async () => {
  const data = await prisma.benchmark.findMany({ include: { _count: { select: { scores: true } } } });
  return ok({ data }, { cache: 300 });
});
