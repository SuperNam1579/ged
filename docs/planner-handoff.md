# Planner handoff: whole-run study plan (branch `GA`)

For whoever builds the frontend for the new study planner — a person or an AI
agent working in this repo. It says what the backend now does, the API it
exposes, and which frontend files need to change. The backend side is done;
everything under "Frontend tasks" is still to do.

Read `AGENTS.md` first. In short: **never run `prisma migrate dev`, `migrate
reset` or `migrate deploy`**, and never point `.env` at the production database
(project ref `dktmjivyrrflnvafnehr`). Use the development Supabase project; ask
the repo owner for its `DATABASE_URL` / `DIRECT_URL`.

```
npm install
npx prisma generate     # picks up StudySession.kind
npm run dev
npm test                # vitest; the planner's tests live in src/lib/{ga,schedule}/__tests__
```

---

## 1. What changed

The planner used to plan one week at a time; the learner confirmed each week's
availability and the GA planned those 7 days. Now **one GA run plans every day
from today to the day before the exam**. 50 days to the exam → 50 days planned
right after onboarding.

A week's availability is the learner's own setting for that week
(`WeeklyAvailability`) if they made one, otherwise their usual week
(`WeeklyAvailabilityTemplate`).

## 2. Rules the UI must reflect

Every re-plan (availability saved, mock test below 70%, manual "regenerate")
follows these. They live in `src/lib/schedule/regenerate.ts`.

| Rule | Behaviour | What the UI should do |
|---|---|---|
| This week is locked | If the active plan has any session from today to Sunday, the whole week is kept as it is. New sessions start next Monday (`plannedFrom`). | When the learner edits availability, say changes apply from `plannedFrom`; this week's timetable stays. |
| Missed days stay | A session whose date has passed and isn't done stays on its date. It is not moved forward or re-planned. | Show it as "missed / ไม่ได้เรียน", still openable to catch up. |
| Review days | The last 1–3 study days before the exam, plus every study day left once content is finished, hold `REVIEW` sessions of 30 min (weakest subtopics first; otherwise hardest / longest ago). The day before the exam has one. | Mark review sessions differently; suggest a mock test on those days. |
| Quiz failure doesn't re-plan | A failed quiz no longer sets `triggered.gaRerun`. The learner chooses: retake, review, or move on. | Offer "Retake quiz" and "Review material". Warn (never block) on topics whose prerequisite isn't passed — see `/readiness`. |
| Not enough time | Lowest-priority content is dropped; response has `fitsBeforeExam: false` and `unscheduledMinutes`. | Tell the learner how much time is missing; suggest adding availability. |
| "Today" is Bangkok | All day logic uses `Asia/Bangkok`. Dates in and out are `YYYY-MM-DD`. | Compare dates as Bangkok dates (a session is missed when `scheduledDate < today` in Bangkok). |

## 3. API

All mutating calls need the `x-csrf-token` header (`GET /api/csrf`), as before.

### Shared response: a planned result

`POST /api/user/availability` and `POST /api/ga/generate` both return this when
a plan was made (built by `planSummary()` in `src/lib/schedule/regenerate.ts`):

```ts
interface PlanResult {
  studyPlanId: string;
  plannedFrom: string;          // first date of new sessions; earlier days are locked/kept
  sessions: number;             // STUDY sessions created
  reviewSessions: number;
  reviewDays: number;
  reviewOnly: boolean;          // all content done: plan is review only
  fitsBeforeExam: boolean;
  unscheduledSubtopics: number;
  unscheduledMinutes: number;
  from: string;                 // today (Bangkok)
  examDate: string;             // last planned day is the day before
  studyDays: number;
  totalStudyMinutes: number;
  fitnessScore: number;         // 0–1
  bestFitness: number;          // = fitnessScore, kept for old callers
  baselineFitness: number | null; // same plan without the GA (research data)
  seed: number | null;          // reproduces the GA run (research data)
}
```

`fitsBeforeExam` / `unscheduledMinutes` are only returned at planning time; they
are not stored on the plan yet. If a page needs them later, the backend can add
them to `GET /api/sessions` — ask.

### `GET /api/user/availability/horizon` — new

Every week from this one to the exam, with the availability the planner uses.
Read-only. Source: `src/app/api/user/availability/horizon/route.ts`, types in
`src/lib/schedule/calendar.ts`.

```ts
interface Horizon {
  from: string;
  examDate: string;
  totalMinutes: number;
  studyDays: number;
  weeks: {
    weekStartDate: string;              // Monday
    source: "week" | "template";        // set on its own / usual week
    slots: { dayOfWeek: number; startTime: string; endTime: string }[]; // 0 = Sunday
    days: { date: string; dayOfWeek: number; weekStartDate: string; capacity: number }[];
    totalMinutes: number;
  }[];
}
```

The first and last weeks may have fewer than 7 days. A `source: "week"` week with
`slots: []` is a week off.

### `POST /api/user/availability` — changed

Saves availability, then re-plans the whole run once. Source:
`src/app/api/user/availability/route.ts`. Two body shapes:

```jsonc
// One week (unchanged; used by onboarding and the schedule page's confirm form)
{ "weekStartDate": "2026-10-12", "slots": [ ... ], "applyToFutureWeeks": true }

// Many weeks in one request (new, max 104)
{ "weeks": [
  { "weekStartDate": "2026-10-12", "slots": [ ... ] },  // set this week on its own
  { "weekStartDate": "2026-10-19", "slots": [] },       // week off
  { "weekStartDate": "2026-10-26", "slots": null }      // back to the usual week
] }
```

`weekStartDate` must be a Monday and not a past week (400 otherwise).

Responses: `PlanResult` plus `weeklyAvailabilityId` (single-week body only), or
200 with only `message` when nothing was planned:

| `message` | Meaning |
|---|---|
| `All subtopics have been scheduled. Great work!` | Everything done, no days left to review |
| `This week's plan stays as it is, and your exam comes before next week…` | Week locked, exam before next Monday |
| `No study time between now and your exam.` | No availability left |

A long run takes ~2 s (50 days) up to ~20 s (200+ days). Show a loading state
and disable the button while it runs.

### `POST /api/ga/generate` — changed response

Body unchanged: `{ "triggerReason": "MANUAL_REQUEST" | ... }`. Returns
`{ success: true, ...PlanResult }`; `weeksGenerated` is gone. 400 when the exam
date has passed or there is no availability; 200 + `message` when the week is
locked and the exam is before next week. Source: `src/app/api/ga/generate/route.ts`.

### `GET /api/subtopics/[id]/readiness` — new

Whether the learner has passed this subtopic's prerequisites (best quiz score ≥
60%). For a warning, never a lock. Source:
`src/app/api/subtopics/[id]/readiness/route.ts`.

```ts
interface Readiness {
  ready: boolean;
  passScore: number; // 60
  unmet: { subtopicId: string; name: string; bestScore: number | null }[]; // null = no quiz yet
}
```

### Smaller changes

- `GET /api/sessions` — each session has `kind: "STUDY" | "REVIEW"`.
- `POST /api/assessment/[id]/submit` — a QUIZ never returns
  `triggered.gaRerun: true` now. A MOCK below 70% still does.
- `GET /api/user/availability/week` — `isPast` uses the Bangkok date.
- `GET /api/assessment/quiz/[subtopicId]` — uses the newest QUIZ assessment of
  the subtopic, so real questions added later replace the auto-generated
  placeholders. Still 5 questions.
- `GET /api/user/availability?weekStartDate=` returns only weeks set on their
  own; a week following the usual pattern comes back empty. Use `/horizon` to
  show any week's availability.

## 4. Session data

`StudySession.kind` (Prisma enum `SessionKind`, default `STUDY`):

- `STUDY` — new content. Every existing session.
- `REVIEW` — goes back over a subtopic already studied. 30 min, no clip rows
  (covers the whole subtopic). The study page works as is; completion passes at
  once if the learner already watched that subtopic's clips, because watch
  progress is stored per clip.

There is no "missed" status: missed = `status === "PENDING"` and
`scheduledDate` before today (Bangkok).

## 5. Frontend tasks

Do the first four before the release; the rest after.

1. **Show review sessions differently.** `src/app/schedule/page.tsx` —
   `SessionEntry` (line ~25) needs `kind`; the session cards render where
   `session.status === "COMPLETED"` is read (lines ~655, ~841, ~891, ~1043).
   Add a "Review / ทบทวน" badge and suggest a mock test on review days.
2. **Show missed sessions.** Same cards: `PENDING` + past date → "missed", still
   clickable.
3. **Tell the learner about the week lock.** Wherever availability is saved
   (`WeekScheduleSetup` in `src/app/schedule/page.tsx`, line ~181; POST at
   ~260), show "changes apply from `plannedFrom`" from the response.
4. **Rework the schedule page for a whole-run plan.** `showSetup` only opens the
   confirm form for a week with no sessions; after onboarding every week has
   sessions, so the form almost never shows. Replace with an "Edit this week's
   availability" action using `/horizon` + `POST { weeks }`. `fetchSlots`
   (line ~1132) calls `?weekStartDate=`, which is empty for usual weeks — read
   the week from `/horizon` instead.
5. **Quiz failure.** `src/app/quiz/[subtopicId]/result/page.tsx` — the
   `gaRerun` banner (lines ~100, ~147) no longer fires for quizzes; add "Retake
   quiz" (`/quiz/[subtopicId]`) and "Review material" (back to the session).
   `src/app/quiz/[subtopicId]/page.tsx` (line ~166) can drop the `gaRerun`
   query param. Leave `src/app/mock-test/session/page.tsx` (line ~115) as is:
   mock tests still re-plan.
6. **Prerequisite warning.** Before a session starts —
   `src/app/study/[sessionId]/page.tsx` — call `/readiness`; when
   `ready: false`, show an in-page dialog ("This topic builds on *Fractions*,
   best score 40%. Study it anyway?" → [Review Fractions] [Continue]). Don't use
   `window.confirm`.
7. **Not enough time.** When `fitsBeforeExam` is false (onboarding result,
   settings regenerate in `src/app/settings/page.tsx` line ~140, the schedule
   page), show the missing `unscheduledMinutes` and suggest more availability.
8. **Multi-week availability page (optional).** List every week from
   `/horizon`; let the learner edit a week, make it a week off, or reset it to
   the usual week; send all changes in one `POST { weeks }`.

## 6. Where the backend logic lives

| Concern | File |
|---|---|
| Study calendar (today → exam, per-week availability) | `src/lib/schedule/calendar.ts` |
| Re-plan: week lock, missed days, review days, save | `src/lib/schedule/regenerate.ts` |
| Review day selection | `src/lib/schedule/review.ts` |
| GA run over any number of days (`planDays`), save (`savePlan`) | `src/lib/ga/engine.ts` |
| Fitness (6 scores, weekly variety, weak-topics-first) | `src/lib/ga/fitness.ts` |
| Seeded randomness (reproducible runs) | `src/lib/ga/random.ts` |
| Cutting subtopics into sessions at unit/lesson boundaries | `src/lib/schedule/parts.ts` |
| What is left to study, part numbers | `src/lib/schedule/work-items.ts` |

## 7. Deploying

The production database needs the `kind` column **before** this code is
deployed, or every plan save fails. The owner runs, against production:

```
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
# expect only: CREATE TYPE "SessionKind" … / ALTER TABLE "StudySession" ADD COLUMN "kind" …
npm run db:push        # with ALLOW_PRODUCTION_DB=1
npm run db:rls:check
```

Then deploy.
