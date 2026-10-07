import { describe, expect, it } from "vitest";
import { finalReviewDayCount, planReviews, REVIEW_MINUTES } from "../review";
import type { SubtopicData } from "@/types";

const sub = (id: string, difficultyLevel = 3): SubtopicData => ({
  id,
  name: id,
  topicId: "t",
  subjectCode: "MATH",
  estimatedMinutes: 60,
  difficultyLevel,
  prerequisiteIds: [],
});

describe("finalReviewDayCount", () => {
  it("keeps about one study day in ten for review, between one and three", () => {
    expect(finalReviewDayCount(5)).toBe(0); // under a week: every day is for content
    expect(finalReviewDayCount(7)).toBe(1);
    expect(finalReviewDayCount(20)).toBe(2);
    expect(finalReviewDayCount(36)).toBe(3);
    expect(finalReviewDayCount(200)).toBe(3);
  });
});

describe("planReviews", () => {
  const subtopics = [sub("weak"), sub("ok"), sub("hard", 5), sub("easy", 1)];
  const studied = subtopics.map((s) => ({ subtopicId: s.id, date: "2026-10-05" }));

  it("reviews the weakest first, then the hardest when nothing is weak", () => {
    const reviews = planReviews({
      days: [{ date: "2026-10-10", capacity: 60 }],
      studied,
      subtopics,
      proficiencies: { weak: 20, ok: 70, hard: 90, easy: 90 },
      lastDay: "2026-10-20",
    });
    expect(reviews.map((r) => r.subtopicId)).toEqual(["weak", "ok"]);

    const noneWeak = planReviews({
      days: [{ date: "2026-10-10", capacity: 60 }],
      studied,
      subtopics,
      proficiencies: { weak: 80, ok: 80, hard: 80, easy: 80 },
      lastDay: "2026-10-20",
    });
    expect(noneWeak[0].subtopicId).toBe("hard");
  });

  it("reviews every subtopic once before any twice, one session per 30 minutes", () => {
    const reviews = planReviews({
      days: [
        { date: "2026-10-10", capacity: 90 },
        { date: "2026-10-11", capacity: 90 },
      ],
      studied,
      subtopics,
      proficiencies: {},
      lastDay: "2026-10-20",
    });
    expect(reviews).toHaveLength(6);
    expect(new Set(reviews.slice(0, 4).map((r) => r.subtopicId)).size).toBe(4);
    expect(reviews.every((r) => r.minutes === REVIEW_MINUTES)).toBe(true);
  });

  it("only reviews what was studied before that day, and keeps the day before the exam light", () => {
    const reviews = planReviews({
      days: [
        { date: "2026-10-10", capacity: 120 },
        { date: "2026-10-19", capacity: 120 },
      ],
      studied: [
        { subtopicId: "weak", date: "2026-10-05" },
        { subtopicId: "ok", date: "2026-10-12" }, // studied after the first review day
      ],
      subtopics,
      proficiencies: {},
      lastDay: "2026-10-19",
    });
    expect(reviews.filter((r) => r.date === "2026-10-10").map((r) => r.subtopicId)).toEqual(["weak"]);
    expect(reviews.filter((r) => r.date === "2026-10-19")).toHaveLength(1);
  });
});
