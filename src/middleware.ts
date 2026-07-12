import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const ALWAYS_PUBLIC_ROUTES = ["/", "/doodle"];

const AUTH_ONLY_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
];

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user?.id;
  const { nextUrl } = req;

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuthRoute) {
    return;
  }

  if (ALWAYS_PUBLIC_ROUTES.includes(nextUrl.pathname)) {
    return;
  }

  if (AUTH_ONLY_ROUTES.includes(nextUrl.pathname)) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/notes", nextUrl));
    }
    return;
  }

  if (!isLoggedIn) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) {
      callbackUrl += nextUrl.search;
    }
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return Response.redirect(
      new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    );
  }

  // Admin-only routes: redirect non-admins even before the page renders.
  // The page component also re-checks this server-side — this is
  // defense-in-depth, not the only gate.
  if (nextUrl.pathname.startsWith("/admin")) {
    if (req.auth?.user?.role !== "ADMIN") {
      return Response.redirect(new URL("/notes", nextUrl));
    }
  }

  return;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
