/**
 * Turns on Row Level Security for every table in the public schema.
 *
 *   npx tsx scripts/db/enable-rls.ts            # apply
 *   npx tsx scripts/db/enable-rls.ts --check    # report only; exits 1 if any table is open
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Supabase exposes every public-schema table through PostgREST to anyone who
 * holds the project's anon key, and a table without RLS is readable and
 * writable that way — including User, with its password hashes and reset
 * tokens. The app never goes through PostgREST: Prisma connects as the table
 * owner, and plain ENABLE (not FORCE) lets the owner bypass RLS, so this
 * changes nothing for the app. With no policies defined, the anon and
 * authenticated roles are simply denied.
 *
 * The old migration listed tables by name. That list silently went stale every
 * time a table was added, and a database rebuilt from scratch on 2026-09-28
 * came up with RLS off everywhere. Asking Postgres for the table list instead
 * means a new table can't be missed. `npm run db:push` runs this afterwards.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const tables = await db.$queryRaw<{ name: string; rls: boolean }[]>`
    SELECT c.relname AS name, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname`;

  const open = tables.filter((t) => !t.rls).map((t) => t.name);

  if (process.argv.includes("--check")) {
    if (open.length) {
      console.error(`RLS is OFF on ${open.length} table(s): ${open.join(", ")}`);
      process.exit(1);
    }
    console.log(`RLS is on for all ${tables.length} public table(s).`);
    return;
  }

  for (const name of open) {
    // Identifiers can't be bound as parameters. Names come from pg_class, not
    // from input, and are quoted with embedded quotes doubled.
    await db.$executeRawUnsafe(`ALTER TABLE "${name.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`);
  }
  console.log(
    open.length
      ? `Enabled RLS on ${open.length} table(s): ${open.join(", ")}`
      : `RLS was already on for all ${tables.length} public table(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
