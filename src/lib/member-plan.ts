import { WEEKDAYS } from "@/lib/constants";

export const TRAINING_FOCUS_MARTIAL = "martial_arts_sc";
export const TRAINING_FOCUS_SC = "sc_only";
export const RICKY_EMAIL = "rmaynez21@gmail.com";

export const LIFT_DAY_MIN = 2;
export const LIFT_DAY_MAX = 4;

export type TrainingWeekday = (typeof WEEKDAYS)[number];

export type OutsideKind = "class" | "sparring";

export type OutsideDay = {
  weekday: TrainingWeekday;
  kind: OutsideKind;
  /** 24-hour HH:MM. Optional. */
  time?: string;
  /**
   * Hard class (wrestling, MMA, live rounds that are not a sparring day).
   * Absent means "not set". False is an explicit off.
   */
  hard?: boolean;
};

export type LiftKind = "lower" | "push" | "pull" | "posterior" | "moderate-upper";
export type BagIntensity = "hard" | "moderate";
/** "hard" is the draft before the first hard day becomes a bike and the rest become repeats. */
export type CardioKind = "hard" | "hard-bike" | "hard-repeats" | "easy" | "moderate";

export type DayRole = {
  lift: LiftKind | null;
  bag: BagIntensity | null;
  cardio: CardioKind | null;
  mobility: "primary" | "secondary" | null;
  /** Off-season Friday conditioning. Camp swaps or drops it. */
  gpp: boolean;
  outside: OutsideDay | null;
};

const ORDER = WEEKDAYS;

function prevWeekday(day: TrainingWeekday): TrainingWeekday {
  const index = ORDER.indexOf(day);
  return ORDER[(index + ORDER.length - 1) % ORDER.length];
}

export function isScOnly(trainingFocus?: string | null) {
  return trainingFocus === TRAINING_FOCUS_SC;
}

export function normalizeTrainingFocus(value?: string | null) {
  return value === TRAINING_FOCUS_SC ? TRAINING_FOCUS_SC : TRAINING_FOCUS_MARTIAL;
}

export function clampLiftDays(value: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.min(LIFT_DAY_MAX, Math.max(LIFT_DAY_MIN, Math.round(value)));
}

export function defaultLiftDays(level?: string | null, email?: string | null) {
  if ((email ?? "").trim().toLowerCase() === RICKY_EMAIL) return 3;
  if (level === "advanced") return 4;
  // Beginners train the same three full-body days. Difficulty is scaled on the exercises.
  return 3;
}

export function resolveLiftDays(input: {
  liftDaysPerWeek?: number | null;
  experienceLevel?: string | null;
  email?: string | null;
}) {
  if (input.liftDaysPerWeek != null && Number.isFinite(input.liftDaysPerWeek)) {
    return clampLiftDays(input.liftDaysPerWeek);
  }
  return defaultLiftDays(input.experienceLevel, input.email);
}

export function bagDaysForLevel(_level?: string | null, trainingFocus?: string | null) {
  if (isScOnly(trainingFocus)) return 0;
  return 3;
}

export function isTrainingWeekday(value: string): value is TrainingWeekday {
  return (ORDER as readonly string[]).includes(value);
}

export function parseOutsideTraining(raw: string | null | undefined): OutsideDay[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const days: OutsideDay[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as { weekday?: unknown; kind?: unknown; time?: unknown; hard?: unknown };
    if (typeof row.weekday !== "string" || !isTrainingWeekday(row.weekday)) continue;
    if (seen.has(row.weekday)) continue;
    const kind: OutsideKind = row.kind === "sparring" ? "sparring" : "class";
    const time =
      typeof row.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)
        ? row.time
        : undefined;
    const hard = row.hard === true ? true : row.hard === false ? false : undefined;
    seen.add(row.weekday);
    days.push({ weekday: row.weekday, kind, time, ...(hard === undefined ? {} : { hard }) });
  }
  return days;
}

export function normalizeOutsideInput(
  rows: Array<{ weekday: string; kind?: string; time?: string; hard?: boolean }>,
) {
  return parseOutsideTraining(
    JSON.stringify(
      rows.map((row) => ({
        weekday: row.weekday,
        kind: row.kind === "sparring" ? "sparring" : "class",
        ...(row.time?.trim() ? { time: row.time.trim() } : {}),
        hard: row.hard === true,
      })),
    ),
  );
}

/** A hard checkbox saves that weekday even when the day box itself is off. */
export function outsideRowsFromForm(formData: FormData) {
  const checked = new Set(formData.getAll("outsideWeekday").map(String));
  const rows = WEEKDAYS.flatMap((weekday) => {
    const hard = formData.get(`outsideHard-${weekday}`) === "on";
    if (!checked.has(weekday) && !hard) return [];
    return [
      {
        weekday,
        kind: String(formData.get(`outsideKind-${weekday}`) ?? "class"),
        time: String(formData.get(`outsideTime-${weekday}`) ?? ""),
        hard,
      },
    ];
  });
  return normalizeOutsideInput(rows);
}

export function serializeOutsideTraining(days: OutsideDay[]) {
  return JSON.stringify(
    days.map((day) => ({
      weekday: day.weekday,
      kind: day.kind,
      ...(day.time ? { time: day.time } : {}),
      ...(day.hard === true || day.hard === false ? { hard: day.hard } : {}),
    })),
  );
}

export function formatClockTime(time?: string) {
  if (!time) return "";
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return time;
  const hour24 = Number(match[1]);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

export function outsideDayLabel(day: OutsideDay) {
  const name =
    day.kind === "sparring" ? "Sparring" : day.hard ? "Hard class" : "Class / drilling";
  const clock = formatClockTime(day.time);
  return clock ? `${name} · ${clock}` : name;
}

/**
 * Schedule used by the week planner.
 * Ricky spars on Saturday only. Wednesday is a hard class day unless he saved hard: false.
 * That default is applied here and is not written back to his profile.
 */
export function resolveOutsideDays(input: {
  outsideTraining?: OutsideDay[] | null;
  trainingFocus?: string | null;
  email?: string | null;
}): OutsideDay[] {
  const days = v2OutsideDays(input.outsideTraining ?? [], input.trainingFocus).map((day) => ({
    ...day,
  }));
  const ricky = (input.email ?? "").trim().toLowerCase() === RICKY_EMAIL;
  if (!ricky) return days;
  const withoutOtherSparring = days.filter(
    (day) => day.kind !== "sparring" || day.weekday === "Saturday",
  );
  const wednesdayIndex = withoutOtherSparring.findIndex((day) => day.weekday === "Wednesday");
  if (wednesdayIndex === -1) {
    withoutOtherSparring.push({ weekday: "Wednesday", kind: "class", time: "18:00", hard: true });
  } else if (withoutOtherSparring[wednesdayIndex]?.hard !== false) {
    const current = withoutOtherSparring[wednesdayIndex]!;
    withoutOtherSparring[wednesdayIndex] = {
      ...current,
      kind: "class",
      hard: true,
      time: current.time ?? "18:00",
    };
  }
  return withoutOtherSparring;
}

/**
 * Drop an untimed Wednesday sparring row left by the old template.
 * Saturday is the sparring day. A Wednesday sparring time is intentional and stays.
 */
export function v2OutsideDays(
  days: OutsideDay[],
  trainingFocus?: string | null,
): OutsideDay[] {
  const addsSaturday =
    !isScOnly(trainingFocus) && !days.some((day) => day.weekday === "Saturday");
  const saturdaySparring =
    addsSaturday || days.some((day) => day.weekday === "Saturday" && day.kind === "sparring");
  if (!saturdaySparring) return days;
  return days.filter((day) => {
    if (day.weekday !== "Wednesday" || day.kind !== "sparring") return true;
    return Boolean(day.time);
  });
}

/**
 * Full-week roles. Every profile gets three full-body lifts (Mon / Tue / Thu),
 * bikes on Wednesday and Sunday, and Saturday sparring for martial weeks.
 * A saved lift-day count does not drop Thursday. Sparring and class still block that weekday.
 */
export function assignWeek(input: {
  trainingFocus?: string | null;
  liftDaysPerWeek?: number | null;
  experienceLevel?: string | null;
  email?: string | null;
  outsideTraining?: OutsideDay[] | null;
}): Record<TrainingWeekday, DayRole> {
  const outside = resolveOutsideDays(input);
  const byDay = new Map(outside.map((day) => [day.weekday, day]));
  const sparring = new Set(outside.filter((day) => day.kind === "sparring").map((day) => day.weekday));
  const classDays = new Set(outside.filter((day) => day.kind === "class").map((day) => day.weekday));
  const hardClass = new Set(
    outside.filter((day) => day.kind === "class" && day.hard === true).map((day) => day.weekday),
  );
  const blocked = new Set<TrainingWeekday>([...sparring, ...classDays]);
  const preClass = new Set<TrainingWeekday>();
  for (const day of outside) {
    if (day.kind === "class") preClass.add(prevWeekday(day.weekday));
  }

  const roles = {} as Record<TrainingWeekday, DayRole>;
  for (const day of ORDER) {
    roles[day] = {
      lift: null,
      bag: null,
      cardio: null,
      mobility: null,
      gpp: false,
      outside: byDay.get(day) ?? null,
    };
  }

  // Saturday sparring is the martial default. Strength-only weeks do not add it.
  if (!isScOnly(input.trainingFocus) && !byDay.has("Saturday")) {
    const saturday: OutsideDay = { weekday: "Saturday", kind: "sparring" };
    byDay.set("Saturday", saturday);
    roles.Saturday.outside = saturday;
    sparring.add("Saturday");
    blocked.add("Saturday");
  }

  const liftOrder: TrainingWeekday[] = ["Monday", "Tuesday", "Thursday"];
  const liftKind: Partial<Record<TrainingWeekday, LiftKind>> = {
    Monday: "lower",
    Tuesday: "pull",
    Thursday: "posterior",
  };
  for (const day of liftOrder) {
    if (blocked.has(day)) continue;
    // A scheduled sparring day does not lighten the next lift. Only a logged rating does that.
    roles[day].lift = liftKind[day] ?? "posterior";
  }

  const mobilityTargets: TrainingWeekday[] = isScOnly(input.trainingFocus)
    ? ["Wednesday", "Sunday"]
    : ["Wednesday", "Friday", "Sunday"];
  mobilityTargets.forEach((day, index) => {
    if (sparring.has(day)) return;
    roles[day].mobility = index === 0 ? "primary" : "secondary";
  });

  if (!isScOnly(input.trainingFocus)) {
    const bagPlan: Array<[TrainingWeekday, BagIntensity]> = [
      ["Monday", "hard"],
      ["Tuesday", "moderate"],
      ["Thursday", "hard"],
    ];
    for (const [day, intensity] of bagPlan) {
      if (sparring.has(day) || classDays.has(day) || preClass.has(day)) continue;
      roles[day].bag = intensity;
    }
  }

  if (!blocked.has("Friday")) roles.Friday.gpp = true;

  for (const day of ORDER) {
    const role = roles[day];
    if (sparring.has(day)) continue;
    if (classDays.has(day)) {
      role.cardio = hardClass.has(day) ? "moderate" : "easy";
      continue;
    }
    if (day === "Wednesday" || day === "Sunday") {
      role.cardio = "hard-bike";
    }
  }

  return roles;
}

export function countRoles(roles: Record<TrainingWeekday, DayRole>) {
  const days = Object.values(roles);
  return {
    lifts: days.filter((day) => day.lift).length,
    bags: days.filter((day) => day.bag).length,
    mobility: days.filter((day) => day.mobility).length,
    sparring: days.filter((day) => day.outside?.kind === "sparring").length,
    heavyLegsOnPreDay: false,
  };
}
