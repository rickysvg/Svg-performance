export type AthleteImagery = "male" | "female";

/** Blank, male, and any unknown value use the male Home tiles. */
export function athleteImageryOf(value: string | null | undefined): AthleteImagery {
  return value === "female" ? "female" : "male";
}

/** Persist a survey answer. Empty stays blank (shown as male). Anything else is rejected. */
export function parseAthleteImagery(value: string | null | undefined): "" | AthleteImagery | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "" || raw === "male" || raw === "female") return raw;
  return null;
}

/** Female files sit beside the male WebP: train.webp → train-female.webp. */
export function tileSrc(file: string, imagery: string | null | undefined): string {
  const base = file
    .trim()
    .replace(/^\/tiles\//, "")
    .replace(/-female(?=\.webp$)/, "")
    .replace(/\.webp$/, "");
  const leaf = athleteImageryOf(imagery) === "female" ? `${base}-female.webp` : `${base}.webp`;
  return `/tiles/${leaf}`;
}
