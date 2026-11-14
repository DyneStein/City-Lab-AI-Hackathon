import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth/session";

/** Wrap a route handler: maps HttpError to JSON, hides internals for everything else. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[api] unhandled", (e as Error).message);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  };
}

/**
 * Redirect with a relative Location. Behind the phone HTTPS entrance or a 0.0.0.0 bind,
 * req.url can contain an internal host (e.g. 0.0.0.0) that a phone cannot open.
 */
export const redirectTo = (path: string) => new NextResponse(null, { status: 307, headers: { location: path } });
