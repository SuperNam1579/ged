/**
 * Weighted proficiency update model:
 * 70% recent score + 30% historical score
 * Reflects improvement quickly while avoiding instability.
 */
export function updateProficiency(
  currentScore: number,
  newScore: number
): number {
  const updated = newScore * 0.7 + currentScore * 0.3;
  return Math.min(100, Math.max(0, Math.round(updated * 10) / 10));
}

export function proficiencyToLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Developing";
  if (score >= 40) return "Needs Work";
  return "Weak";
}

export function proficiencyToColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function scoreToGEDScore(percentage: number, subject: string): number {
  // GED scores range 100–200, passing = 145
  // Map 0-100% → 100-200
  return Math.round(100 + percentage);
}
