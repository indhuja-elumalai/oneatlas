import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/providers -> providers with how many model endpoints they serve
export const GET = handle(async () => {
  const providers = await prisma.provider.findMany({
    include: { _count: { select: { endpoints: true } } },
    orderBy: { endpoints: { _count: "desc" } },
  });
  return ok({ data: providers }, { cache: 300 });
});
