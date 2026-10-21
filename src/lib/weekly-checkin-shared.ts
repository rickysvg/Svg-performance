import { normalizePlanId } from "@/lib/plans";
import {
  addZonedDays,
  dayKey,
  startOfZonedDay,
  zonedDateTimeToUtc,
  zonedParts,
  type ZonedWeekday,
} from "@/lib/timezone";

export const CHECKIN_WEEKDAYS: Array<{ value: number; label: ZonedWeekday }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/** Sunday 6:00 PM local. */
export const DEFAULT_REMINDER_WEEKDAY = 0;
export const DEFAULT_REMINDER_MINUTE = 18 * 60;

export const FOLLOW_UP_MS = 24 * 60 * 60 * 1000;

export const BODY_REGIONS = [
  { id: "head", label: "Head" },
  { id: "neck", label: "Neck" },
  { id: "shoulder_l", label: "L shoulder" },
  { id: "shoulder_r", label: "R shoulder" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "arm_l", label: "L arm" },
  { id: "arm_r", label: "R arm" },
  { id: "wrist_l", label: "L wrist" },
  { id: "wrist_r", label: "R wrist" },
  { id: "hip_l", label: "L hip" },
  { id: "hip_r", label: "R hip" },
  { id: "knee_l", label: "L knee" },
  { id: "knee_r", label: "R knee" },
  { id: "ankle_l", label: "L ankle" },
  { id: "ankle_r", label: "R ankle" },
] as const;

export type BodyRegionId = (typeof BODY_REGIONS)[number]["id"];

const REGION_IDS = new Set<string>(BODY_REGIONS.map((row) => row.id));

export type CheckInFlagCode =
  | "injury"
  | "head_contact"
  | "weight_change"
  | "missed_sessions"
  | "low_energy_trend";

export type CheckInFlag = {
  code: CheckInFlagCode;
  label: string;
  detail: string;
};

export type CheckInScores = {
  bodyweightLb: number | null;
  previousWeightLb: number | null;
  sleepQuality: number;
  energy: number;
  previousEnergy: number | null;
  stress: number;
  regions: string[];
  sorenessNotes: string;
  sessionsCompleted: number;
  sessionsPlanned: number;
  sparringSummary: string;
  wins: string;
  struggles: string;
};

const INJURY_PATTERN =
  /\b(injur(?:y|ed|ies)|pain|painful|hurt|hurts|sprain(?:ed)?|strain(?:ed)?|tweak(?:ed)?|swollen|swelling|tear|torn|sharp|broke|broken|popped|twinge)\b/i;

const HEAD_PATTERN =
  /\b(head|concussion|knocked out|knockout|ko'd|eye poke|hard spar(?:ring)?|head kick|head shot)\b/i;

/**
 * Catalog id for VIP Coaching ($249/mo). Display name only; the id stays `coaching`.
 * The simplified pricing catalog adds this id. Until that lands, checkout
 * rows may already store `coaching` or `coaching_*`.
 */
export const ONE_ON_ONE_COACHING_PLAN_ID = "coaching";

/** Older catalog ids that stay on the weekly check-in if either pricing PR merges first. */
const LEGACY_ONE_ON_ONE_PLAN_IDS = new Set([
  "fighter_development",
  "elite",
  "vip",
  "platinum",
]);

export function planIsOneOnOneCoaching(plan: string | null | undefined) {
  const raw = plan?.trim().toLowerCase() ?? "";
  if (!raw) return false;
  if (raw === ONE_ON_ONE_COACHING_PLAN_ID || raw.startsWith(`${ONE_ON_ONE_COACHING_PLAN_ID}_`)) {
    return true;
  }
  if (LEGACY_ONE_ON_ONE_PLAN_IDS.has(raw)) return true;
  const normalized = normalizePlanId(raw) as string;
  if (normalized === ONE_ON_ONE_COACHING_PLAN_ID) return true;
  return LEGACY_ONE_ON_ONE_PLAN_IDS.has(normalized);
}

export function memberHasWeeklyCheckInAccess(input: {
  planId: string | null | undefined;
  override: string | null | undefined;
}) {
  if (input.override === "force_on") return true;
  return planIsOneOnOneCoaching(input.planId);
}

export function clampScore(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

export function parseRegionIds(raw: unknown): BodyRegionId[] {
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      return parseRegionIds(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : [];
  const ids: BodyRegionId[] = [];
  for (const item of list) {
    const id = String(item).trim();
    if (!REGION_IDS.has(id)) continue;
    if (!ids.includes(id as BodyRegionId)) ids.push(id as BodyRegionId);
  }
  return ids;
}

export function regionLabel(id: string) {
  return BODY_REGIONS.find((row) => row.id === id)?.label ?? id;
}

const WEEKDAY_INDEX: Record<ZonedWeekday, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * The reminder that currently governs this member.
 * A cycle runs from the chosen local day and time until the next one.
 * Before this week's clock time, the previous cycle is still the open one.
 */
export function governingReminder(
  now: Date,
  timeZone: string,
  weekday = DEFAULT_REMINDER_WEEKDAY,
  minuteOfDay = DEFAULT_REMINDER_MINUTE,
) {
  const prefs = normalizeReminderPrefs(weekday, minuteOfDay);
  const today = startOfZonedDay(now, timeZone);
  const todayIndex = WEEKDAY_INDEX[zonedParts(today, timeZone).weekday];
  const diff = (todayIndex - prefs.weekday + 7) % 7;
  const weekMidnight = addZonedDays(today, -diff, timeZone);
  const at = clockOn(weekMidnight, prefs.minuteOfDay, timeZone);
  if (now.getTime() >= at.getTime()) return at;
  return clockOn(addZonedDays(weekMidnight, -7, timeZone), prefs.minuteOfDay, timeZone);
}

function clockOn(day: Date, minuteOfDay: number, timeZone: string) {
  const parts = zonedParts(day, timeZone);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, hour, minute, timeZone);
}

export function checkInWeekKey(
  now: Date,
  timeZone: string,
  weekday = DEFAULT_REMINDER_WEEKDAY,
  minuteOfDay = DEFAULT_REMINDER_MINUTE,
) {
  return dayKey(governingReminder(now, timeZone, weekday, minuteOfDay), timeZone);
}

export function normalizeReminderPrefs(weekday: number, minuteOfDay: number) {
  const day = Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : DEFAULT_REMINDER_WEEKDAY;
  const minute =
    Number.isInteger(minuteOfDay) && minuteOfDay >= 0 && minuteOfDay < 24 * 60
      ? minuteOfDay
      : DEFAULT_REMINDER_MINUTE;
  return { weekday: day, minuteOfDay: minute };
}

/** Local clock time of the reminder cycle that contains `now`. */
export function reminderInstant(
  now: Date,
  timeZone: string,
  weekday = DEFAULT_REMINDER_WEEKDAY,
  minuteOfDay = DEFAULT_REMINDER_MINUTE,
) {
  return governingReminder(now, timeZone, weekday, minuteOfDay);
}

export function isWeeklyCheckInDue(input: {
  now: Date;
  timeZone: string;
  weekday?: number;
  minuteOfDay?: number;
  submitted: boolean;
}) {
  if (input.submitted) return false;
  const at = reminderInstant(
    input.now,
    input.timeZone,
    input.weekday ?? DEFAULT_REMINDER_WEEKDAY,
    input.minuteOfDay ?? DEFAULT_REMINDER_MINUTE,
  );
  return input.now.getTime() >= at.getTime();
}

export type ReminderDecision = "initial" | "followup" | "none";

export function decideCheckInReminder(input: {
  now: Date;
  timeZone: string;
  weekday?: number;
  minuteOfDay?: number;
  submitted: boolean;
  initialSentAt: Date | null;
  followUpSent: boolean;
}): ReminderDecision {
  if (input.submitted) return "none";
  if (
    !isWeeklyCheckInDue({
      now: input.now,
      timeZone: input.timeZone,
      weekday: input.weekday,
      minuteOfDay: input.minuteOfDay,
      submitted: false,
    })
  ) {
    return "none";
  }
  if (!input.initialSentAt) return "initial";
  if (input.followUpSent) return "none";
  if (input.now.getTime() - input.initialSentAt.getTime() >= FOLLOW_UP_MS) return "followup";
  return "none";
}

export function formatReminderClock(minuteOfDay: number) {
  const prefs = normalizeReminderPrefs(DEFAULT_REMINDER_WEEKDAY, minuteOfDay);
  const hour24 = Math.floor(prefs.minuteOfDay / 60);
  const minute = prefs.minuteOfDay % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function weekdayLabel(weekday: number) {
  return CHECKIN_WEEKDAYS.find((row) => row.value === normalizeReminderPrefs(weekday, 0).weekday)?.label ?? "Sunday";
}

export function weightChangeRatio(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous <= 0) return null;
  return Math.abs(current - previous) / previous;
}

export function detectCheckInFlags(input: CheckInScores): CheckInFlag[] {
  const flags: CheckInFlag[] = [];
  const notes = [input.sorenessNotes, input.struggles, input.wins].join("\n");
  const injuryHit = INJURY_PATTERN.test(notes) || input.sorenessNotes.trim().length > 0;
  if (injuryHit) {
    const where = input.regions.map(regionLabel);
    const place = where.length > 0 ? ` Marked: ${where.join(", ")}.` : "";
    flags.push({
      code: "injury",
      label: "Injury",
      detail: input.sorenessNotes.trim()
        ? `${input.sorenessNotes.trim()}.${place}`.trim()
        : `Soreness or injury language in the check-in.${place}`.trim(),
    });
  }

  const headText = [input.sparringSummary, input.sorenessNotes, input.struggles, input.wins].join("\n");
  const headMarked = input.regions.includes("head");
  if (HEAD_PATTERN.test(headText) || headMarked) {
    flags.push({
      code: "head_contact",
      label: "Head contact",
      detail: headMarked
        ? "Head is marked on the body map."
        : "The week mentions head contact.",
    });
  }

  const change = weightChangeRatio(input.bodyweightLb, input.previousWeightLb);
  if (change != null && change > 0.02 && input.bodyweightLb != null && input.previousWeightLb != null) {
    const direction = input.bodyweightLb > input.previousWeightLb ? "up" : "down";
    const pct = Math.round(change * 1000) / 10;
    flags.push({
      code: "weight_change",
      label: "Weight change",
      detail: `${input.previousWeightLb} lb → ${input.bodyweightLb} lb (${pct}% ${direction}).`,
    });
  }

  if (input.sessionsPlanned > 0 && input.sessionsCompleted < input.sessionsPlanned) {
    flags.push({
      code: "missed_sessions",
      label: "Missed sessions",
      detail: `${input.sessionsCompleted} of ${input.sessionsPlanned} sessions logged.`,
    });
  }

  if (
    input.energy <= 2 &&
    input.previousEnergy != null &&
    input.previousEnergy <= 2
  ) {
    flags.push({
      code: "low_energy_trend",
      label: "Low energy",
      detail: `Energy ${input.previousEnergy}/5 last week and ${input.energy}/5 this week.`,
    });
  }

  return flags;
}

export function sortCheckInsFlaggedFirst<T extends { flagCount: number; submittedAt: Date }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aFlagged = a.flagCount > 0;
    const bFlagged = b.flagCount > 0;
    if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
    if (a.flagCount !== b.flagCount) return b.flagCount - a.flagCount;
    return b.submittedAt.getTime() - a.submittedAt.getTime();
  });
}

function firstName(displayName: string) {
  const name = displayName.trim().split(/\s+/)[0];
  return name || "Athlete";
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export type CheckInDraft = {
  summary: string;
  flags: CheckInFlag[];
  reply: string;
  tweaks: string;
  source: "openai" | "fallback";
};

export function fallbackCheckInDraft(
  input: CheckInScores & { displayName?: string },
): CheckInDraft {
  const flags = detectCheckInFlags(input);
  const name = firstName(input.displayName ?? "");
  const weight =
    input.bodyweightLb != null ? `${input.bodyweightLb} lb` : "weight not logged";
  const sparring = input.sparringSummary.trim()
    ? clip(input.sparringSummary, 140)
    : "No sparring logged.";
  const summary = [
    `${weight}. Sleep ${input.sleepQuality}/5, energy ${input.energy}/5, stress ${input.stress}/5.`,
    `Sessions ${input.sessionsCompleted} of ${input.sessionsPlanned}. ${sparring}`,
    `Wins: ${clip(input.wins, 90) || "—"}. Struggles: ${clip(input.struggles, 90) || "—"}.`,
  ].join("\n");

  const lines: string[] = [`${name}, I read the week.`];
  const tweaks: string[] = [];
  if (flags.some((flag) => flag.code === "head_contact")) {
    lines.push(
      "Head contact is a flag. If symptoms show up, stop and get checked. No extra sparring this week.",
    );
    tweaks.push("Cut hard sparring until the head is clear.");
  }
  if (flags.some((flag) => flag.code === "injury")) {
    const where = input.regions.map(regionLabel).join(", ");
    lines.push(
      where
        ? `Don't train through the ${where}. Keep the next session inside what doesn't flare it.`
        : "Don't train through the sore spot. Keep the next session inside what doesn't flare it.",
    );
    tweaks.push("Drop the pattern that flares it. Keep the rest of the week.");
  }
  if (flags.some((flag) => flag.code === "missed_sessions")) {
    lines.push(
      `You logged ${input.sessionsCompleted} of ${input.sessionsPlanned}. No punishment volume. Hit the sessions already on the week.`,
    );
    tweaks.push("Do the next planned session. Don't add a makeup day.");
  }
  if (flags.some((flag) => flag.code === "weight_change")) {
    lines.push("Weight moved more than 2%. Tell me if that was on purpose.");
    tweaks.push("Hold the plan. Don't cut or add food from this one weigh-in.");
  }
  if (flags.some((flag) => flag.code === "low_energy_trend")) {
    lines.push("Energy has been low two weeks running. Sleep and the next session come before extra work.");
    tweaks.push("Cap the written sets. Stop accessories early if energy is flat.");
  }
  if (flags.length === 0) {
    lines.push("Numbers look steady. Stay on the week.");
    tweaks.push("No plan change.");
  }
  lines.push("No fluff.");

  return {
    summary,
    flags,
    reply: lines.join(" "),
    tweaks: tweaks.join(" "),
    source: "fallback",
  };
}

export function summaryLineCount(summary: string) {
  return summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function parseFlagsJson(raw: string): CheckInFlag[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<CheckInFlag>;
      if (
        row.code !== "injury" &&
        row.code !== "head_contact" &&
        row.code !== "weight_change" &&
        row.code !== "missed_sessions" &&
        row.code !== "low_energy_trend"
      ) {
        return [];
      }
      return [
        {
          code: row.code,
          label: String(row.label ?? row.code),
          detail: String(row.detail ?? ""),
        },
      ];
    });
  } catch {
    return [];
  }
}
