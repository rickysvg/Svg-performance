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
