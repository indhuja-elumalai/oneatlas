import { handle, ok } from "@/lib/api";
import { getFacets } from "@/lib/models";

// GET /api/facets -> values + counts for every filter dropdown
export const GET = handle(async () => ok(await getFacets(), { cache: 300 }));
