// Removes the dev server's generated route types before type-checking.
//
// `next dev` writes .next/dev/types/validator.ts, and when that file is stale
// it can hold a syntax error. tsc then stops after parsing and reports none of
// the project's real errors — a broken import passed "tsc" this way and was
// pushed (2026-10-11). `next build` regenerates what it needs.
import { rmSync } from "node:fs";
rmSync(".next/dev", { recursive: true, force: true });
