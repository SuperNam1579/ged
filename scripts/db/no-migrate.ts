/**
 * `npm run db:migrate` lands here instead of `prisma migrate dev`, on purpose.
 *
 * When `migrate dev` finds the database out of step with prisma/migrations it
 * offers to reset it — drop every table and start over — and one "yes" is all
 * it takes. That is what wiped the production database on 2026-09-28: this
 * project has one database, the one the live site uses, and its schema is
 * managed with `prisma db push`, so it is always "out of step" with migrations.
 *
 * Don't run `npx prisma migrate dev`, `migrate reset` or `migrate deploy`
 * directly either. See AGENTS.md → "Database".
 */

console.error(
  [
    "",
    "✋ prisma migrate is not used in this project.",
    "",
    "   `migrate dev` resets the database when it finds drift, and the only",
    "   database here is production. Schema changes go through:",
    "",
    "     npm run db:push        (guarded; turns RLS on afterwards)",
    "",
    "   See AGENTS.md → Database.",
    "",
  ].join("\n")
);
process.exit(1);
