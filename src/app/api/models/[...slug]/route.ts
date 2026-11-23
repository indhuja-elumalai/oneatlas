import { ApiError, handle, ok } from "@/lib/api";
import { getModelBySlug } from "@/lib/models";

// GET /api/models/openai/gpt-4o  (model slugs contain a "/", hence the catch-all)
export const GET = handle<{ params: Promise<{ slug: string[] }> }>(async (_req, { params }) => {
  const { slug } = await params;
  const model = await getModelBySlug(slug.join("/"));
  if (!model) throw new ApiError(404, "MODEL_NOT_FOUND", `No model with slug "${slug.join("/")}"`);
  return ok(model, { cache: 60 });
});
