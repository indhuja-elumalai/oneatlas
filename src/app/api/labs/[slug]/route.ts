import { ApiError, handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { modelSummarySelect } from "@/lib/models";

export const GET = handle<{ params: Promise<{ slug: string }> }>(async (_req, { params }) => {
  const { slug } = await params;
  const lab = await prisma.lab.findUnique({
    where: { slug },
    include: { models: { select: modelSummarySelect, orderBy: { releasedAt: { sort: "desc", nulls: "last" } } } },
  });
  if (!lab) throw new ApiError(404, "LAB_NOT_FOUND", `No lab "${slug}"`);
  return ok(lab, { cache: 300 });
});
