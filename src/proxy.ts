import { NextResponse, type NextRequest } from "next/server";

// Renamed from `middleware.ts` in Next.js 16 — Middleware is now called Proxy.
// The functionality is identical; only the file name and export changed.
//
// This is an OPTIMISTIC check only. It runs on every request including
// prefetches, so it reads the session cookie and nothing else — no database,
// no token verification. The authoritative check lives in the (dashboard)
// layout, which resolves the real session server-side. Never treat this file
// as the security boundary on its own.

// Routes a signed-out visitor is allowed to reach. Everything else redirects
// to /login. "/" is deliberately public: it serves the guest notes workspace
// that saves to localStorage until someone signs in.
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/doodle",
];

// next-auth v5 names its cookie `authjs.session-token`, prefixed with
// `__Secure-` once it is issued over HTTPS.
function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === "authjs.session-token" ||
        cookie.name === "__Secure-authjs.session-token"
    );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  // Remember where they were headed so login can send them back.
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
