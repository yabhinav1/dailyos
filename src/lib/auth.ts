import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { MAX_FAILED_LOGINS, lockoutExpiry } from "@/lib/otp";
import { authConfig } from "@/lib/auth.config";
import { purgeAccount } from "@/lib/account-purge";

const nextAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const { user } = params;
      const nextToken = await authConfig.callbacks.jwt(params);
      const userId = user?.id ?? nextToken.sub;

      if (userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              role: true,
              name: true,
              image: true,
              deletionScheduledAt: true,
            },
          });
          if (!dbUser) {
            return { ...nextToken, sub: undefined };
          }

          // Deletion is carried out on first access after the grace period
          // rather than by a scheduler. Every app relation cascades from the
          // user row, so this removes everything with it.
          if (dbUser.deletionScheduledAt && dbUser.deletionScheduledAt <= new Date()) {
            await purgeAccount(dbUser.id);
            return { ...nextToken, sub: undefined };
          }
          nextToken.role = dbUser.role;
          nextToken.name = dbUser.name;

          // This token is serialised into a cookie. An uploaded avatar is a
          // data URL that can run to two megabytes, which blows past the 4KB
          // cookie limit and gets split into dozens of chunks — enough to
          // break the session outright and to put megabytes of cookie on every
          // single request. Stored avatars are served by URL instead.
          nextToken.picture = dbUser.image?.startsWith("data:")
            ? `/api/avatar/${dbUser.id}`
            : dbUser.image;
        } catch (err) {
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

        // Refuse while locked out, without saying so — an attacker learns
        // nothing from a locked account that a wrong password doesn't tell
        // them, and the real owner is told by email-free UI copy on the form.
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        // Past the grace period the account no longer exists, so signing in
        // has to remove it rather than hand back a session for dead data.
        if (user.deletionScheduledAt && user.deletionScheduledAt <= new Date()) {
          await purgeAccount(user.id);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          // Lock the account for a spell once the failures pile up, so an
          // online guessing run against one account cannot simply continue.
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data:
              failed >= MAX_FAILED_LOGINS
                ? { failedLogins: 0, lockedUntil: lockoutExpiry() }
                : { failedLogins: failed },
          });
          return null;
        }

        if (user.failedLogins > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLogins: 0, lockedUntil: null },
          });
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

export const { handlers, signIn, signOut, auth } = nextAuth;

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

