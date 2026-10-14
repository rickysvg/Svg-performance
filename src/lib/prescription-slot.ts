/**
 * History key for one programmed exercise.
 * The rep scheme is part of the slot, so a 5×5 day and an 8–12 day do not
 * overwrite each other. Program slug and day number keep two days that share
 * a name and a rep string (a heavy 4×6 and a lighter 3×6) apart as well.
 */
export function prescriptionSlotKey(input: {
  exerciseName: string;
  reps?: string | null;
  programSlug?: string | null;
  dayNumber?: number | null;
}): string {
  const name = input.exerciseName.trim().toLowerCase().replace(/\s+/g, " ");
  if (!name) return "";
  const reps = (input.reps ?? "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "");
  const slug = (input.programSlug ?? "").trim().toLowerCase();
  const day =
    input.dayNumber != null && Number.isFinite(input.dayNumber)
      ? String(Math.round(input.dayNumber))
      : "";
  const place = [slug, day].filter(Boolean).join(":");
  const scheme = reps ? `${name}::${reps}` : name;
  return place ? `${place}|${scheme}` : scheme;
}
