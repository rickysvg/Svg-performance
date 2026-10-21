import { weekInBlock } from "@/lib/mesocycle";
import type { CatalogSlot } from "@/lib/v2-lifts";

const SLOT_ORDER: CatalogSlot[] = [
  "warmup",
  "power",
  "strength",
  "contrast",
  "french",
  "density",
  "gpp",
];

const SLOT_LABEL: Record<CatalogSlot, string> = {
  warmup: "Warm-up",
  power: "Power",
  strength: "Strength",
  contrast: "Contrast",
  french: "French contrast",
  density: "Conditioning",
  gpp: "Conditioning",
};

export type PlanStructureGroup<T> = {
  label: string;
  exercises: T[];
};

export function planStructureGroups<T extends { planSlot?: string | null }>(
  exercises: T[],
): PlanStructureGroup<T>[] {
  const slotted = exercises.some((exercise) => exercise.planSlot && exercise.planSlot in SLOT_LABEL);
  if (!slotted) return [];
  const buckets = new Map<string, T[]>();
  for (const exercise of exercises) {
    const label =
      exercise.planSlot && exercise.planSlot in SLOT_LABEL
        ? SLOT_LABEL[exercise.planSlot as CatalogSlot]
        : "Work";
    const list = buckets.get(label) ?? [];
    list.push(exercise);
    buckets.set(label, list);
  }
  const order = [...SLOT_ORDER.map((slot) => SLOT_LABEL[slot]), "Work"];
  const seen = new Set<string>();
  const groups: PlanStructureGroup<T>[] = [];
  for (const label of order) {
    if (seen.has(label)) continue;
    seen.add(label);
    const rows = buckets.get(label);
    if (rows && rows.length > 0) groups.push({ label, exercises: rows });
  }
  return groups;
}

export function planStructureLine(groups: { label: string }[]) {
  return groups.map((group) => group.label).join(" · ");
}

export function blockWeekLabel(weekIndex: number) {
  return `Week ${weekInBlock(weekIndex)} of 3`;
}
