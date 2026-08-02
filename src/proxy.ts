import { NextResponse } from "next/server";

// Renamed from `middleware.ts` in Next.js 16 — Middleware is now called Proxy.
// The functionality is identical; only the file name and export changed.
export function proxy() {
  // Login wall disabled for local testing: allow all routes!
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
