import { z } from "zod";
import { handle, ok, parseQuery } from "@/lib/api";
import { filtersToParams, interpret } from "@/lib/finder";

const query = z.object({ q: z.string().trim().min(2).max(300) });

// GET /api/finder?q=cheap vision model with 128k context
// -> { filters, engine, href }  (engine = gemini | groq | rules)
export const GET = handle(async (req) => {
  const { q } = parseQuery(req, query);
  const result = await interpret(q);
  return ok({ ...result, href: `/models?${filtersToParams(result.filters)}` });
});
