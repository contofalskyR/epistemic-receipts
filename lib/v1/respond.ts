import { NextResponse } from "next/server";
import type { Rfc7807Error } from "./auth";

type CacheMode = "detail" | "list" | "static" | "dynamic";

const CACHE_HEADERS: Record<CacheMode, string> = {
  detail: "public, s-maxage=3600, stale-while-revalidate=86400",
  list: "public, s-maxage=300, stale-while-revalidate=3600",
  static: "public, s-maxage=86400, stale-while-revalidate=604800",
  dynamic: "no-store",
};

export function v1Json(
  data: unknown,
  opts: {
    status?: number;
    cache?: CacheMode;
    etag?: string;
    extraHeaders?: Record<string, string>;
  } = {},
): NextResponse {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.extraHeaders ?? {}),
  };

  if (opts.cache) {
    headers["Cache-Control"] = CACHE_HEADERS[opts.cache];
  }
  if (opts.etag) {
    headers["ETag"] = `"${opts.etag}"`;
  }

  return NextResponse.json(data, { status: opts.status ?? 200, headers });
}

export function v1Error(err: Rfc7807Error, extraHeaders?: Record<string, string>): NextResponse {
  return NextResponse.json(err, {
    status: err.status,
    headers: { "Content-Type": "application/problem+json", ...extraHeaders },
  });
}

export function methodNotAllowed(): NextResponse {
  return v1Error({
    type: "https://epistemic-receipts.app/errors/method-not-allowed",
    title: "Method Not Allowed",
    status: 405,
    detail: "This endpoint only accepts GET requests.",
  });
}

export function notFound(detail = "Resource not found."): NextResponse {
  return v1Error({
    type: "https://epistemic-receipts.app/errors/not-found",
    title: "Not Found",
    status: 404,
    detail,
  });
}

export function badRequest(detail: string): NextResponse {
  return v1Error({
    type: "https://epistemic-receipts.app/errors/bad-request",
    title: "Bad Request",
    status: 400,
    detail,
  });
}

export function serverError(detail = "An unexpected error occurred."): NextResponse {
  return v1Error({
    type: "https://epistemic-receipts.app/errors/internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail,
  });
}
