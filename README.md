# GED Prep — Adaptive Study Platform

An adaptive GED exam preparation platform powered by a **Genetic Algorithm (GA)** that generates and continuously evolves personalized study plans based on user performance.

## System Architecture

### Core Concepts

| Component | Description |
|-----------|-------------|
| **GA Engine** | Multi-objective genetic algorithm generating optimal study plans |
| **Fitness Function** | 5-component weighted scoring (Coverage 30%, Weakness Focus 25%, Time Feasibility 20%, Prerequisite Order 15%, Balance 10%) |
| **Adaptive Triggers** | Automatic plan re-generation on quiz failure, mock test underperformance, or schedule changes |
| **Proficiency Model** | Weighted update: 70% recent score + 30% historical (prevents instability) |

### GED Subjects

| Subject | Code | Passing | College Ready | CR+Credit |
|---------|------|---------|---------------|-----------|
| Mathematical Reasoning | MATH | 145 | 165 | 175 |
| Reasoning Through Language Arts | RLA | 145 | 165 | 175 |
| Social Studies | SS | 145 | 165 | 175 |
| Science | SCI | 145 | 165 | 175 |

### Curriculum

- **57 subtopics** across 4 subjects
- Each subtopic: learning URL, estimated time, difficulty (1–5), prerequisites
- Content from Khan Academy (external URLs — not scraped)

### Database Schema

```
Users → UserPreferences, UserSubtopicProficiency
Curriculum → Subjects → Categories → Topics → Subtopics
Assessments → Questions → UserAssessmentAttempts → UserQuestionResponses
GA Engine → StudyPlans (versioned) → StudySessions, GaExecutionLogs
```

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (httpOnly cookies)
- **Charts**: Recharts
- **GA**: Custom TypeScript implementation

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Setup

```bash
# Clone and install
git clone <repo>
cd ged
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and NEXTAUTH_SECRET

# Database setup
npx prisma generate
npx prisma db push
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ged_prep"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

## GA Algorithm Details

### Individual Representation

Each individual = a complete study plan (Chromosome)

```typescript
type Chromosome = Array<{
  subtopicId: string;
  durationMins: number;
  scheduledDate: string; // ISO date
  order: number;
}>
```

### Fitness Function

```
F(x) = 0.30 × Coverage
      + 0.25 × WeaknessFocus
      + 0.20 × TimeFeasibility
      + 0.15 × PrerequisiteOrder
      + 0.10 × Balance
```

### Algorithm Parameters (defaults)

| Parameter | Value |
|-----------|-------|
| Population size | 50 |
| Generations | 100 |
| Crossover rate | 0.85 |
| Mutation rate | 0.15 |
| Elitism count | 2 |
| Tournament size | 5 |

### Adaptive Triggers

| Event | Condition | Action |
|-------|-----------|--------|
| Quiz Failure | Score < 60% on same topic ≥ 2 times | GA re-run → `QUIZ_FAILURE` |
| Mock Test Low | Score < 70% | GA re-run → `MOCK_TEST_LOW` |
| Manual Request | User clicks "Regenerate Plan" | GA re-run → `MANUAL_REQUEST` |

## Assessment Types

| Type | Questions | Purpose |
|------|-----------|---------|
| Pre-Assessment | 10/subject | Initialize proficiency baseline |
| Topic Quiz | 5/subtopic | Track subtopic mastery |
| Mock Test | 10/subject | Full GED simulation |

## User Flow

```
Register → Onboarding (goal, schedule, availability)
  → Pre-Assessment (40 questions)
  → GA generates Study Plan v1
  → Follow daily sessions
  → Topic quizzes after each subtopic
  → Adaptive GA re-runs when triggered
  → Repeat until exam-ready
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/user/preferences` | Study preferences |
| GET | `/api/subjects` | All subjects with proficiency |
| GET | `/api/assessment/pre` | Pre-assessments |
| GET | `/api/assessment/quiz/:subtopicId` | Quiz for subtopic |
| POST | `/api/assessment/:id/submit` | Submit answers |
| POST | `/api/ga/generate` | Run GA, create new plan |
| GET | `/api/ga/logs` | GA convergence data |
| GET | `/api/sessions` | Study sessions |
| POST | `/api/sessions/:id/complete` | Mark session done |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/proficiency` | User proficiency map |
| GET | `/api/attempts` | Assessment history |
| GET | `/api/plans` | Study plan history |

## Pages

| Route | Description | Layout |
|-------|-------------|--------|
| `/` | Landing page | None |
| `/login` | Sign in | None |
| `/register` | Create account | None |
| `/onboarding` | 4-step setup wizard | None |
| `/pre-assessment` | Initial diagnostic (40 Q) | None |
| `/dashboard` | Overview + today's plan | Sidebar |
| `/study/:sessionId` | Focus study mode | None |
| `/quiz/:subtopicId` | 5-question quiz | None |
| `/quiz/:subtopicId/result` | Quiz results + CTA | None |
| `/progress` | Progress & analytics | Sidebar |
| `/schedule` | Weekly calendar | Sidebar |
| `/mock-test` | Full GED simulation | Sidebar |
| `/settings` | Profile & preferences | Sidebar |

## Research Notes

### GA Convergence Analysis

`GaExecutionLog` stores per-generation fitness data (best, avg, worst) for:
- Convergence analysis and visualization
- Algorithm parameter tuning
- Research publications comparing GA configurations

### Proficiency Update Formula

```
new_score = recent_score × 0.70 + historical_score × 0.30
```

Rationale: Reflects improvement quickly while preventing single-test noise from destabilizing the proficiency model.

### Multi-Version Plan History

All study plan versions are retained (`isActive` flag distinguishes current). This enables:
- Rollback analysis
- Comparison of GA trigger effectiveness  
- Longitudinal user progress tracking
