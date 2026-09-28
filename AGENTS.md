<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database — read before running any Prisma or data command

The only database this project has is **production** (the Supabase project the
live site at ged-nn.com reads). On 2026-09-28 a `prisma migrate dev` run from an
old checkout reset it and wiped every user and all imported content.

- **Never run `prisma migrate dev`, `migrate reset` or `migrate deploy`.** When
  `migrate dev` sees the schema out of step with `prisma/migrations` it offers to
  drop everything, and one "yes" does it. The schema here is managed with
  `db push`, so it is always "out of step". `npm run db:migrate` now refuses.
- **Schema changes:** `npm run db:push`. It runs through `scripts/db/guard.ts`,
  then turns Row Level Security on for every table (`scripts/db/enable-rls.ts`).
  Make changes additive first; drop columns only after the code that stops using
  them is deployed — the deployed site breaks otherwise.
- **Writes are guarded.** The seed, `import-curriculum.ts --resources`,
  `fetch-resources.ts` and `scripts/db/retire-subtopics.ts --apply` refuse to
  run against production unless `ALLOW_PRODUCTION_DB=1` is set. Set it only when
  you mean to change the live site.
- **Pull first.** Run `git pull` before touching the database, so the schema and
  scripts you run are the ones production expects.
- **RLS must stay on.** `npm run db:rls:check` exits non-zero if any public table
  is open to Supabase's anon key.
- The fix that makes all of this routine: a separate development database. See
  `.env.example`.

Curriculum content flow (sheets → database): see the header of
`scripts/import-curriculum.ts`. Retiring subtopics the sheets dropped:
`scripts/db/retire-subtopics.ts` (dry run by default).
