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
