export type LoggerProgressSet = {
  id: string;
  completed: boolean;
};

export type LoggerProgressGroup = {
  name: string;
  sets: LoggerProgressSet[];
};

export type LoggerCursor = {
  exerciseIndex: number;
  exerciseCount: number;
  exerciseName: string;
  setIndex: number;
  setCount: number;
  done: boolean;
};

export function loggerCursor(groups: LoggerProgressGroup[]): LoggerCursor {
  const exerciseCount = groups.length;
  const fallback: LoggerCursor = {
    exerciseIndex: 0,
    exerciseCount,
    exerciseName: "",
    setIndex: 0,
    setCount: 0,
    done: exerciseCount === 0,
  };
  if (exerciseCount === 0) return fallback;

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const open = group.sets.findIndex((set) => !set.completed);
    if (open >= 0) {
      return {
        exerciseIndex: index + 1,
        exerciseCount,
        exerciseName: group.name,
        setIndex: open + 1,
        setCount: group.sets.length,
        done: false,
      };
    }
  }

  const last = groups[groups.length - 1];
  return {
    exerciseIndex: exerciseCount,
    exerciseCount,
    exerciseName: last.name,
    setIndex: last.sets.length,
    setCount: last.sets.length,
    done: true,
  };
}

/**
 * Header follows the exercise the member just logged.
 * An earlier unfinished exercise does not pull the cursor back.
 */
export function loggerCursorFollowing(
  groups: LoggerProgressGroup[],
  activeName: string | null | undefined,
): LoggerCursor {
  const fallback = loggerCursor(groups);
  if (!activeName) return fallback;
  const index = groups.findIndex((group) => group.name === activeName);
  if (index < 0) return fallback;
  const group = groups[index]!;
  const open = group.sets.findIndex((set) => !set.completed);
  if (open >= 0) {
    return {
      exerciseIndex: index + 1,
      exerciseCount: groups.length,
      exerciseName: group.name,
      setIndex: open + 1,
      setCount: group.sets.length,
      done: false,
    };
  }
  for (let next = index + 1; next < groups.length; next += 1) {
    const later = groups[next]!;
    const laterOpen = later.sets.findIndex((set) => !set.completed);
    if (laterOpen >= 0) {
      return {
        exerciseIndex: next + 1,
        exerciseCount: groups.length,
        exerciseName: later.name,
        setIndex: laterOpen + 1,
        setCount: later.sets.length,
        done: false,
      };
    }
  }
  return {
    exerciseIndex: index + 1,
    exerciseCount: groups.length,
    exerciseName: group.name,
    setIndex: group.sets.length,
    setCount: group.sets.length,
    done: true,
  };
}

/** Timed rounds show how many are checked. Other modes show the open set. */
export function loggerProgressDetail(input: {
  mode: string;
  setIndex: number;
  setCount: number;
  checked: number;
}) {
  if (input.mode === "timed_round") {
    return `Done ${input.checked} of ${input.setCount}`;
  }
  return `Set ${input.setIndex} of ${input.setCount}`;
}

/** A timed round stays open until the member enters seconds. */
export function timedRoundMarkAllowed(input: {
  mode: string;
  markingDone: boolean;
  durationSeconds: number | null | undefined;
}) {
  if (!input.markingDone || input.mode !== "timed_round") return true;
  return input.durationSeconds != null && input.durationSeconds > 0;
}

/** Stable order so an undone exercise returns to its original card, not the end. */
export function orderWorkoutSets<T extends { sortOrder?: number | null; setNumber?: number | null }>(
  sets: T[],
): T[] {
  return [...sets].sort(
    (left, right) =>
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
      (left.setNumber ?? 0) - (right.setNumber ?? 0),
  );
}

/** Next open set after the one just marked done. */
export function nextIncompleteSetId(
  sets: LoggerProgressSet[],
  afterId: string,
): string | null {
  const start = sets.findIndex((set) => set.id === afterId);
  for (let index = start + 1; index < sets.length; index += 1) {
    if (!sets[index].completed) return sets[index].id;
  }
  return null;
}
