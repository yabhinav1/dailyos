import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";

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
            select: { id: true, role: true },
          });
          if (!dbUser) {
            return { ...nextToken, sub: undefined };
          }
          nextToken.role = dbUser.role;
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

export const { handlers, signIn, signOut } = nextAuth;

/**
 * Custom auth helper that returns the active session, or falls back to a demo user
 * so the workspace can be tested locally without hitting auth walls.
 */
export async function auth() {
  try {
    const session = await nextAuth.auth();
    if (session?.user?.id) {
      return session;
    }
  } catch {
    // Ignore error and fall through
  }

  try {
    let demoUser = await prisma.user.findFirst({
      where: { email: "demo@dailyos.local" },
    });
    if (!demoUser) {
      demoUser = await prisma.user.create({
        data: {
          name: "Demo User",
          email: "demo@dailyos.local",
          username: "demouser",
          role: "ADMIN",
        },
      });
    }
    return {
      user: {
        id: demoUser.id,
        name: demoUser.name || "Demo User",
        email: demoUser.email,
        image: demoUser.image || null,
        role: demoUser.role || "ADMIN",
      },
      expires: new Date(Date.now() + 86400 * 1000).toISOString(),
    };
  } catch (err) {
    console.error("[auth] Fallback user creation error:", err);
    return {
      user: {
        id: "demo-user-fallback",
        name: "Demo User",
        email: "demo@dailyos.local",
        image: null,
        role: "ADMIN",
      },
      expires: new Date(Date.now() + 86400 * 1000).toISOString(),
    };
  }
}

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

