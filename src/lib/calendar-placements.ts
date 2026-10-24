export type PlacementActivity = {
  sessionKey?: string;
  weekday?: string;
};

export type PlacementDay<T extends PlacementActivity> = {
  weekday?: string;
  activities: T[];
};

/**
 * Move workout cards onto the weekday a move or undo just committed.
 * The server list can lag. Cards already sitting on the target day stay put.
 */
export function applySessionPlacements<T extends PlacementActivity>(
  days: PlacementDay<T>[],
  placements: Record<string, string>,
): PlacementDay<T>[] {
  const keys = Object.keys(placements);
  if (keys.length === 0) return days;
  const moved = new Map<string, T>();
  const stripped = days.map((day) => ({
    ...day,
    activities: day.activities.filter((activity) => {
      const target = activity.sessionKey ? placements[activity.sessionKey] : undefined;
      if (!target || !activity.sessionKey) return true;
      const home = day.weekday ?? activity.weekday;
      if (!home || target === home) return true;
      moved.set(activity.sessionKey, { ...activity, weekday: target });
      return false;
    }),
  }));
  if (moved.size === 0) return days;
  return stripped.map((day) => {
    const extras = [...moved.values()].filter((activity) => activity.weekday === day.weekday);
    if (extras.length === 0) return day;
    return { ...day, activities: [...extras, ...day.activities] };
  });
}
