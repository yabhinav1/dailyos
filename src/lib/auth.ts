import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const { token, user } = params;
      const nextToken = await authConfig.callbacks.jwt(params);
      const userId = user?.id ?? nextToken.sub;

      if (userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
          });
          if (!dbUser) {
            // User was deleted: invalidate identity claims but return a
            // well-formed token (not {}) so downstream code that reads
            // token.sub etc. never has to deal with a malformed shape.
            return { ...nextToken, sub: undefined };
          }
          // Re-verify role from the DB on every refresh (not just at
          // login) so revoking admin access takes effect on the user's
          // very next request instead of only after they sign out.
          nextToken.role = dbUser.role;
        } catch (err) {
          // Transient DB/connection error (e.g. Neon pool cold-start).
          // Do NOT throw here — an uncaught error in this callback bubbles
          // out of the /api/auth/session route and crashes the whole app
          // shell on the client (this was the cause of the bell/account
          // icon crash). Fail soft: keep the existing token for this
          // request and let the next request retry the DB check.
          console.error("[auth.jwt] user existence check failed:", err);
          return nextToken;
        }
      }
      return nextToken;
    },
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const identifier = credentials.email as string;
        const password = credentials.password as string;

        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
        const user = await prisma.user.findUnique({
          where: isEmail ? { email: identifier } : { username: identifier },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
});

/**
 * Server-side helper: throws if the current session user is not an admin.
 * Use at the top of any admin-only server action or API route.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden: admin access required");
  }
  return session.user;
}
