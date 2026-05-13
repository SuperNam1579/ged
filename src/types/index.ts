// ─── Domain Types ──────────────────────────────────────────────────────────────

export interface SubjectSummary {
  id: string;
  name: string;
  code: string;
  passingScore: number;
  proficiencyScore: number; // 0–100, derived from user proficiency
  progress: number; // 0–100, % of sessions completed
}

export interface StudySessionWithSubtopic {
  id: string;
  subtopicId: string;
  subtopicName: string;
  subjectCode: string;
  subjectName: string;
  topicName: string;
  scheduledDate: string;
  durationMins: number;
  order: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  learningUrl: string;
  difficultyLevel: number;
}

export interface ProficiencyMap {
  [subtopicId: string]: number; // 0–100
}

export interface DashboardStats {
  overallProgress: number; // 0–100
  todaySessions: StudySessionWithSubtopic[];
  subjectSummaries: SubjectSummary[];
  currentPlanVersion: number;
  streakDays: number;
  daysUntilExam: number;
  lastPlanUpdate?: {
    reason: string;
    generatedAt: string;
  };
}

// ─── GA Types ──────────────────────────────────────────────────────────────────

export interface GASubtopicGene {
  subtopicId: string;
  durationMins: number;
  scheduledDate: string; // ISO date string
  order: number;
}

export type Chromosome = GASubtopicGene[];

export interface Individual {
  chromosome: Chromosome;
  fitness: number;
  fitnessBreakdown: FitnessBreakdown;
}

export interface FitnessBreakdown {
  coverage: number; // 0–1
  weaknessFocus: number; // 0–1
  timeFeasibility: number; // 0–1
  prerequisiteOrder: number; // 0–1
  balance: number; // 0–1
  total: number; // weighted sum 0–1
}

export interface GAConfig {
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismCount: number;
  tournamentSize: number;
}

export interface GAInput {
  userId: string;
  proficiencies: ProficiencyMap;
  preferences: {
    targetExamDate: Date;
    hoursPerDay: number;
    availability: Record<string, boolean>;
    targetScore: number;
  };
  subtopics: SubtopicData[];
  triggerReason: TriggerReason;
  existingPlanVersion?: number;
}

export interface SubtopicData {
  id: string;
  name: string;
  topicId: string;
  subjectCode: string;
  estimatedMinutes: number;
  difficultyLevel: number;
  prerequisiteIds: string[];
}

export type TriggerReason =
  | "INITIAL"
  | "QUIZ_FAILURE"
  | "MOCK_TEST_LOW"
  | "SCHEDULE_CHANGE"
  | "MANUAL_REQUEST";

// ─── Assessment Types ───────────────────────────────────────────────────────────

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionData {
  id: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
  difficulty: number;
  subtopicId?: string;
}

export interface AttemptResult {
  attemptId: string;
  score: number;
  rawScore: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  responses: {
    questionId: string;
    isCorrect: boolean;
    selectedOption: string;
    correctOption: string;
    explanation?: string;
  }[];
  weakSubtopics: string[];
  triggered?: {
    gaRerun: boolean;
    reason?: TriggerReason;
  };
}
