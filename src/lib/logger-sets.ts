export type PrescriptionSetCount = {
  name: string;
  sets: number;
};

/** The set count printed on the exercise card, capped like the save validator. */
export function prescribedSetTarget(sets: number) {
  if (!Number.isFinite(sets)) return 0;
  return Math.max(0, Math.min(20, Math.round(sets)));
}

/**
 * Pre-create one row per prescribed set. Extra rows the athlete added stay.
 * Missing rows are appended so a 4-set card does not open on 2 rows.
 */
export function withPrescribedSetRows<T extends { exerciseName: string; setNumber: number }>(
  sets: T[],
  prescriptions: PrescriptionSetCount[],
  createSet: (exerciseName: string, setNumber: number) => T,
): T[] {
  if (prescriptions.length === 0) return sets;
  const next = [...sets];
  for (const prescription of prescriptions) {
    const target = prescribedSetTarget(prescription.sets);
    const existing = next.filter((set) => set.exerciseName === prescription.name);
    let missing = target - existing.length;
    if (missing <= 0) continue;
    let setNumber = existing.reduce((max, set) => Math.max(max, set.setNumber), 0);
    while (missing > 0) {
      setNumber += 1;
      next.push(createSet(prescription.name, setNumber));
      missing -= 1;
    }
  }
  return next;
}
