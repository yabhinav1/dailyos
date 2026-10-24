import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  // Prisma Accelerate / Prisma Postgres URLs start with "prisma+postgres://"
  // Standard PostgreSQL URLs start with "postgresql://" or "postgres://"
  if (url.startsWith("prisma+postgres://") || url.startsWith("prisma://")) {
    // Use Prisma Accelerate mode
    return new PrismaClient({ accelerateUrl: url });
  }

  // Standard PostgreSQL: use pg driver adapter.
  // Neon (and most serverless Postgres) suspends idle compute and can drop
  // pooled connections out from under you. An unhandled 'error' event on a
  // pg Pool crashes the whole Node process, not just the in-flight request
  // — this was silently taking down the app on any request that hit a
  // stale/dropped connection (e.g. clicking the bell or account menu after
  // the app had been idle for a bit).
  const pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", (err) => {
    console.error("[prisma] idle pg client error (recovered):", err.message);
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
   
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Created on first use, not at import. `next build` imports every route to
// collect page data, so an eager client made the build itself require
// DATABASE_URL — any environment without it (CI, previews) failed outright.
function getClient() {
  globalThis.prismaGlobal ??= prismaClientSingleton();
  return globalThis.prismaGlobal;
}

export const prisma = new Proxy({} as ReturnType<typeof prismaClientSingleton>, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
