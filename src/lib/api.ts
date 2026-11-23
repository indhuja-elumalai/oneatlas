import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

/** Consistent error envelope for every API route: { error: { code, message, details? } } */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: { cache?: number }) {
  return NextResponse.json(data, {
    headers: init?.cache
      ? { "Cache-Control": `public, s-maxage=${init.cache}, stale-while-revalidate=${init.cache * 5}` }
      : undefined,
  });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: turns validation / not-found / DB errors into clean JSON responses */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status },
        );
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: { code: "INVALID_QUERY", message: "Invalid query parameters", details: z.flattenError(err).fieldErrors } },
          { status: 400 },
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        console.error("[db]", err.code, err.message);
        return NextResponse.json(
          { error: { code: "DB_ERROR", message: "Database request failed" } },
          { status: 500 },
        );
      }
      console.error("[api] unhandled", err);
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Something went wrong" } },
        { status: 500 },
      );
    }
  };
}

/** Parse URLSearchParams with a zod schema (repeated keys and comma lists both supported) */
export function parseQuery<S extends z.ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const params = new URL(req.url).searchParams;
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
    obj[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return schema.parse(obj);
}

/** Accepts "a", "a,b" or ["a","b"] and always returns string[] */
export const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]));
