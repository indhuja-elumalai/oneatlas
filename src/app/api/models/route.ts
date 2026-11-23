import { handle, ok, parseQuery } from "@/lib/api";
import { listModels, modelListQuery } from "@/lib/models";

// GET /api/models?q=&lab=openai,anthropic&provider=groq&capability=tools,vision
//   &inputModality=image&minContext=128000&maxInputPrice=1&sort=price_in&order=asc&page=1&pageSize=24
export const GET = handle(async (req) => {
  const query = parseQuery(req, modelListQuery);
  return ok(await listModels(query), { cache: 60 });
});
