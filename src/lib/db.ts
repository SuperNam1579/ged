import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Query logging is opt-in rather than on for every dev run.
 *
 * Logging every statement is genuinely useful when you are looking at how many
 * round trips a route costs — this database sits behind Supabase's transaction
 * pooler in ap-southeast-1, so each statement is a ~50ms trip and a nested
 * `include` chain turns into one trip per relation level. But that is a thing
 * you want while investigating, not on every request of every session, where it
 * mostly buries the app's own logs.
 *
 *   PRISMA_LOG_QUERIES=1 npm run dev
 */
const logQueries =
  process.env.NODE_ENV === "development" && process.env.PRISMA_LOG_QUERIES === "1";

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logQueries
      ? ["query", "error", "warn"]
      : process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
