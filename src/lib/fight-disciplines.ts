export const FIGHT_DISCIPLINES = [
  { id: "mma", label: "MMA" },
  { id: "boxing", label: "Boxing" },
  { id: "kickboxing", label: "Kickboxing" },
  { id: "bjj", label: "BJJ / grappling" },
  { id: "muay-thai", label: "Muay Thai" },
] as const;

export type FightDiscipline = (typeof FIGHT_DISCIPLINES)[number]["id"];

export function isFightDiscipline(value: string): value is FightDiscipline {
  return FIGHT_DISCIPLINES.some((row) => row.id === value);
}

export function disciplineLabel(id: string): string {
  return FIGHT_DISCIPLINES.find((row) => row.id === id)?.label ?? "";
}
