import { AppError } from "@/lib/errors";

export const DIFFICULTY_RATINGS = [
  { value: "too_easy", label: "Too easy", score: 1 },
  { value: "just_right", label: "Just right", score: 2 },
  { value: "hard", label: "Hard", score: 3 },
  { value: "very_hard", label: "Very hard", score: 4 },
  { value: "extremely_difficult", label: "Extremely difficult", score: 5 },
] as const;

export type DifficultyRating = (typeof DIFFICULTY_RATINGS)[number]["value"];

export const TOO_EASY_STREAK_FLAG = 3;

export function isDifficultyRating(value: string): value is DifficultyRating {
  return DIFFICULTY_RATINGS.some((item) => item.value === value);
}

export function parseDifficultyRating(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (!isDifficultyRating(trimmed)) {
    throw new AppError("WORKOUT", "Pick a session difficulty from the list.");
  }
  return trimmed;
}

export function difficultyLabel(value: string | null | undefined) {
  return DIFFICULTY_RATINGS.find((item) => item.value === value)?.label ?? "";
}

export function difficultyScore(value: string | null | undefined) {
  return DIFFICULTY_RATINGS.find((item) => item.value === value)?.score ?? null;
}

export type RatedSession = {
  difficultyRating: string;
  performedAt: Date;
};

export function recentDifficultyAverage(sessions: RatedSession[], take = 8) {
  const rated = sessions
    .filter((row) => isDifficultyRating(row.difficultyRating))
    .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())
    .slice(0, take);
  const scores = rated
    .map((row) => difficultyScore(row.difficultyRating))
    .filter((score): score is 1 | 2 | 3 | 4 | 5 => score != null);
  if (scores.length === 0) {
    return { count: 0, average: null, label: "" };
  }
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const nearest = DIFFICULTY_RATINGS.reduce((best, item) =>
    Math.abs(item.score - average) < Math.abs(best.score - average) ? item : best,
  );
  return {
    count: scores.length,
    average: Math.round(average * 10) / 10,
    label: nearest.label,
  };
}

export function tooEasyStreak(sessions: RatedSession[]) {
  const rated = sessions
    .filter((row) => isDifficultyRating(row.difficultyRating))
    .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
  let streak = 0;
  for (const row of rated) {
    if (row.difficultyRating !== "too_easy") {
      break;
    }
    streak += 1;
  }
  return streak;
}

export function tooEasyCoachNote(streak: number) {
  if (streak < TOO_EASY_STREAK_FLAG) {
    return "";
  }
  return `${streak} recent sessions marked too easy — a load check may help. Not a verdict.`;
}

export function memberDifficultyCopy(average: ReturnType<typeof recentDifficultyAverage>) {
  if (average.count === 0) {
    return "Rate a finished session so you can see a recent feel average. Not a grade.";
  }
  return `Recent feel: ${average.label} (average ${average.average} of 5 across ${average.count} rated session${average.count === 1 ? "" : "s"}). Used later for progression hints — we do not auto-add load.`;
}
