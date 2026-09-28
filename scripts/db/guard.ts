/**
 * Stops scripts that write to the database from touching production by accident.
 *
 *   npx tsx scripts/db/guard.ts        # exits 1 when DATABASE_URL is production
 *                                      # and ALLOW_PRODUCTION_DB=1 isn't set
 *
 * Also imported by the seed, the importers and the DB maintenance scripts, which
 * call assertDatabaseWriteAllowed() before their first write.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * On 2026-09-28 someone ran `prisma migrate dev` from an old checkout. It found
 * the schema out of step with its migrations, reset the database, and a seed
 * followed — every learner and every imported clip gone, on the live site,
 * because the only database this project has is the one production uses.
 * Nothing in the repo stood between a routine command and that outcome.
 *
 * Now anything that writes has to be told, explicitly and every time, that it
 * is aimed at production. It is friction by design. The real fix is a separate
 * development database (see .env.example); once one exists this guard never
 * fires during normal work.
 */

import { pathToFileURL } from "node:url";

/**
 * Supabase project refs of production databases. A project ref appears in every
 * connection string and dashboard URL; it is an identifier, not a secret.
 */
const PRODUCTION_DB_REFS = ["dktmjivyrrflnvafnehr"];

export function isProductionDatabase(url = process.env.DATABASE_URL ?? ""): boolean {
  return PRODUCTION_DB_REFS.some((ref) => url.includes(ref));
}

/** Loads .env when the caller hasn't — Prisma reads it for itself, not into process.env. */
function loadEnv(): void {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env (CI, a fresh clone): nothing to guard against.
  }
}

export function assertDatabaseWriteAllowed(action: string): void {
  loadEnv();
  if (!isProductionDatabase()) return;
  if (process.env.ALLOW_PRODUCTION_DB === "1") {
    console.warn(`⚠  ${action}: writing to the PRODUCTION database (ALLOW_PRODUCTION_DB=1).`);
    return;
  }
  console.error(
    [
      "",
      `✋ Refusing to ${action}: DATABASE_URL points at the PRODUCTION database.`,
      "",
      "   This project's live site reads from it directly. If you really mean to",
      "   change production, run the command again with ALLOW_PRODUCTION_DB=1, e.g.",
      "",
      "     ALLOW_PRODUCTION_DB=1 npm run db:push",
      "",
      "   Otherwise point DATABASE_URL and DIRECT_URL at a development database.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

// Run directly (from package.json scripts): check and exit.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  assertDatabaseWriteAllowed(process.argv[2] ?? "write to the database");
}
