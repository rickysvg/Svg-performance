const floors = new Map<string, number>();

/** Remember the highest sequence the server has already accepted for this session. */
export function noteIntentFloor(sessionKey: string, floor: number) {
  if (!Number.isInteger(floor) || floor < 0) return;
  const current = floors.get(sessionKey) ?? 0;
  if (floor > current) floors.set(sessionKey, floor);
}

/** Next sequence for a member's click. Later clicks on this page outrank earlier ones. */
export function nextIntentSeq(sessionKey: string) {
  const next = (floors.get(sessionKey) ?? 0) + 1;
  floors.set(sessionKey, next);
  return next;
}

export function latestIntentSeq(sessionKey: string) {
  return floors.get(sessionKey) ?? 0;
}

export type SessionUndoTarget = {
  sessionKey: string;
  weekStart: string;
  toDay: string;
};

export function sessionUndoTarget(target: SessionUndoTarget) {
  return JSON.stringify(target);
}

export function readSessionUndoTarget(raw: string): SessionUndoTarget | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SessionUndoTarget> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof parsed.sessionKey !== "string" || !parsed.sessionKey) return null;
    if (typeof parsed.weekStart !== "string" || !parsed.weekStart) return null;
    if (typeof parsed.toDay !== "string" || !parsed.toDay) return null;
    return { sessionKey: parsed.sessionKey, weekStart: parsed.weekStart, toDay: parsed.toDay };
  } catch {
    return null;
  }
}
