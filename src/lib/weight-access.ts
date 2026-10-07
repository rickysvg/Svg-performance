/** Where the member can train. Gym and weights is the default. */

export const WEIGHT_ACCESS_OPTIONS = [
  { value: "gym", label: "Gym and weights" },
  { value: "none", label: "No gym or weights" },
] as const;

export type WeightAccess = (typeof WEIGHT_ACCESS_OPTIONS)[number]["value"];

export function normalizeWeightAccess(value: string | null | undefined): WeightAccess {
  return value === "none" ? "none" : "gym";
}

export function safeTrainingNext(value: string) {
  if (!value.startsWith("/training")) return "/training";
  if (value.startsWith("//") || value.includes("://") || value.includes("\\")) return "/training";
  return value;
}
