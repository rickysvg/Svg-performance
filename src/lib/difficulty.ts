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

export const WORKOUT_TYPE_LABELS = {
  bag: "Bag",
  lift: "Lift",
  bike: "Bike",
  gpp: "GPP",
  other: "Other",
} as const;

export type WorkoutTypeKey = keyof typeof WORKOUT_TYPE_LABELS;

const WORKOUT_TYPE_ORDER: WorkoutTypeKey[] = ["bag", "lift", "bike", "gpp", "other"];

export function classifyCompletedWorkout(input: {
  title: string;
  programDayTitle?: string | null;
  programDayFocus?: string | null;
  exerciseNames?: string[];
}): WorkoutTypeKey {
  const head = [input.title, input.programDayTitle, input.programDayFocus]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const moves = (input.exerciseNames ?? []).join(" ").toLowerCase();
  if (/\b(heavy bag|bag rounds|pad rounds|sparring rounds|grappling rounds)\b/.test(head) || /\bbag\b/.test(head)) {
    return "bag";
  }
  if (/\bgpp\b/.test(head)) return "gpp";
  if (/\bbike\b/.test(head) || /\bbike\b/.test(moves)) return "bike";
  if (/\bbag\b/.test(moves)) return "bag";
  if (head.trim() || moves.trim()) return "lift";
  return "other";
}

export type DifficultyDistributionRow = {
  value: DifficultyRating;
  label: string;
  score: number;
  count: number;
};

export type DifficultyBucket = {
  key: string;
  label: string;
  count: number;
  average: number | null;
  distribution: DifficultyDistributionRow[];
};

export type DifficultySessionRow = {
  sessionId: string;
  userId: string;
  displayName: string;
  title: string;
  programDayTitle: string;
  workoutType: string;
  performedAt: string;
  difficultyRating: string;
  difficultyLabel: string;
  score: number | null;
};

export type DifficultyFeedbackView = {
  sessions: DifficultySessionRow[];
  byProgramDay: DifficultyBucket[];
  byWorkoutType: DifficultyBucket[];
  ratedCount: number;
  unratedCount: number;
};

export function emptyDifficultyFeedback(): DifficultyFeedbackView {
  return {
    sessions: [],
    byProgramDay: [],
    byWorkoutType: [],
    ratedCount: 0,
    unratedCount: 0,
  };
}

export function summarizeDifficulty(ratings: string[]) {
  const valid = ratings.filter(isDifficultyRating);
  const distribution: DifficultyDistributionRow[] = DIFFICULTY_RATINGS.map((item) => ({
    value: item.value,
    label: item.label,
    score: item.score,
    count: valid.filter((rating) => rating === item.value).length,
  }));
  if (valid.length === 0) {
    return { count: 0, average: null as number | null, distribution };
  }
  const total = valid.reduce((sum, rating) => sum + (difficultyScore(rating) ?? 0), 0);
  return {
    count: valid.length,
    average: Math.round((total / valid.length) * 10) / 10,
    distribution,
  };
}

export function distributionSummary(distribution: { label: string; count: number }[]) {
  return distribution.map((row) => `${row.label} ${row.count}`).join(" · ");
}

export function difficultyBuckets(rows: { key: string; label: string; rating: string }[]) {
  const map = new Map<string, { label: string; ratings: string[] }>();
  for (const row of rows) {
    if (!isDifficultyRating(row.rating)) continue;
    const existing = map.get(row.key);
    if (existing) {
      existing.ratings.push(row.rating);
    } else {
      map.set(row.key, { label: row.label, ratings: [row.rating] });
    }
  }
  return [...map.entries()].map(([key, bucket]) => {
    const summary = summarizeDifficulty(bucket.ratings);
    return {
      key,
      label: bucket.label,
      count: summary.count,
      average: summary.average,
      distribution: summary.distribution,
    } satisfies DifficultyBucket;
  });
}

export function sortWorkoutTypeBuckets(buckets: DifficultyBucket[]) {
  return [...buckets].sort(
    (a, b) =>
      WORKOUT_TYPE_ORDER.indexOf(a.key as WorkoutTypeKey) -
      WORKOUT_TYPE_ORDER.indexOf(b.key as WorkoutTypeKey),
  );
}
