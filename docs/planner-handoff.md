# Planner handoff: plan once, then edit by hand (branch `GA`)

For whoever builds the frontend for the study planner — a person or an AI agent
working in this repo. It says what the backend does, the API it exposes, and
which frontend files need to change. The backend is done and tested; everything
under "Frontend tasks" is still to do.

Read `AGENTS.md` first. In short: **never run `prisma migrate dev`, `migrate
reset` or `migrate deploy`**, and never point `.env` at the production database
(project ref `dktmjivyrrflnvafnehr`). Use the development Supabase project; ask
the repo owner for its `DATABASE_URL` / `DIRECT_URL`.

```
npm install
npx prisma generate     # picks up StudySession.kind
npm run dev
npm test                # unit tests, no database
npm run test:smoke      # the whole plan lifecycle against the DEV database (~2 min)
```

---

## 1. How planning works now

1. **The GA plans once.** When a learner finishes onboarding (their first
   availability save), one GA run plans every day from today to the day before
   the exam. 50 days to the exam → 50 days planned.
2. **Nothing re-plans after that.** Saving availability, failing a quiz, a low
   mock test, changing the exam date — none of them touch the plan.
3. **The learner edits the plan by hand.** Add, remove, move, swap sessions,
   change a session's length, put another subtopic in a session's place, add or
   drop subjects, change their free time.
4. **Reset brings the GA's plan back.** The GA's original sessions are kept with
   the plan. "Reset" undoes every edit; what the learner completed stays done.

The GA's plan also includes **review sessions** (`kind: "REVIEW"`, 30 min): on
the last 1–3 study days before the exam, and on every day left once the content
is finished.

## 2. Rules the UI must reflect

Source: `src/lib/schedule/manual.ts` (edits), `src/lib/schedule/edits.ts` (rules).

| Rule | Behaviour | What the UI should do |
|---|---|---|
| Completed is history | A `COMPLETED` session can't be moved, changed or deleted (409). | Hide edit controls on completed sessions. |
| Days a session may go on | From today (Bangkok) up to the day before the exam (400 otherwise). | Limit date pickers / drop targets to that range. |
| Missed sessions | Past and not done; stay where they are until the learner moves them. | Show as "missed / ไม่ได้เรียน"; allow moving to a day from today on. Swapping a missed session is refused — move it first. |
| Free time is advisory | Editing availability never moves sessions. Days that no longer fit come back as `conflicts`. | Highlight conflict days; let the learner fix them. |
| Subjects | Dropping a subject removes its not-done sessions. Adding one puts its subtopics in the backlog, unplaced. | After adding a subject, point the learner to the backlog. |
| Content is never lost | Removing a session, or replacing its subtopic, puts its clips back in the backlog. | The backlog is the "add a session" picker. |
| "Today" is Bangkok | All day logic uses `Asia/Bangkok`. Dates in and out are `YYYY-MM-DD`. | A session is missed when `scheduledDate < today` in Bangkok and it isn't done. |

## 3. API

Every mutating call needs the `x-csrf-token` header (`GET /api/csrf`). Errors
are `{ "error": string }` with a status: 400 bad input, 404 not in your plan,
409 not allowed (completed session, subject not chosen, nothing left to add,
plan already exists, no original to reset to).

### Reading the plan

#### `GET /api/sessions` — the sessions (existing; one new field)

Each session has `kind: "STUDY" | "REVIEW"` besides the existing fields
(`id`, `scheduledDate`, `durationMins`, `order`, `status`, `subtopicId`,
`subtopicName`, `subjectCode`, `partIndex`, `partCount`, …).

#### `GET /api/plans/active` — new

```ts
interface PlanStatus {
  plan: {
    id: string;
    version: number;
    generatedAt: string;
    fitnessScore: number;
    customized: boolean;          // edited since the GA made it (or since the last reset)
    customizedAt: string | null;
    canReset: boolean;            // the GA's original is kept (false for plans made before this feature)
  };
  conflicts: {
    date: string;
    reason: "no-time" | "over-time" | "after-exam";
    plannedMinutes: number;
    availableMinutes: number;
  }[];
}
```

404 when the learner has no plan.

#### `GET /api/plans/backlog` — new

What the learner studies that isn't in the plan: content that didn't fit before
the exam, sessions they removed, subtopics of a subject they just added.

```ts
interface Backlog {
  backlog: {
    subtopicId: string;
    name: string;
    subjectCode: string;
    difficultyLevel: number;     // 1–5
    remainingMinutes: number;
    partlyPlanned: boolean;      // some of it is already planned or done; this is the rest
  }[];
}
```

#### `GET /api/user/availability/horizon` — every week to the exam

```ts
interface Horizon {
  from: string; examDate: string; totalMinutes: number; studyDays: number;
  weeks: {
    weekStartDate: string;                    // Monday
    source: "week" | "template";              // set on its own / the learner's usual week
    slots: { dayOfWeek: number; startTime: string; endTime: string }[]; // 0 = Sunday
    days: { date: string; dayOfWeek: number; weekStartDate: string; capacity: number }[];
    totalMinutes: number;
  }[];
}
```

### Editing the plan

| Call | Body | Does |
|---|---|---|
| `POST /api/sessions` | `{ subtopicId, scheduledDate, durationMins?, kind? }` | Adds a session at the end of that day. `STUDY` (default) covers the next part of the subtopic not yet planned — as many remaining clips as fit `durationMins` (5–600), at least one; all of them if no length. `REVIEW` covers no clips (default 30 min). → `201 { sessionId }` |
| `PATCH /api/sessions/[id]` | any of `{ scheduledDate, order, durationMins, subtopicId }` | Move to another day (goes to the end of it unless `order` is given), reorder within a day, change length, or put another subtopic in its place (a study session gives its clips back and takes the new subtopic's next part). → `{ ok: true }` |
| `DELETE /api/sessions/[id]` | — | Removes it; its content goes back to the backlog. |
| `POST /api/sessions/swap` | `{ a, b }` (session ids) | Swaps the two sessions' days and positions ("study this here instead"). |
| `POST /api/plans/reset` | — | Puts the GA's original sessions back. Removes every not-done session, restores the original ones less what was completed since and less dropped subjects. → `{ restored: number }` |

### Free time and subjects

#### `POST /api/user/availability`

Saves availability. **Never re-plans.** Two bodies:

```jsonc
// One week (onboarding and the schedule page's form)
{ "weekStartDate": "2026-10-12", "slots": [ ... ], "applyToFutureWeeks": true }

// Many weeks at once (max 104)
{ "weeks": [
  { "weekStartDate": "2026-10-12", "slots": [ ... ] },  // this week only
  { "weekStartDate": "2026-10-19", "slots": [] },       // a week off
  { "weekStartDate": "2026-10-26", "slots": null }      // back to the usual week
] }
```

Response: `{ weeklyAvailabilityId?, planCreated: boolean, ... }`. `planCreated`
is true only when the learner had no plan (onboarding); then the GA's result
follows (`studyPlanId`, `sessions`, `reviewSessions`, `fitsBeforeExam`,
`unscheduledMinutes`, …). Otherwise check `GET /api/plans/active` for conflicts.

#### `POST /api/user/preferences` (existing)

Sending `selectedSubjectCodes` without a subject the learner had removes that
subject's not-done sessions; the response adds `removedSessions: number`. A new
subject's subtopics appear in the backlog.

### Plan creation

`POST /api/ga/generate` makes the plan only when the learner has none (`{
success: true, ...result }`); with a plan it answers **409**. Onboarding doesn't
need it — the first availability save makes the plan.

### Removed

- Re-planning on availability save, quiz failure (`triggered.gaRerun` is always
  `null` now) and low mock tests.
- The week lock and `plannedFrom` from the previous version of this doc.
- `PlanOutOfDateBanner` on the dashboard (it re-planned).
- The settings page's "Regenerate" button is now **"Reset to Original Plan"**
  (`POST /api/plans/reset`).

## 4. Frontend tasks

1. **Editable schedule.** `src/app/schedule/page.tsx`. Session cards render
   where `session.status === "COMPLETED"` is read (lines ~655, ~841, ~891,
   ~1043); `SessionEntry` (line ~25) needs `kind`. Add per-session actions:
   move (date picker or drag between days), change length, replace subtopic,
   delete. Swap: pick two sessions → `POST /api/sessions/swap`. Refresh with
   `GET /api/sessions` after each edit.
2. **Add a session.** A picker fed by `GET /api/plans/backlog` (group by
   subject; show `remainingMinutes`), a day, an optional length → `POST
   /api/sessions`. Offer "Review" as a kind for subtopics already studied.
3. **Plan status bar.** From `GET /api/plans/active`: an "edited" badge when
   `customized`; a "Reset to original" button when `canReset` (confirm in the
   page, not `window.confirm`); conflict days highlighted with their reason.
4. **Review and missed sessions.** Badge `kind === "REVIEW"`; show `PENDING` +
   past date as missed, movable.
5. **Availability editing.** `WeekScheduleSetup` (line ~181) still saves one
   week; make it clear it doesn't change the timetable, then show conflicts.
   `fetchSlots` (line ~1132) uses `?weekStartDate=`, empty for usual weeks —
   read the week from `/horizon`. Optional: a page listing every week from
   `/horizon`, saved in one `POST { weeks }`.
6. **Subjects.** Where subjects are changed (settings / onboarding), warn that
   dropping one removes its upcoming sessions, and link to the backlog after
   adding one.
7. **Quiz failure.** `src/app/quiz/[subtopicId]/result/page.tsx` — the
   `gaRerun` banner (lines ~100, ~147) never fires now; add "Retake quiz"
   (`/quiz/[subtopicId]`) and "Review material". Before a session,
   `src/app/study/[sessionId]/page.tsx` can call
   `GET /api/subtopics/[id]/readiness` and warn (never block) when a
   prerequisite isn't passed:
   `{ ready, passScore: 60, unmet: [{ subtopicId, name, bestScore | null }] }`.
8. **Onboarding result.** When the first save returns `fitsBeforeExam: false`,
   tell the learner how many minutes don't fit and that the rest is in the
   backlog.

## 5. Where the backend logic lives

| Concern | File |
|---|---|
| Making the plan once (GA + review days, keeps the original) | `src/lib/schedule/create-plan.ts` |
| Hand edits, reset, backlog, conflicts | `src/lib/schedule/manual.ts` |
| Edit rules (clip picking, what reset restores, conflicts) | `src/lib/schedule/edits.ts` |
| Study calendar (today → exam, per-week availability) | `src/lib/schedule/calendar.ts` |
| Review day selection | `src/lib/schedule/review.ts` |
| GA run (`planDays`), saving (`savePlan`, `insertSessions`) | `src/lib/ga/engine.ts` |
| Fitness | `src/lib/ga/fitness.ts` |
| Cutting subtopics into sessions | `src/lib/schedule/parts.ts` |
| What is left to study, part numbers | `src/lib/schedule/work-items.ts` |
| Lifecycle smoke test (real DB) | `scripts/db/plan.smoke.ts` |

## 6. Deploying

The production database needs the `kind` column **before** this code is
deployed. The owner runs, against production:

```
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
# expect only: CREATE TYPE "SessionKind" … / ALTER TABLE "StudySession" ADD COLUMN "kind" …
npm run db:push        # with ALLOW_PRODUCTION_DB=1
npm run db:rls:check
```

Then deploy. Plans made before this release have no stored original:
`canReset` is false for them, and reset answers 409.
