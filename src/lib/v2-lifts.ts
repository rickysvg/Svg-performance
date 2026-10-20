import { catalogStrengthDays } from "@/lib/catalog-days";

/** Trailer so one seeded row can carry week 1–3 loads. Stripped before display. */
export const WEEK_MARKER = "@@weeks";

export type WeekDose = {
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
};

export type CatalogSlot = "warmup" | "power" | "strength" | "contrast" | "french" | "density" | "gpp";

type WeekPayload = {
  slot?: CatalogSlot;
  main?: boolean;
  lift3?: boolean;
  weeks: [WeekDose, WeekDose, WeekDose];
};

export function encodeWeekNotes(
  notes: string,
  weeks: [WeekDose, WeekDose, WeekDose],
  meta?: { slot?: CatalogSlot; main?: boolean; lift3?: boolean },
) {
  const payload: WeekPayload | [WeekDose, WeekDose, WeekDose] = meta?.slot
    ? { slot: meta.slot, main: meta.main, lift3: meta.lift3, weeks }
    : weeks;
  return `${notes.trim()}\n${WEEK_MARKER}${JSON.stringify(payload)}`;
}

export function parseWeekPayload(notes?: string | null): WeekPayload | null {
  if (!notes) return null;
  const index = notes.indexOf(WEEK_MARKER);
  if (index < 0) return null;
  try {
    const parsed = JSON.parse(notes.slice(index + WEEK_MARKER.length)) as unknown;
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return { weeks: parsed.slice(0, 3) as [WeekDose, WeekDose, WeekDose] };
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as WeekPayload).weeks) &&
      (parsed as WeekPayload).weeks.length >= 3
    ) {
      const payload = parsed as WeekPayload;
      return {
        slot: payload.slot,
        main: payload.main,
        lift3: payload.lift3,
        weeks: payload.weeks.slice(0, 3) as [WeekDose, WeekDose, WeekDose],
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseWeekDoses(notes?: string | null): WeekDose[] | null {
  return parseWeekPayload(notes)?.weeks ?? null;
}

export function catalogSlot(notes?: string | null): CatalogSlot | null {
  return parseWeekPayload(notes)?.slot ?? null;
}

export function catalogMeta(notes?: string | null) {
  const payload = parseWeekPayload(notes);
  return {
    slot: payload?.slot ?? null,
    main: Boolean(payload?.main),
    lift3: Boolean(payload?.lift3),
  };
}

export function keepWeekTrailer(original: string, next?: string | null) {
  const index = original.indexOf(WEEK_MARKER);
  if (index < 0) return next ?? original;
  if (next == null || next === original) return original;
  const trailer = original.slice(index);
  const body = next.replace(/\n?@@weeks[\s\S]*$/, "").trim();
  if (!body) return trailer;
  if (body.includes(WEEK_MARKER)) return body;
  return `${body}\n${trailer}`;
}

export function stripWeekMarker(notes?: string | null) {
  if (!notes) return notes ?? "";
  const index = notes.indexOf(WEEK_MARKER);
  if (index < 0) return notes.trim();
  return notes.slice(0, index).trim();
}

/** Three full-body days plus Friday circuit, three blocks. */
export function v2StrengthDays() {
  return catalogStrengthDays();
}
