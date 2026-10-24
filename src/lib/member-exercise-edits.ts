import { exerciseEditKey, type MemberExerciseEdits } from "@/lib/finish-plan";
import { listRemovalsForUser } from "@/lib/exercise-removal-store";
import { listSwapsForUser } from "@/lib/exercise-swap-store";

/** Every swap and removal for this member, grouped by program day. */
export async function loadMemberExerciseEdits(userId: string): Promise<MemberExerciseEdits> {
  const [swaps, removals] = await Promise.all([
    listSwapsForUser(userId),
    listRemovalsForUser(userId),
  ]);
  const edits: MemberExerciseEdits = new Map();
  const bucket = (programSlug: string, dayNumber: number) => {
    const key = exerciseEditKey(programSlug, dayNumber);
    const current = edits.get(key) ?? { swaps: [], removals: [] };
    edits.set(key, current);
    return current;
  };
  for (const row of swaps) {
    bucket(row.programSlug, row.dayNumber).swaps.push(row.record);
  }
  for (const row of removals) {
    bucket(row.programSlug, row.dayNumber).removals.push(row.record);
  }
  return edits;
}
