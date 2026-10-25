/**
 * Weekday overlay for a session move.
 * Lives outside React so a calendar refresh can remount the page without
 * putting the card back on the day the server has not caught up to yet.
 */
let placements: Record<string, string> = {};
const listeners = new Set<() => void>();
const EMPTY: Record<string, string> = {};

export function getPlanPlacements() {
  return placements;
}

export function getServerPlanPlacements() {
  return EMPTY;
}

export function subscribePlanPlacements(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: Record<string, string>) {
  if (next === placements) return;
  placements = next;
  for (const listener of listeners) listener();
}

export function replacePlanPlacements(next: Record<string, string>) {
  publish(next);
  return placements;
}

export function resetPlanPlacementsForTests() {
  placements = {};
  for (const listener of listeners) listener();
}
