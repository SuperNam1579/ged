# GED Adaptive Study Platform — Code Review
> Generated for Claude Code to fix automatically.
> Fix issues in priority order: Critical → High → Medium → Low.

---

## Priority Fix Order

| # | Issue | Severity | Est. Effort |
|---|-------|----------|-------------|
| 1 | Availability key mismatch (3-way split) | Critical | 30 min |
| 2 | `selectedOption` vs `selectedOptionId` field mismatch | Critical | 15 min |
| 3 | All quiz answers hardcoded to "A" | Critical | 1 hr |
| 4 | Mock test reuses PRE assessments | High | 2 hr |
| 5 | GA transaction race condition | High | 30 min |
| 6 | Submit handler allows duplicate/invalid question IDs | High | 1 hr |
| 7 | JWT secret fallback + edge runtime issue | High | 1 hr |
| 8 | `useAuth` has no error path + memory leak | High | 30 min |
| 9 | Exam date / hours-per-day validation | Medium | 30 min |
| 10 | Prerequisite fitness counts missing prereqs as violations | Medium | 15 min |
| 11 | Security headers missing in next.config.ts | Medium | 30 min |
| 12 | Study session page double-fetches instead of using /api/sessions/[id] | Medium | 15 min |
| 13 | `getAuthUser` never verifies user still exists in DB | Medium | 30 min |
| 14 | Quiz option buttons missing ARIA roles | Medium | 1 hr |
| 15 | Pre-assessment has no save/resume capability | Medium | 1 hr |
| 16 | JSON `availability` and `metadata` fields are untyped | Medium | 2 hr |
| 17 | DB index missing `version` column | Medium | 30 min |
| 18 | `learningUrl` field not validated for safe protocols | Medium | 30 min |
| 19 | `streakDays` is always 0 (TODO never implemented) | Low | 30 min |
| 20 | Soft logout — JWT not invalidated server-side | Low | 2 hr |
| 21 | Recharts not lazy-loaded | Low | 15 min |
| 22 | Prerequisites stored as Postgres String[] array | High | 4 hr |
| 23 | GA runs synchronously in HTTP handler — timeout risk | Medium | 4 hr |

---

## Issue 1 — Availability Key Mismatch Breaks Entire GA Flow

**Severity: Critical**

**Root cause:**
Three parts of the codebase use different formats for day-of-week keys:
- `src/app/onboarding/page.tsx` → `monday`, `tuesday`, ..., `sunday` (full names)
- `src/app/api/user/preferences/route.ts` → `monday`, `tuesday`, ..., `sunday` (full names) ✅
- `src/lib/ga/population.ts` → `["sun", "mon", "tue", "wed", "thu", "fri", "sat"]` (short) ❌
- `src/app/settings/page.tsx` → `mon`, `tue`, ..., `sun` (short) ❌

When `buildAvailableDates()` runs, it checks `availability["mon"]` but the DB stores `"monday"` → always `undefined` → always falsy → **zero dates returned** → GA throws "No available study dates found".

**Files to change:**

### Fix `src/lib/ga/population.ts`

```ts
export function buildAvailableDates(
  targetExamDate: Date,
  availability: Record<string, boolean>
): string[] {
  // CHANGED: use full lowercase names to match API/DB storage
  const dayKeys = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday"
  ];
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exam = new Date(targetExamDate);
  exam.setHours(0, 0, 0, 0);

  const current = new Date(today);
  while (current < exam) {
    const dayKey = dayKeys[current.getDay()];
    if (availability[dayKey]) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
```

### Fix `src/app/settings/page.tsx`

```ts
// CHANGED: full names to match API contract
const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];
```

### Add shared type to `src/types/index.ts`

```ts
// ADD at top of file after existing imports
export type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export const DAY_KEYS_ORDERED: DayKey[] = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
];

export type Availability = Record<DayKey, boolean>;
```

---

## Issue 2 — `selectedOptionId` vs `selectedOption` Field Name Mismatch

**Severity: Critical**

**Root cause:**
The submit API validates `selectedOption` (correct), but both `pre-assessment/page.tsx` and `quiz/[subtopicId]/page.tsx` send `selectedOptionId` (wrong). This causes every pre-assessment and quiz submission to fail Zod validation and return HTTP 400. No proficiency is ever updated, no adaptive triggers ever fire.

The mock test page (`mock-test/session/page.tsx`) uses the correct name and works fine.

**Files to change:**

### Fix `src/app/pre-assessment/page.tsx` (~line 144)

```ts
// BEFORE:
body: JSON.stringify({
  responses: Object.entries(currentAnswers).map(([questionId, selectedOptionId]) => ({
    questionId,
    selectedOptionId,  // ❌ wrong field name
  })),
}),

// AFTER:
body: JSON.stringify({
  responses: Object.entries(currentAnswers).map(([questionId, selectedOption]) => ({
    questionId,
    selectedOption,  // ✅ matches API SubmitSchema
  })),
}),
```

### Fix `src/app/quiz/[subtopicId]/page.tsx` (~line 95)

```ts
// BEFORE:
body: JSON.stringify({
  responses: Object.entries(updatedAnswers).map(([questionId, selectedOptionId]) => ({
    questionId,
    selectedOptionId,  // ❌ wrong field name
  })),
}),

// AFTER:
body: JSON.stringify({
  responses: Object.entries(updatedAnswers).map(([questionId, selectedOption]) => ({
    questionId,
    selectedOption,  // ✅ matches API SubmitSchema
  })),
}),
```

---

## Issue 3 — All Quiz Answers Hardcoded to "A"

**Severity: Critical**

**Root cause:**
Every auto-generated quiz and seeded question has `correctOptionId: "A"`. A user who always selects A gets 100% on everything. Proficiency scores have no signal, GA weakness detection never fires, and research data is invalid.

**Files to change:**

### Fix `src/app/api/assessment/quiz/[subtopicId]/route.ts`

```ts
// Replace the question creation block inside the assessment creation
const OPTION_IDS = ["A", "B", "C", "D"] as const;

questions: {
  create: Array.from({ length: 5 }, (_, questionIndex) => {
    // CHANGED: randomize correct answer position per question
    const correctIndex = Math.floor(Math.random() * 4);
    const correctOptionId = OPTION_IDS[correctIndex];

    return {
      subtopicId,
      text: `Question ${questionIndex + 1}: Which of the following best applies to "${subtopic.name}"?`,
      options: OPTION_IDS.map((id, i) => ({
        id,
        text: i === correctIndex
          ? `The correct application of ${subtopic.name}`
          : [
              `A common misconception about ${subtopic.name}`,
              `An approach that ignores key principles of ${subtopic.name}`,
              `An unrelated concept often confused with ${subtopic.name}`,
            ][i < correctIndex ? i : i - 1],
      })),
      correctOptionId,
      explanation: `Understanding ${subtopic.name} is essential for the GED exam.`,
      source: "AI_GENERATED",
      difficulty: subtopic.difficultyLevel,
    };
  }),
},
```

### Fix `prisma/seed.ts` — `getSampleQuestion` helper block (~line 570)

```ts
const OPTION_IDS = ["A", "B", "C", "D"] as const;

function getSeedQuestion(topicName: string, questionIndex: number) {
  const correctIndex = questionIndex % 4; // deterministic but varied across questions
  const correctOptionId = OPTION_IDS[correctIndex];
  const distractors = [
    `An incorrect application of ${topicName} principles`,
    `A common misconception about ${topicName}`,
    `An unrelated concept often confused with ${topicName}`,
  ];

  let distractorIdx = 0;
  const options = OPTION_IDS.map((id, i) => ({
    id,
    text: i === correctIndex
      ? `The foundational principle of ${topicName} applied correctly`
      : distractors[distractorIdx++],
  }));

  return {
    text: `Which of the following best describes the core concept of "${topicName}"?`,
    options,
    correctOptionId,
    explanation: `This tests your understanding of ${topicName}.`,
  };
}

// Replace existing helper functions and update usage:
// BEFORE:
// correctOptionId: "A",
// options: [ ... ],

// AFTER: call getSeedQuestion(subtopic.name, i) and spread result
```

---

## Issue 4 — Mock Test Reuses PRE Assessments (Wrong Type Query)

**Severity: High**

**Root cause:**
`src/app/api/assessment/mock/route.ts` queries `type: "PRE"` instead of `type: "MOCK"`. The seed has no MOCK assessments so the endpoint currently returns PRE assessments, meaning:
- Users re-take the pre-assessment as a "mock test"
- `UserAssessmentAttempt` records have wrong type labels
- Pre-assessment baseline gets contaminated with later attempts
- No true pre/post comparison is possible

**Files to change:**

### Fix `src/app/api/assessment/mock/route.ts`

```ts
// CHANGED: query MOCK type, fall back to PRE if no MOCK exists yet
const assessments = await db.assessment.findMany({
  where: {
    type: "MOCK",
    subject: { code: { in: subjects } },
  },
  include: {
    subject: { select: { id: true, name: true, code: true } },
    questions: {
      select: {
        id: true,
        text: true,
        options: true,
        difficulty: true,
        subtopicId: true,
      },
    },
  },
});

// Fallback: if no MOCK assessments seeded yet, return PRE with a warning header
if (assessments.length === 0) {
  const preAssessments = await db.assessment.findMany({
    where: {
      type: "PRE",
      subject: { code: { in: subjects } },
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      questions: {
        select: {
          id: true,
          text: true,
          options: true,
          difficulty: true,
          subtopicId: true,
        },
      },
    },
  });
  const res = NextResponse.json({
    assessments: preAssessments,
    warning: "Using pre-assessment questions as fallback. Seed MOCK assessments for accurate results.",
  });
  res.headers.set("X-Fallback-Assessment", "true");
  return res;
}

return NextResponse.json({ assessments });
```

### Add MOCK assessments to `prisma/seed.ts`

Add the following block **after** the PRE assessment seeding loop (after the `for (const subject of [math, rla, ss, sci])` block):

```ts
// ─── Seed MOCK assessments (separate from PRE) ─────────────────────────
console.log("Seeding MOCK assessments...");

for (const subject of [math, rla, ss, sci]) {
  const subjectSubtopics = allSubtopics.filter(
    (s) => s.topic.category.subjectId === subject.id
  );
  // Use different subtopics from PRE (start from index 5 if available)
  const mockSubtopics = subjectSubtopics.length >= 10
    ? subjectSubtopics.slice(Math.min(5, subjectSubtopics.length - 10), Math.min(15, subjectSubtopics.length))
    : subjectSubtopics;

  const mockAssessment = await prisma.assessment.create({
    data: {
      type: "MOCK",
      subjectId: subject.id,
      title: `${subject.name} Mock Test`,
      timeLimit: 30,
    },
  });

  for (let i = 0; i < Math.min(10, mockSubtopics.length); i++) {
    const subtopic = mockSubtopics[i];
    const q = getSeedQuestion(subtopic.name, i + 10); // offset index for variety
    await prisma.question.create({
      data: {
        assessmentId: mockAssessment.id,
        subtopicId: subtopic.id,
        ...q,
        source: "AI_GENERATED",
        difficulty: subtopic.difficultyLevel,
      },
    });
  }
}
```

---

## Issue 5 — GA Plan Swap Not Atomic (Race Condition / Data Loss)

**Severity: High**

**Root cause:**
In `src/lib/ga/engine.ts`, the old plan is deactivated **before** the new plan is created. These are two separate DB operations with no transaction. If `db.studyPlan.create` fails (e.g., large session batch, timeout, network blip), the user has **zero active plans** with no recovery path.

**File to change: `src/lib/ga/engine.ts`**

```ts
// BEFORE (lines ~115-145):
await db.studyPlan.updateMany({
  where: { userId, isActive: true },
  data: { isActive: false },
});

const studyPlan = await db.studyPlan.create({ ... });

// AFTER: wrap in a transaction with extended timeout
const studyPlan = await db.$transaction(
  async (tx) => {
    await tx.studyPlan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    return tx.studyPlan.create({
      data: {
        userId,
        version: nextVersion,
        fitnessScore: best.fitness,
        triggerReason,
        isActive: true,
        metadata: JSON.parse(
          JSON.stringify({ config: cfg, fitnessBreakdown: best.fitnessBreakdown })
        ),
        sessions: {
          create: best.chromosome.map((gene) => ({
            subtopicId: gene.subtopicId,
            scheduledDate: new Date(gene.scheduledDate),
            durationMins: gene.durationMins,
            order: gene.order,
            status: "PENDING" as const,
          })),
        },
      },
    });
  },
  {
    timeout: 30000, // 30s — GA plan sessions can be large
  }
);

// GA logs stay OUTSIDE transaction (append-only research data, ok if partial)
await db.gaExecutionLog.createMany({
  data: generationLogs.map((log) => ({
    studyPlanId: studyPlan.id,
    generation: log.generation,
    bestFitness: log.bestFitness,
    avgFitness: log.avgFitness,
    worstFitness: log.worstFitness,
    metadata: JSON.parse(JSON.stringify(log.breakdown)),
  })),
});
```

---

## Issue 6 — Submit Handler Allows Duplicate Question IDs

**Severity: High**

**Root cause:**
The submit endpoint doesn't deduplicate responses by `questionId`. A client can submit the same correct answer 10 times for a 10-question quiz and receive 100%.

**File to change: `src/app/api/assessment/[id]/submit/route.ts`**

Add deduplication immediately after parsing, before grading:

```ts
const { responses } = parsed.data;

// ADDED: deduplicate by questionId (keep first occurrence only)
const seenIds = new Set<string>();
const dedupedResponses = responses.filter((r) => {
  if (seenIds.has(r.questionId)) return false;
  seenIds.add(r.questionId);
  return true;
});

// ADDED: only process responses for questions that belong to THIS assessment
const validResponses = dedupedResponses.filter((r) => questionMap.has(r.questionId));

if (validResponses.length === 0) {
  return NextResponse.json(
    { error: "No valid responses submitted" },
    { status: 400 }
  );
}

// Replace original `responses` usage with `validResponses` for the rest of the function
// i.e. change:
//   const gradedResponses = responses.flatMap(...)
// to:
//   const gradedResponses = validResponses.map((r) => {
//     const question = questionMap.get(r.questionId)!;
//     return { ... };
//   });
```

---

## Issue 7 — JWT Secret Has Insecure Fallback Value

**Severity: High**

**Root cause:**
```ts
// src/lib/auth.ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production"
);
```

If `NEXTAUTH_SECRET` is not set in a production environment, tokens are signed with a publicly-known secret. Anyone can forge a valid JWT and impersonate any user.

Also, the middleware imports from `src/lib/auth.ts` which pulls in `bcryptjs` — this may cause Edge Runtime instability since bcrypt uses Node.js native APIs.

**Files to change:**

### Create `src/lib/auth-edge.ts` (new file)

```ts
// Edge-runtime safe: only jose, no bcrypt
import * as jose from "jose";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET environment variable is not set. " +
    "Run: openssl rand -base64 32 and add to .env.local"
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export async function verifyToken(
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function signToken(
  payload: Record<string, unknown>
): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}
```

### Update `src/lib/auth.ts`

```ts
// CHANGED: re-export edge-safe functions, keep bcrypt in Node-only file
import bcrypt from "bcryptjs";
export { verifyToken, signToken } from "./auth-edge";
import { verifyToken } from "./auth-edge";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getAuthUser(
  req: NextRequest
): Promise<{ id: string; email: string; name: string } | null> {
  const authHeader = req.headers.get("authorization");
  const cookieToken = req.cookies.get("auth-token")?.value;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.sub) return null;

  return {
    id: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
  };
}
```

### Update `src/middleware.ts`

```ts
// CHANGED: import from edge-safe module
import { verifyToken } from "@/lib/auth-edge";
// Remove: import { verifyToken } from "@/lib/auth";
```

### Create `.env.example` (new file in project root)

```env
# Copy to .env.local and fill in values
# Generate secret: openssl rand -base64 32
NEXTAUTH_SECRET=

DATABASE_URL=postgresql://user:password@localhost:5432/ged_prep
NEXTAUTH_URL=http://localhost:3000
```

---

## Issue 8 — `useAuth` Hook Has No Error Path and Memory Leak

**Severity: High**

**Root cause:**
- If `/api/auth/me` returns a non-401 error (e.g., 500), the loading state stays `true` forever
- No cleanup cancellation — if the component unmounts before fetch resolves, it attempts to call `setState` on an unmounted component (React warning + potential crash in strict mode)

**File to change: `src/lib/hooks/useAuth.ts`**

```ts
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  preferences: Record<string, unknown> | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/auth/me");
        if (cancelled) return;

        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError(`Failed to load user (${res.status})`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) setError("Network error — please check your connection");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true; // prevent setState after unmount
    };
  }, []); // intentionally empty — run once on mount

  return { user, loading, error };
}
```

Also update pages that use `useAuth` to handle the `error` state, e.g.:

```tsx
// Any page using useAuth — add error display
const { user, loading, error } = useAuth();

if (error) {
  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    </MainLayout>
  );
}
```

---

## Issue 9 — Exam Date and hoursPerDay Validation Too Permissive

**Severity: Medium**

**Root cause:**
- `targetExamDate` can be in the past → `buildAvailableDates` returns empty array → GA fails
- `hoursPerDay` allows `0.5` → only 30-minute windows → most subtopics (estimatedMinutes > 30) can never be scheduled
- `targetScore` max is `175` but GED max is `200`

**File to change: `src/app/api/user/preferences/route.ts`**

```ts
const PreferencesSchema = z.object({
  targetExamDate: z.string().refine((d) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return date >= tomorrow;
  }, "Exam date must be at least tomorrow"),

  hoursPerDay: z.number()
    .min(1, "Must study at least 1 hour per day")
    .max(12, "Cannot exceed 12 hours per day"),

  targetScore: z.number()
    .min(145, "Minimum passing score is 145")
    .max(200, "Maximum GED score is 200"),

  studyGoal: z.enum(["PASS", "COLLEGE_READY", "COLLEGE_READY_CREDIT"]),

  availability: z.object({
    monday: z.boolean(),
    tuesday: z.boolean(),
    wednesday: z.boolean(),
    thursday: z.boolean(),
    friday: z.boolean(),
    saturday: z.boolean(),
    sunday: z.boolean(),
  }).refine(
    (a) => Object.values(a).some(Boolean),
    "Must select at least one available study day"
  ),
});
```

Also update the onboarding slider minimum:

```tsx
// src/app/onboarding/page.tsx — Step 2 hours slider
<input
  type="range"
  min={1}       // CHANGED: was 1, keep at 1 (already fine if you fix schema min above)
  max={8}
  step={0.5}
  value={data.hoursPerDay}
  ...
/>
```

---

## Issue 10 — Prerequisite Fitness Penalizes Missing Prereqs Incorrectly

**Severity: Medium**

**Root cause:**
In `prerequisiteOrderScore()`, if a prerequisite subtopic is not included in the chromosome at all (because there's no time for it), `positionMap.get(prereqId)` returns `undefined` and it's counted as a violation. But a missing prerequisite is not an ordering violation — it's a coverage issue handled by the Coverage component.

**File to change: `src/lib/ga/fitness.ts`**

```ts
function prerequisiteOrderScore(
  chromosome: Chromosome,
  subtopics: SubtopicData[]
): number {
  if (chromosome.length === 0) return 0;

  const subtopicMap = new Map(subtopics.map((s) => [s.id, s]));
  const positionMap = new Map(chromosome.map((g, i) => [g.subtopicId, i]));

  let violations = 0;
  let totalPrereqs = 0;

  for (const gene of chromosome) {
    const subtopic = subtopicMap.get(gene.subtopicId);
    if (!subtopic) continue;
    const currentPos = positionMap.get(gene.subtopicId)!;

    for (const prereqId of subtopic.prerequisiteIds) {
      const prereqPos = positionMap.get(prereqId);

      // CHANGED: if prereq is not in the plan, skip — not an ordering violation
      // (missing coverage is handled by the Coverage fitness component)
      if (prereqPos === undefined) continue;

      totalPrereqs++;
      if (prereqPos >= currentPos) violations++;
    }
  }

  return totalPrereqs === 0 ? 1 : Math.max(0, 1 - violations / totalPrereqs);
}
```

---

## Issue 11 — Security Headers Missing

**Severity: Medium**

**Root cause:**
`next.config.ts` has no HTTP security headers. Also, `allowedOrigins` is hardcoded to `"localhost:3000"` which will break server actions in production.

**File to change: `next.config.ts`**

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const allowedOrigins = process.env.NEXTAUTH_URL
  ? [new URL(process.env.NEXTAUTH_URL).host]
  : ["localhost:3000"];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

---

## Issue 12 — Study Session Page Double-Fetches Instead of Using Dedicated Endpoint

**Severity: Medium**

**Root cause:**
`src/app/study/[sessionId]/page.tsx` fetches all of today's sessions then falls back to fetching ALL sessions — just to find one session by ID. The API already has a dedicated `GET /api/sessions/[id]` endpoint.

Also: `setLoading(false)` is missing from the fallback branch, leaving the page in a perpetual loading state when the session is not found.

**File to change: `src/app/study/[sessionId]/page.tsx`**

Replace the entire `useEffect` data-loading block:

```ts
useEffect(() => {
  let cancelled = false;

  async function load() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (cancelled) return;

      if (res.status === 404) {
        setError("Session not found.");
        return;
      }
      if (!res.ok) {
        setError("Failed to load session details.");
        return;
      }
      const data = await res.json();
      if (!cancelled) setSession(data.session);
    } catch {
      if (!cancelled) setError("Network error loading session.");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  load();
  return () => { cancelled = true; };
}, [sessionId]);
```

---

## Issue 13 — `getAuthUser` Never Verifies User Still Exists in DB

**Severity: Medium**

**Root cause:**
`getAuthUser` returns data from the JWT payload without checking the DB. If a user is deleted (or disabled), their 7-day JWT still grants full access. All downstream queries return empty results without error, which is confusing for the user.

**File to change: `src/lib/auth.ts`**

Add a strict variant for state-changing operations:

```ts
// ADD this function below getAuthUser
export async function getAuthUserStrict(
  req: NextRequest
): Promise<{ id: string; email: string; name: string } | null> {
  const authUser = await getAuthUser(req);
  if (!authUser) return null;

  // Verify user actually exists in DB
  const dbUser = await db.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, name: true },
  });

  return dbUser; // null if user was deleted
}
```

Then replace `getAuthUser` with `getAuthUserStrict` in these endpoints:
- `src/app/api/user/preferences/route.ts` (POST)
- `src/app/api/ga/generate/route.ts`
- `src/app/api/sessions/[id]/complete/route.ts`
- `src/app/api/assessment/[id]/submit/route.ts`

Keep fast `getAuthUser` for read-only endpoints (dashboard, sessions list, etc.).

---

## Issue 14 — Quiz Options Missing ARIA Roles (Accessibility)

**Severity: Medium**

**Root cause:**
Option buttons have no `role`, `aria-checked`, or keyboard navigation. Screen readers cannot determine which option is selected.

**Files to change:**
- `src/app/quiz/[subtopicId]/page.tsx`
- `src/app/pre-assessment/page.tsx`
- `src/app/mock-test/session/page.tsx`

Pattern to apply to all three option lists:

```tsx
{/* Wrap the options list */}
<div
  role="radiogroup"
  aria-label="Answer choices"
  className="space-y-3 mb-8"
>
  {question.options.map((option, i) => (
    <button
      key={option.id}
      role="radio"
      aria-checked={selectedOption === option.id}
      aria-label={`Option ${OPTION_LABELS[i]}: ${option.text}`}
      onClick={() => handleSelect(option.id)}
      onKeyDown={(e) => {
        const total = question.options.length;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          handleSelect(question.options[(i + 1) % total].id);
        }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          handleSelect(question.options[(i - 1 + total) % total].id);
        }
      }}
      className={cn(/* existing classes */)}
    >
      {/* existing content unchanged */}
    </button>
  ))}
</div>
```

---

## Issue 15 — Pre-Assessment Has No Save/Resume

**Severity: Medium**

**Root cause:**
The 40-question pre-assessment stores all state in React only. If the user closes the tab, loses connection, or navigates away, all progress is lost.

**File to change: `src/app/pre-assessment/page.tsx`**

Add `localStorage` persistence. Insert these two `useEffect` hooks **after** the state declarations:

```ts
const STORAGE_KEY = "ged-pre-assessment-v1";

// Restore saved progress on mount
useEffect(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (parsed.answers) setAnswers(parsed.answers);
    if (typeof parsed.currentAssessmentIdx === "number")
      setCurrentAssessmentIdx(parsed.currentAssessmentIdx);
    if (typeof parsed.currentQuestionIdx === "number")
      setCurrentQuestionIdx(parsed.currentQuestionIdx);
  } catch {
    localStorage.removeItem(STORAGE_KEY); // clear corrupted data
  }
}, []); // run once after mount

// Persist progress on each answer change
useEffect(() => {
  if (Object.keys(answers).every((k) => Object.keys(answers[k]).length === 0)) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ answers, currentAssessmentIdx, currentQuestionIdx })
  );
}, [answers, currentAssessmentIdx, currentQuestionIdx]);
```

Also clear localStorage on completion (inside the `analyzing` state trigger):

```ts
// Add this BEFORE router.push("/dashboard")
localStorage.removeItem(STORAGE_KEY);
```

---

## Issue 16 — `learningUrl` Not Validated for Safe Protocols

**Severity: Medium**

**Root cause:**
`learningUrl` is rendered as an `<a href>` with no validation. A malicious seed value like `javascript:alert(1)` would execute on click (though React generally mitigates this, defense-in-depth is important).

**Create new file: `src/lib/utils/sanitize.ts`**

```ts
const ALLOWED_PROTOCOLS = ["http:", "https:"];

export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol) ? url : "#";
  } catch {
    return "#";
  }
}
```

**File to change: `src/app/study/[sessionId]/page.tsx`**

```tsx
import { safeUrl } from "@/lib/utils/sanitize";

// CHANGED:
<a
  href={safeUrl(session.learningUrl)}
  target="_blank"
  rel="noopener noreferrer"
>
  Open Learning Resource
</a>
```

Apply the same `safeUrl()` wrapper anywhere `learningUrl` is rendered as an anchor.

---

## Issue 17 — DB Index Missing `version` Column

**Severity: Medium**

**Root cause:**
`StudyPlan` has `@@index([userId, isActive])` but queries also `orderBy: { version: "desc" }`. Postgres must do a separate sort on matching rows. Also `StudySession` queries filter by `status` but the index doesn't include it.

**File to change: `prisma/schema.prisma`**

```prisma
model StudyPlan {
  // ... existing fields unchanged ...

  // CHANGED: add version to index for ORDER BY efficiency
  @@index([userId, isActive, version(sort: Desc)])
}

model StudySession {
  // ... existing fields unchanged ...

  // CHANGED: add status to index for filtered queries
  @@index([studyPlanId, scheduledDate, status])
}
```

Then run:

```bash
npx prisma migrate dev --name optimize-indexes
```

---

## Issue 18 — `streakDays` Always Returns 0 (TODO Never Implemented)

**Severity: Low**

**Root cause:**
`streakDays: 0, // TODO` in the dashboard API — a hardcoded placeholder.

**File to change: `src/app/api/dashboard/route.ts`**

Replace the `streakDays: 0` line with:

```ts
// CHANGED: calculate real streak from completed sessions
const recentCompletions = await db.studySession.findMany({
  where: {
    studyPlan: { userId: authUser.id },
    status: "COMPLETED",
    completedAt: { not: null },
  },
  select: { completedAt: true },
  orderBy: { completedAt: "desc" },
  take: 60,
});

const completionDateSet = new Set(
  recentCompletions.map((c) => c.completedAt!.toISOString().split("T")[0])
);

let streakDays = 0;
const streakCursor = new Date();
streakCursor.setHours(0, 0, 0, 0);

while (completionDateSet.has(streakCursor.toISOString().split("T")[0])) {
  streakDays++;
  streakCursor.setDate(streakCursor.getDate() - 1);
}

// Then use streakDays in the return statement:
return NextResponse.json({
  overallProgress,
  todaySessions,
  subjectSummaries,
  currentPlanVersion: activePlan?.version ?? 0,
  daysUntilExam,
  streakDays,   // CHANGED: real value
  lastPlanUpdate: activePlan
    ? { reason: activePlan.triggerReason, generatedAt: activePlan.generatedAt.toISOString() }
    : undefined,
});
```

---

## Issue 19 — Recharts Not Lazy-Loaded

**Severity: Low**

**Root cause:**
Recharts (~150KB gzipped) is imported eagerly. Users who never visit the Progress page still download it.

**File to change: `src/app/progress/page.tsx`**

```tsx
// REMOVE static imports:
// import FitnessConvergenceChart from "@/components/charts/FitnessConvergenceChart";

// ADD dynamic import at top of file:
import dynamic from "next/dynamic";
import Spinner from "@/components/ui/Spinner";

const FitnessConvergenceChart = dynamic(
  () => import("@/components/charts/FitnessConvergenceChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    ),
  }
);

// No other changes needed — usage in JSX remains identical
```

---

## Issue 20 — Prerequisites Stored as `String[]` Array (Schema)

**Severity: High (long-term refactor)**

**Root cause:**
`prerequisiteIds String[]` in Prisma has no referential integrity. Deleted subtopic IDs silently become orphan references. Cannot query "what depends on X?" efficiently.

**Note:** This is a breaking schema change. Coordinate with team before applying. Creates a migration that drops `prerequisiteIds` column.

**File to change: `prisma/schema.prisma`**

```prisma
// REMOVE from Subtopic model:
// prerequisiteIds  String[]

// ADD new join table:
model SubtopicPrerequisite {
  id              String   @id @default(cuid())
  dependentId     String
  prerequisiteId  String
  createdAt       DateTime @default(now())

  dependent    Subtopic @relation("Dependent", fields: [dependentId], references: [id], onDelete: Cascade)
  prerequisite Subtopic @relation("Prerequisite", fields: [prerequisiteId], references: [id], onDelete: Cascade)

  @@unique([dependentId, prerequisiteId])
  @@index([dependentId])
  @@index([prerequisiteId])
}

// UPDATE Subtopic model to add relations:
model Subtopic {
  // ... existing fields, REMOVE prerequisiteIds ...

  prerequisites SubtopicPrerequisite[] @relation("Dependent")
  dependents    SubtopicPrerequisite[] @relation("Prerequisite")
}
```

**Update GA loader in `src/app/api/ga/generate/route.ts`:**

```ts
const subtopics = await db.subtopic.findMany({
  include: {
    prerequisites: { select: { prerequisiteId: true } },
    topic: {
      include: {
        category: { include: { subject: { select: { code: true } } } },
      },
    },
  },
});

const subtopicData = subtopics.map((s) => ({
  id: s.id,
  name: s.name,
  topicId: s.topicId,
  subjectCode: s.topic.category.subject.code,
  estimatedMinutes: s.estimatedMinutes,
  difficultyLevel: s.difficultyLevel,
  prerequisiteIds: s.prerequisites.map((p) => p.prerequisiteId), // CHANGED
}));
```

Run migration:

```bash
npx prisma migrate dev --name add-subtopic-prerequisite-table
```

---

## Issue 21 — GA Runs Synchronously in HTTP Handler

**Severity: Medium**

**Root cause:**
`runGeneticAlgorithm()` runs 100 generations synchronously in the API route handler. While fast for 57 subtopics, this will timeout on Vercel hobby (10s limit) if parameters increase, and gives the user no progress feedback.

**Short-term fix: `src/app/api/ga/generate/route.ts`**

Add a client-visible timeout:

```ts
// At top of POST handler, add a timeout race
const GA_TIMEOUT_MS = 25000; // 25s — under Vercel's 30s max

const result = await Promise.race([
  runGeneticAlgorithm({
    userId: authUser.id,
    proficiencies: profMap,
    preferences: { ... },
    subtopics: subtopicData,
    triggerReason: triggerReason as TriggerReason,
    existingPlanVersion: latestPlan?.version,
  }),
  new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Study plan generation timed out. Please try again.")),
      GA_TIMEOUT_MS
    )
  ),
]);
```

**Also update onboarding to show a progress message while generating:**

```tsx
// src/app/onboarding/page.tsx — inside handleFinish, after preferences save
setLoadingMessage("Generating your personalized study plan with AI...");
// (add `loadingMessage` state and display it below the button)
```

---

## End of Review

### Summary counts
- **Critical:** 3 issues (fix immediately — app is broken without these)
- **High:** 6 issues (fix before advisor review)
- **Medium:** 10 issues (fix before demo or thesis submission)
- **Low:** 2 issues (fix when time allows)

### Files most affected
1. `src/lib/ga/population.ts` — Issue 1
2. `src/app/pre-assessment/page.tsx` — Issues 2, 15
3. `src/app/quiz/[subtopicId]/page.tsx` — Issues 2, 14
4. `prisma/seed.ts` — Issues 3, 4
5. `src/lib/ga/engine.ts` — Issues 5, 10
6. `src/app/api/assessment/[id]/submit/route.ts` — Issues 2, 6
7. `src/lib/auth.ts` / `src/lib/auth-edge.ts` — Issues 7, 13
8. `src/lib/hooks/useAuth.ts` — Issue 8
9. `prisma/schema.prisma` — Issues 17, 20
10. `next.config.ts` — Issue 11
