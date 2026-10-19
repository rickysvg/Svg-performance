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
  if (level === "beginner") return 2;
  if (level === "advanced") return 4;
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

export function bagDaysForLevel(level?: string | null, trainingFocus?: string | null) {
  if (isScOnly(trainingFocus)) return 0;
  return level === "beginner" ? 2 : 3;
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
    const row = item as { weekday?: unknown; kind?: unknown; time?: unknown };
    if (typeof row.weekday !== "string" || !isTrainingWeekday(row.weekday)) continue;
    if (seen.has(row.weekday)) continue;
    const kind: OutsideKind = row.kind === "sparring" ? "sparring" : "class";
    const time =
      typeof row.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)
        ? row.time
        : undefined;
    seen.add(row.weekday);
    days.push({ weekday: row.weekday, kind, time });
  }
  return days;
}

export function normalizeOutsideInput(
  rows: Array<{ weekday: string; kind?: string; time?: string }>,
) {
  return parseOutsideTraining(
    JSON.stringify(
      rows.map((row) => ({
        weekday: row.weekday,
        kind: row.kind === "sparring" ? "sparring" : "class",
        ...(row.time?.trim() ? { time: row.time.trim() } : {}),
      })),
    ),
  );
}

export function serializeOutsideTraining(days: OutsideDay[]) {
  return JSON.stringify(
    days.map((day) => ({
      weekday: day.weekday,
      kind: day.kind,
      ...(day.time ? { time: day.time } : {}),
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
  const name = day.kind === "sparring" ? "Sparring" : "Class / drilling";
  const clock = formatClockTime(day.time);
  return clock ? `${name} · ${clock}` : name;
}

/**
 * Full-week roles. Lift count is capped at 4. Sparring days get no work.
 * Class/drilling days stay light. The day before either stays off heavy legs
 * and max intervals. Bag sessions stack onto lift days when the week is full.
 */
export function assignWeek(input: {
  trainingFocus?: string | null;
  liftDaysPerWeek?: number | null;
  experienceLevel?: string | null;
  email?: string | null;
  outsideTraining?: OutsideDay[] | null;
}): Record<TrainingWeekday, DayRole> {
  const outside = input.outsideTraining ?? [];
  const byDay = new Map(outside.map((day) => [day.weekday, day]));
  const sparring = new Set(outside.filter((day) => day.kind === "sparring").map((day) => day.weekday));
  const classDays = new Set(outside.filter((day) => day.kind === "class").map((day) => day.weekday));
  const blocked = new Set<TrainingWeekday>([...sparring, ...classDays]);
  const preClass = new Set<TrainingWeekday>();
  const preSpar = new Set<TrainingWeekday>();
  const pre = new Set<TrainingWeekday>();
  for (const day of outside) {
    const before = prevWeekday(day.weekday);
    pre.add(before);
    if (day.kind === "sparring") preSpar.add(before);
    else preClass.add(before);
  }

  const roles = {} as Record<TrainingWeekday, DayRole>;
  for (const day of ORDER) {
    roles[day] = {
      lift: null,
      bag: null,
      cardio: null,
      mobility: null,
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
    pre.add(prevWeekday("Saturday"));
    preSpar.add(prevWeekday("Saturday"));
  }

  const liftCap = Math.min(3, resolveLiftDays(input));
  const liftOrder: TrainingWeekday[] = ["Monday", "Tuesday", "Thursday"];
  const liftKind: Partial<Record<TrainingWeekday, LiftKind>> = {
    Monday: "lower",
    Tuesday: "pull",
    Thursday: "posterior",
  };
  for (const day of liftOrder) {
    if (ORDER.filter((name) => roles[name].lift).length >= liftCap) break;
    if (blocked.has(day)) continue;
    roles[day].lift = day === "Thursday" && preSpar.has(day) ? "moderate-upper" : liftKind[day] ?? "posterior";
  }

  const mobilityTargets: TrainingWeekday[] = isScOnly(input.trainingFocus)
    ? ["Wednesday", "Sunday"]
    : ["Wednesday", "Friday", "Sunday"];
  mobilityTargets.forEach((day, index) => {
    if (sparring.has(day)) return;
    roles[day].mobility = index === 0 ? "primary" : "secondary";
  });

  if (!isScOnly(input.trainingFocus)) {
    const beginner = input.experienceLevel === "beginner";
    const bagPlan: Array<[TrainingWeekday, BagIntensity]> = beginner
      ? [
          ["Monday", "hard"],
          ["Friday", "moderate"],
        ]
      : [
          ["Monday", "hard"],
          ["Tuesday", "moderate"],
          ["Thursday", "hard"],
          ["Friday", preSpar.has("Friday") ? "moderate" : "hard"],
        ];
    for (const [day, intensity] of bagPlan) {
      if (sparring.has(day) || classDays.has(day) || preClass.has(day)) continue;
      roles[day].bag = intensity;
    }
  }

  for (const day of ORDER) {
    const role = roles[day];
    if (sparring.has(day)) continue;
    if (classDays.has(day)) {
      role.cardio = "easy";
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
