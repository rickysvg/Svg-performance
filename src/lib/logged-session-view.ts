import { setIsTicked } from "@/lib/logged-work";
import { SESSION_DURATION_CAP_SECONDS, sessionDurationSeconds, type ShareSessionLike } from "@/lib/share-card";

type LoggedSet = {
  exerciseName?: string | null;
  completed?: boolean | null;
  reps?: number | null;
  loadValue?: number | null;
  loadUnit?: string | null;
  durationSeconds?: number | null;
};

export type LoggedSessionView = {
  names: string[];
  minutes: number;
};

/**
 * What a logged or completed day should show on the card and the detail page.
 * Names and minutes come from the sets that were actually ticked.
 */
export function loggedSessionView(session: {
  status?: string | null;
  elapsedSeconds?: number | null;
  performedAt: Date;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  sets: readonly LoggedSet[];
}): LoggedSessionView | null {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const set of session.sets) {
    if (!setIsTicked(set)) continue;
    const name = (set.exerciseName ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  if (names.length === 0) return null;
  const stored = session.elapsedSeconds;
  const clock =
    typeof stored === "number" && Number.isFinite(stored) && stored > 0
      ? Math.min(SESSION_DURATION_CAP_SECONDS, Math.round(stored))
      : null;
  const share: ShareSessionLike = {
    title: "",
    status: session.status === "partial" ? "partial" : "complete",
    performedAt: session.performedAt,
    createdAt: session.createdAt ?? session.performedAt,
    updatedAt: session.updatedAt ?? session.performedAt,
    elapsedSeconds: session.elapsedSeconds ?? null,
    sets: session.sets.map((set) => ({
      exerciseName: set.exerciseName ?? "",
      reps: set.reps ?? null,
      loadValue: set.loadValue ?? null,
      loadUnit: set.loadUnit === "kg" ? "kg" : "lb",
      completed: Boolean(set.completed),
      durationSeconds: set.durationSeconds ?? null,
    })),
  };
  const seconds = clock ?? sessionDurationSeconds(share);
  return {
    names,
    minutes: seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0,
  };
}
