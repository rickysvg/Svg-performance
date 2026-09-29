import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { canUseFeature } from "@/lib/entitlements";
import { dayKey } from "@/lib/timezone";
import type { DayPlan, PlanSessionSlot } from "@/lib/week-plan";
import {
  disciplineLabel,
  isFightDiscipline,
  type FightDiscipline,
} from "@/lib/fight-disciplines";
import { normalizeWeightClassLabel } from "@/lib/units";

export {
  FIGHT_DISCIPLINES,
  disciplineLabel,
  isFightDiscipline,
  type FightDiscipline,
} from "@/lib/fight-disciplines";

export type CampTemplateWeeks = 6 | 8 | 12;

export type CampPhase = "pre-camp" | "base" | "build" | "peak" | "taper" | "complete";

export type CampPhaseId = "base" | "build" | "peak" | "taper";

export const FIGHT_WEEK_WEIGHT_GUIDANCE =
  "Fight week is general guidance only. For weight, work with your coach or a doctor. This plan does not set a water cut or calorie targets.";

export const CAMP_NO_CUT_LINE =
  "This camp does not set a water cut or calorie targets.";

const PHASE_LABEL: Record<CampPhase, string> = {
  "pre-camp": "Pre-camp",
  base: "Base",
  build: "Build",
  peak: "Peak / sharpen",
  taper: "Fight week taper",
  complete: "Complete",
};

const DISCIPLINE_SKILL: Record<FightDiscipline, string> = {
  mma: "Striking and grappling both stay in. Shots, entries, and hands.",
  boxing: "Hands, feet, and defense. Jab, cross, and hook on the bag or pads.",
  kickboxing: "Kicks and boxing combinations. Teep, low kick, and hands.",
  bjj: "Positional rounds, escapes, and submissions. Drill before you roll.",
  "muay-thai": "Kicks, teeps, knees, and clinch. Keep the guard home.",
};

const PHASE_TRAINING: Record<CampPhaseId, string> = {
  base: "Build the base. Skill rounds and strength stay in. Conditioning stays steady, not all-out.",
  build: "More specific work. Keep strength. Sharpen the combinations you will use.",
  peak: "Less volume, keep speed. Shorter sessions. Ease off hard sparring.",
  taper: "About 20% less volume. Keep speed and sharp pad rounds. No hard sparring.",
};

const PHASE_SKILL: Record<CampPhaseId, string> = {
  base: "Repeat the basics until they feel automatic.",
  build: "Pad rounds and skill rounds with intent. Stay technical.",
  peak: "Timing and entries. Keep the reps short and fast.",
  taper: "Short, crisp reps. Stop while you still feel fast.",
};

const PHASE_GENERAL: Record<CampPhaseId, string> = {
  base: "Sleep and normal meals. Keep the week repeatable.",
  build: "Keep routines familiar. Tell your coach if something hurts.",
  peak: "Same meals, same schedule. Nothing new this week.",
  taper: FIGHT_WEEK_WEIGHT_GUIDANCE,
};

const WEEK_DETAIL: Record<CampPhaseId, string> = {
  base: "Aerobic base, skill volume, and strength. Keep sessions repeatable.",
  build: "More specific skill. Strength stays. Conditioning gets sharper.",
  peak: "Less volume. Keep speed. Ease off hard sparring.",
  taper: "Fight week. About 20% less volume. Sharp pad rounds. General guidance only for weight.",
};

export type CampWeekRow = {
  weekNumber: number;
  phase: CampPhaseId;
  phaseLabel: string;
  title: string;
  detail: string;
  state: "done" | "current" | "upcoming";
};

export type CampGuidance = {
  training: string;
  skill: string;
  general: string;
};

export type CampSnapshot = {
  fightDateKey: string;
  todayKey: string;
  daysToFight: number;
  daysUntilCamp: number;
  templateWeeks: CampTemplateWeeks;
  weeksLeft: number;
  weekNumber: number | null;
  phase: CampPhase;
  phaseLabel: string;
  discipline: FightDiscipline | "";
  disciplineLabel: string;
  weightClass: string;
  fightDateLabel: string;
  todayFocus: string;
  guidance: CampGuidance;
  weeks: CampWeekRow[];
};

export function isTemplateWeeks(value: number): value is CampTemplateWeeks {
  return value === 6 || value === 8 || value === 12;
}

export function parseFightDateKey(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new AppError("CAMP", "Enter a fight date.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new AppError("CAMP", "That fight date is not a real calendar day.");
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function cleanWeightClass(value: string): string {
  const trimmed = normalizeWeightClassLabel(value.trim().replace(/\s+/g, " ")).slice(0, 40);
  if (/kcal|calorie/i.test(trimmed)) {
    throw new AppError("CAMP", "Enter a weight class, not a calorie target.");
  }
  return trimmed;
}

export function parseDiscipline(value: string): FightDiscipline | "" {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isFightDiscipline(trimmed)) {
    throw new AppError("CAMP", "Pick a discipline from the list, or leave it blank.");
  }
  return trimmed;
}

export function civilDayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return civilDayNumber(toKey) - civilDayNumber(fromKey);
}

/**
 * Weeks left counts 7-day blocks back from the fight date.
 * 0 means fight week (the fight day and the six days before it).
 * Template is frozen at save:
 * - 12 weeks when 8 or more weeks are left (week 1 starts at 11 weeks left; earlier is pre-camp)
 * - 8 weeks when 5, 6, or 7 weeks are left
 * - 6 weeks when fewer than 5 weeks are left
 */
export function selectTemplateWeeks(daysToFight: number): CampTemplateWeeks {
  const weeksLeft = Math.floor(Math.max(0, daysToFight) / 7);
  if (weeksLeft >= 8) return 12;
  if (weeksLeft >= 5) return 8;
  return 6;
}

export function phaseForCampWeek(week: number, total: CampTemplateWeeks): CampPhaseId {
  if (week >= total) return "taper";
  if (total === 12) {
    if (week <= 4) return "base";
    if (week <= 8) return "build";
    return "peak";
  }
  if (total === 8) {
    if (week <= 3) return "base";
    if (week <= 6) return "build";
    return "peak";
  }
  if (week <= 2) return "base";
  if (week <= 4) return "build";
  return "peak";
}

export function formatFightDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utc);
  return formatted.replace(",", "");
}

function skillLine(discipline: FightDiscipline | ""): string {
  if (!discipline) {
    return "Skill work that matches how you fight. Ask your coach which rounds matter most.";
  }
  return DISCIPLINE_SKILL[discipline];
}

function guidanceFor(phase: CampPhase, discipline: FightDiscipline | ""): CampGuidance {
  if (phase === "pre-camp") {
    return {
      training: "Train your normal week. Camp volume starts when the window opens.",
      skill: skillLine(discipline),
      general: "Nothing to peak yet. Keep sleep and meals normal.",
    };
  }
  if (phase === "complete") {
    return {
      training: "This camp is over. Set a new fight date or cancel it.",
      skill: skillLine(discipline),
      general: CAMP_NO_CUT_LINE,
    };
  }
  return {
    training: PHASE_TRAINING[phase],
    skill: `${skillLine(discipline)} ${PHASE_SKILL[phase]}`,
    general: PHASE_GENERAL[phase],
  };
}

function todayFocusFor(input: {
  phase: CampPhase;
  discipline: FightDiscipline | "";
  daysUntilCamp: number;
}): string {
  const skill = skillLine(input.discipline);
  if (input.phase === "pre-camp") {
    const days = input.daysUntilCamp;
    return `Camp starts in ${days} day${days === 1 ? "" : "s"}. Until then, train your normal week. ${skill}`;
  }
  if (input.phase === "complete") {
    return "Fight day has passed. Edit the date or cancel this camp.";
  }
  if (input.phase === "taper") {
    return `Fight week taper. ${PHASE_TRAINING.taper} ${FIGHT_WEEK_WEIGHT_GUIDANCE}`;
  }
  if (input.phase === "base") {
    return `Base phase. ${skill} ${PHASE_TRAINING.base}`;
  }
  if (input.phase === "build") {
    return `Build phase. ${skill} ${PHASE_TRAINING.build}`;
  }
  return `Peak / sharpen. ${PHASE_TRAINING.peak} ${skill}`;
}

export function buildCampSnapshot(input: {
  fightDateKey: string;
  templateWeeks: CampTemplateWeeks;
  todayKey: string;
  discipline: FightDiscipline | "";
  weightClass: string;
}): CampSnapshot {
  const fightDateKey = parseFightDateKey(input.fightDateKey);
  const todayKey = parseFightDateKey(input.todayKey);
  const daysToFight = daysBetweenKeys(todayKey, fightDateKey);
  const templateWeeks = input.templateWeeks;
  const campStartDays = templateWeeks * 7 - 1;
  const daysUntilCamp = Math.max(0, daysToFight - campStartDays);
  const weeksLeft = daysToFight < 0 ? -1 : Math.floor(daysToFight / 7);

  let phase: CampPhase;
  let weekNumber: number | null;
  if (daysToFight < 0) {
    phase = "complete";
    weekNumber = null;
  } else {
    const rawWeek = templateWeeks - weeksLeft;
    if (rawWeek < 1) {
      phase = "pre-camp";
      weekNumber = null;
    } else {
      weekNumber = Math.min(templateWeeks, rawWeek);
      phase = phaseForCampWeek(weekNumber, templateWeeks);
    }
  }

  const weeks: CampWeekRow[] = [];
  for (let week = 1; week <= templateWeeks; week += 1) {
    const weekPhase = phaseForCampWeek(week, templateWeeks);
    let state: CampWeekRow["state"] = "upcoming";
    if (phase === "complete") state = "done";
    else if (weekNumber != null && week < weekNumber) state = "done";
    else if (weekNumber != null && week === weekNumber) state = "current";
    weeks.push({
      weekNumber: week,
      phase: weekPhase,
      phaseLabel: PHASE_LABEL[weekPhase],
      title: `Week ${week}`,
      detail: WEEK_DETAIL[weekPhase],
      state,
    });
  }

  return {
    fightDateKey,
    todayKey,
    daysToFight,
    daysUntilCamp,
    templateWeeks,
    weeksLeft,
    weekNumber,
    phase,
    phaseLabel: PHASE_LABEL[phase],
    discipline: input.discipline,
    disciplineLabel: input.discipline ? disciplineLabel(input.discipline) : "",
    weightClass: normalizeWeightClassLabel(input.weightClass),
    fightDateLabel: formatFightDate(fightDateKey),
    todayFocus: todayFocusFor({
      phase,
      discipline: input.discipline,
      daysUntilCamp,
    }),
    guidance: guidanceFor(phase, input.discipline),
    weeks,
  };
}

export function shapeDayPlan(day: DayPlan, phase: CampPhase): DayPlan {
  if (phase === "pre-camp" || phase === "complete") return day;
  if (!day.active) {
    if (phase === "taper") {
      return {
        ...day,
        summary: "Fight week rest",
        skipReason: "Rest or an easy walk. Save the sharp rounds for training days.",
      };
    }
    return {
      ...day,
      summary: phase === "peak" ? "Rest · sharpen week" : day.summary,
    };
  }

  const mapSession = (session: PlanSessionSlot): PlanSessionSlot => {
    if (phase === "taper") {
      if (session.kind === "conditioning") return { ...session, label: "Easy conditioning" };
      if (session.kind === "strength") return { ...session, label: "Light strength · speed" };
      if (session.kind === "skill") return { ...session, label: "Sharp pad rounds" };
    }
    if (phase === "peak" && session.kind === "conditioning") {
      return { ...session, label: "Short conditioning" };
    }
    return session;
  };

  const sessions =
    phase === "taper"
      ? day.sessions.filter((session) => !session.optional).map(mapSession)
      : day.sessions.map(mapSession);

  const prefix =
    phase === "taper"
      ? "Fight week taper · less volume, keep speed"
      : phase === "peak"
        ? `Sharpen · ${day.summary}`
        : phase === "build"
          ? `Build · ${day.summary}`
          : `Base · ${day.summary}`;

  return {
    ...day,
    summary: prefix,
    sessions: sessions.length > 0 ? sessions : day.sessions,
  };
}

/** Static camp copy, joined for safety checks. No water amounts and no calorie targets. */
export function campTemplateText(): string {
  return [
    FIGHT_WEEK_WEIGHT_GUIDANCE,
    CAMP_NO_CUT_LINE,
    ...Object.values(PHASE_LABEL),
    ...Object.values(PHASE_TRAINING),
    ...Object.values(PHASE_SKILL),
    ...Object.values(PHASE_GENERAL),
    ...Object.values(WEEK_DETAIL),
    ...Object.values(DISCIPLINE_SKILL),
  ].join("\n");
}

async function assertFightCampAccess(userId: string, now: Date) {
  const allowed = await canUseFeature(userId, "fight_camp", now);
  if (!allowed) {
    throw new AppError(
      "PLAN",
      "Fight camp is on Performance. Paid plans coming soon.",
    );
  }
}

export async function getFightCampRow(userId: string) {
  return prisma.fightCamp.findUnique({ where: { userId } });
}

export async function getActiveCampSnapshot(
  userId: string,
  now: Date,
  timeZone: string,
): Promise<CampSnapshot | null> {
  const allowed = await canUseFeature(userId, "fight_camp", now);
  if (!allowed) return null;
  const row = await getFightCampRow(userId);
  if (!row || row.status !== "active" || !isTemplateWeeks(row.templateWeeks)) return null;
  const discipline = isFightDiscipline(row.discipline) ? row.discipline : "";
  return buildCampSnapshot({
    fightDateKey: row.fightDateKey,
    templateWeeks: row.templateWeeks,
    todayKey: dayKey(now, timeZone),
    discipline,
    weightClass: row.weightClass,
  });
}

export async function saveFightCampForUser(
  userId: string,
  input: { fightDate: string; weightClass: string; discipline: string },
  now: Date,
  timeZone: string,
) {
  await assertFightCampAccess(userId, now);
  const fightDateKey = parseFightDateKey(input.fightDate);
  const todayKey = dayKey(now, timeZone);
  const daysToFight = daysBetweenKeys(todayKey, fightDateKey);
  if (daysToFight < 0) {
    throw new AppError("CAMP", "Pick a fight date that is today or later.");
  }
  const templateWeeks = selectTemplateWeeks(daysToFight);
  const weightClass = cleanWeightClass(input.weightClass);
  const discipline = parseDiscipline(input.discipline);
  return prisma.fightCamp.upsert({
    where: { userId },
    create: {
      userId,
      fightDateKey,
      weightClass,
      discipline,
      templateWeeks,
      status: "active",
    },
    update: {
      fightDateKey,
      weightClass,
      discipline,
      templateWeeks,
      status: "active",
      cancelledAt: null,
    },
  });
}

export async function cancelFightCampForUser(userId: string, now = new Date()) {
  await assertFightCampAccess(userId, now);
  const row = await getFightCampRow(userId);
  if (!row || row.status !== "active") {
    throw new AppError("CAMP", "No active fight camp to cancel.");
  }
  return prisma.fightCamp.update({
    where: { userId },
    data: { status: "cancelled", cancelledAt: now },
  });
}
