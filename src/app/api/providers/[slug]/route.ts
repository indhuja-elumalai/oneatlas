import { ApiError, handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const GET = handle<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const { slug } = await params;
  const provider = await prisma.provider.findUnique({
    where: { slug },
    include: {
      endpoints: {
        include: { model: { select: { slug: true, name: true, contextLength: true, lab: { select: { name: true, slug: true } } } } },
        orderBy: { inputPricePer1M: { sort: "asc", nulls: "last" } },
      },
    },
  });
  if (!provider) throw new ApiError(404, "PROVIDER_NOT_FOUND", `No provider "${slug}"`);
  return ok(provider, { cache: 300 });
});
