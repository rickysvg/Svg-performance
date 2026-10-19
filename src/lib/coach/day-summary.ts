import { createHash } from "node:crypto";
import { bagFocusFor, bagMinutesForBand, type BagWeekday } from "@/lib/bag-sessions";
import { pickBikeSessionForPlan, type ScaleBand } from "@/lib/bike-sessions";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { scaleBandFromPrefs, scaleProgramDay } from "@/lib/training-scale";
import { completeCoachText } from "@/lib/coach/llm";
import { synthesizeCoachSpeech } from "@/lib/coach/tts";
import {
  coachingStyleVoice,
  intensityBand,
  resolveAiCoach,
  resolveCoachingStyle,
  type AiCoachId,
  type IntensityBand,
} from "@/lib/coaches";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { rirFromLoadText } from "@/lib/rir";
import { dayKey as zonedDayKey } from "@/lib/timezone";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { easePlanForUser } from "@/lib/recovery-ease";
import {
  planForDate,
  planWeekIndex,
  type DayPlan,
  type PlanWeekday,
  type ResolvedPlanSession,
  resolvePlanSessions,
} from "@/lib/week-plan";

export function summaryHeaderWhen(weekday: string, dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return weekday;
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return `${weekday} · ${formatted}`;
}

export type SummarySessionKind = "lift" | "bag" | "cardio" | "mobility" | "sparring" | "rest";

export type DaySummarySession = {
  kind: SummarySessionKind;
  title: string;
  cues: string[];
  /** On-screen lines. Spoken cues stay written for the voice. */
  lines: string[];
};

export type DaySummaryFacts = {
  coachId: AiCoachId;
  coachName: string;
  coachingStyle: string;
  weekday: string;
  dayKind: "train" | "rest" | "sparring";
  sessions: DaySummarySession[];
};

const SUMMARY_VERSION = "2";

const BAG_DAYS = new Set<PlanWeekday>([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const CLOSE: Record<AiCoachId, Record<IntensityBand, string>> = {
  skye: {
    calm: "Keep the pace honest, then move on.",
    balanced: "One clean piece, then the next. Keep the pace honest.",
    lifted: "You're on it. Keep the pace honest.",
    intense: "Do the work. Keep the pace honest.",
  },
  maya: {
    calm: "Stay on that detail until it is clean.",
    balanced: "That detail is the standard. Stay on that detail.",
    lifted: "Make the detail clean. Stay on that detail.",
    intense: "The detail. Stay on that detail.",
  },
  mateo: {
    calm: "Do it clean. Then you are done.",
    balanced: "That is the standard. Do it clean.",
    lifted: "Same standard. Do it clean.",
    intense: "Do it clean.",
  },
  cole: {
    calm: "Stay with the work. I'm with you.",
    balanced: "Do the piece in front of you. I'm with you.",
    lifted: "Next rep. I'm with you.",
    intense: "Do it. I'm with you.",
  },
  ricky: {
    calm: "Show up and do today's work. No extra. No fluff.",
    balanced: "Today's work. That is the standard. No fluff.",
    lifted: "We're on today's work. No fluff.",
    intense: "Do today's work. No extra. No fluff.",
  },
};

type ExerciseCue = {
  name: string;
  loadText: string;
  notes?: string;
  sets?: number;
  reps?: string;
};

function asBagDay(value?: string | null): BagWeekday | null {
  if (value && BAG_DAYS.has(value as PlanWeekday)) return value as BagWeekday;
  return null;
}

function scaleBand(level?: string | null): ScaleBand {
  if (level === "beginner" || level === "advanced") return level;
  return "intermediate";
}

function numberWord(value: string) {
  return ONES[Number(value)] ?? value;
}

/** Turn stored RIR text into something a voice can say. */
export function speakCue(text: string) {
  return text
    .replace(/(\d+)\s*-\s*(\d+)\s*RIR/gi, (_, a: string, b: string) => {
      return `${numberWord(a)} to ${numberWord(b)} reps in reserve`;
    })
    .replace(/(\d+)\+\s*RIR/gi, (_, a: string) => `${numberWord(a)} or more reps in reserve`)
    .replace(/(\d+)\s*[–-]\s*(\d+)\s*min\b/gi, "$1 to $2 minutes")
    .replace(/(\d+)\s*min\b/gi, "$1 minutes")
    .replace(/(\d+)\s*s\b/g, "$1 seconds")
    .replace(/0\.5\s*[–-]\s*1\s*×/g, "half to one times")
    .replace(/×/g, " times ")
    .replace(/\s*\/\s*/g, ", ")
    .replace(/[—–]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop catalog credits and logging instructions. Keep the cue a coach would say. */
function spokenNote(notes: string) {
  return notes
    .replace(/phil daru\s*\/\s*daru strong(?: method)?/gi, "")
    .replace(/joel jamieson\s*\/\s*8weeksout[^.]{0,40}/gi, "")
    .replace(/leon edwards athlete-shared[^.]{0,40}/gi, "")
    .replace(/ufc performance institute[^.]{0,90}/gi, "")
    .replace(/—?\s*not an svg program(?:,| and)? no(?:t an)? endorsement\.?/gi, "")
    .replace(/source did not prescribe weekly sets;?\s*this is svg scaling\.?/gi, "")
    .replace(/weekly sets are svg scaling\.?/gi, "")
    .replace(/source listed [^.]{0,90}\.?/gi, "")
    .replace(/svg scaling(?::| uses)[^.]{0,140}\.?/gi, "")
    .replace(/filmed as [^.]{0,50}\.?/gi, "")
    .replace(/log (?:reps|seconds|throws|rounds)[^.]{0,60}\.?/gi, "")
    .replace(/\btimed(?:\s+only)?(?:\s*[—–-]\s*no reps(?: or lbs)?)?\.?/gi, "")
    .replace(/friday conditioning is timed[^.]{0,50}\.?/gi, "")
    .replace(/[()]/g, " ")
    .replace(/^[\s.,—–-]+/, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

function speakDose(sets: number | undefined, reps: string | undefined) {
  if (!reps) return "";
  const clock = reps.match(/^(\d+):(\d+)$/);
  const range = reps.match(/^(\d+)\s*[–-]\s*(\d+)\s*sec/i);
  const seconds = reps.match(/^(\d+)\s*sec/i);
  let duration = "";
  if (clock) {
    const minutes = Number(clock[1]);
    duration = minutes === 1 ? "about one minute" : `about ${numberWord(String(minutes)) || minutes} minutes`;
  } else if (range) {
    duration = `about ${numberWord(range[1]) || range[1]} to ${numberWord(range[2]) || range[2]} seconds`;
  } else if (seconds) {
    duration = `about ${numberWord(seconds[1]) || seconds[1]} seconds`;
  }
  if (!duration) return "";
  if (!sets) return duration;
  if (sets === 1) return `One block, ${duration}`;
  return `${numberWord(String(sets)) || sets} sets, ${duration}`;
}

function extraLoad(loadText: string, note: string) {
  const haystack = note.toLowerCase();
  const fresh = (part: string) => {
    if (/\bRIR\b/i.test(part)) return true;
    if (/no lbs|svg scaling|^timed\b/i.test(part)) return false;
    const words = part.toLowerCase().match(/[a-z]{4,}/g) ?? [];
    if (words.length === 0) return part.length > 8;
    return words.some((word) => !haystack.includes(word));
  };
  const parts = loadText.split(/[·•]/).flatMap((chunk) => {
    const kept = chunk
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && fresh(part));
    return kept.length ? [kept.join(", ")] : [];
  });
  return speakCue(parts.join(". ")).replace(/[.\s]+$/, "");
}

function noteWithoutDose(note: string) {
  return note
    .replace(/about\s+\d+\s*(?:[–-]|to)\s*\d+\s*min(?:ute)?s?\b/gi, "")
    .replace(/\d+\s*(?:[–-]|to)\s*\d+\s*min(?:ute)?s?\b/gi, "")
    .replace(/^[\s.,—–-]+/, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

function tidy(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.!?])/g, "$1")
    .replace(/([.!?]){2,}/g, "$1")
    .trim();
}

function sessionKind(session: { kind: string }): SummarySessionKind {
  if (session.kind === "skill") return "bag";
  if (session.kind === "strength") return "lift";
  if (session.kind === "conditioning") return "cardio";
  if (session.kind === "mobility") return "mobility";
  return "rest";
}

/** Up to four cues for the day. Earlier sessions keep a cue before a later one takes a third. */
function takeCues(sessions: DaySummarySession[], cap = 4) {
  const picked = sessions.map(() => [] as string[]);
  let left = cap;
  for (let pass = 0; pass < cap && left > 0; pass += 1) {
    for (let index = 0; index < sessions.length && left > 0; index += 1) {
      const cue = sessions[index]?.cues[pass];
      if (!cue) continue;
      picked[index]?.push(cue);
      left -= 1;
    }
  }
  sessions.forEach((session, index) => {
    session.cues = picked[index] ?? [];
  });
  return sessions;
}

export function buildDaySummaryFacts(input: {
  coachId?: string | null;
  coachingStyle?: string | null;
  plan: DayPlan;
  sessions: ResolvedPlanSession[];
  exercisesByDayNumber?: Map<number, ExerciseCue[]>;
  skillExercisesByDayNumber?: Map<number, ExerciseCue[]>;
  experienceLevel?: string | null;
  weekIndex?: number;
}): DaySummaryFacts {
  const coach = resolveAiCoach(input.coachId);
  const style = resolveCoachingStyle(input.coachingStyle);
  const base = {
    coachId: coach.id,
    coachName: coach.name,
    coachingStyle: style.label,
    weekday: input.plan.weekday,
  };

  if (input.plan.outside?.kind === "sparring" || input.plan.summary === "Sparring") {
    return {
      ...base,
      dayKind: "sparring",
      sessions: [
        {
          kind: "sparring",
          title: input.plan.outside?.label || "Sparring",
          cues: [
            "There is no app workout on a sparring day.",
            "Log your rounds after you spar.",
            "First round stays technical. Hands home. Feet under you.",
            "If your head gets rung, you stop. That is not toughness.",
          ],
          lines: [
            "No app workout on a sparring day.",
            "Log rounds after you spar.",
            "First round stays technical. Hands home. Feet under you.",
            "If your head gets rung, you stop.",
          ],
        },
      ],
    };
  }

  const planned = input.sessions.filter((session) => session.kind !== "rest");
  if (!input.plan.active || planned.length === 0) {
    const note = input.plan.skipReason || input.plan.dayNote || "Rest or easy movement. Nothing to log.";
    return {
      ...base,
      dayKind: "rest",
      sessions: [
        {
          kind: "rest",
          title: "Rest",
          cues: [note, "Rest is part of the plan.", "Do not add a guilt workout."],
          lines: [note, "Rest is part of the plan.", "Do not add a guilt workout."],
        },
      ],
    };
  }

  const built: DaySummarySession[] = planned.map((session) => {
    const kind = sessionKind(session);
    const cues: string[] = [];
    const lines: string[] = [];
    if (kind === "bag") {
      const bagExercises =
        session.dayNumber != null
          ? input.skillExercisesByDayNumber?.get(session.dayNumber) ?? []
          : [];
      if (bagExercises.length > 0) {
        for (const exercise of bagExercises) {
          lines.push(exercise.name);
          cues.push(exercise.name);
        }
      }
      const day = asBagDay(session.sourceWeekday) ?? asBagDay(input.plan.weekday);
      if (day) {
        const focus = bagFocusFor(day, input.plan.mesoBlock);
        const minutes = bagMinutesForBand(scaleBand(input.experienceLevel), focus.dayNumber);
        cues.push(`The bag theme is ${focus.theme}.`);
        lines.push(`Theme: ${focus.theme}.`);
        if (focus.technique?.name) lines.push(focus.technique.name);
        if (focus.technique?.notes) cues.push(focus.technique.notes);
        const round = focus.rounds.find((line) => line.trim().length > 0 && line.length < 140);
        if (round) {
          cues.push(round);
          lines.push(round);
        }
        cues.push(`About ${minutes} minutes. Warm up, themed rounds, then a short cooldown.`);
        lines.push(`About ${minutes} minutes. Warm up, themed rounds, then a short cooldown.`);
      } else {
        cues.push(session.title);
        lines.push(session.title);
      }
    } else if (kind === "lift") {
      const exercises =
        session.dayNumber != null ? input.exercisesByDayNumber?.get(session.dayNumber) ?? [] : [];
      for (const exercise of exercises) {
        const rir = rirFromLoadText(exercise.loadText);
        lines.push(rir ? `${exercise.name} · ${rir}` : exercise.name);
        cues.push(rir ? `${exercise.name} at ${speakCue(rir)}.` : exercise.name);
      }
      cues.push("Main lifts stop at four sets. Accessories stop at three. Last rep can slow down and still stay clean.");
      lines.push("Main lifts: 4 sets max. Accessories: 3 sets max. Last rep can slow down and still stay clean.");
    } else if (kind === "cardio") {
      const bikeDay = input.plan.weekday === "Thursday" ? "Thursday" : "Tuesday";
      if (/bike/i.test(`${session.label} ${session.title}`)) {
        const bike = pickBikeSessionForPlan(bikeDay, input.weekIndex ?? 0);
        const bikeLine = bike.focus.replace(/—/g, ",").replace(/(\d+)s\b/g, "$1 seconds");
        cues.push(bikeLine);
        lines.push(bikeLine);
        const note = spokenNote(bike.notes.split(". ").slice(0, 2).join(". "));
        if (note.length > 12) {
          const sentence = note.endsWith(".") ? note : `${note}.`;
          cues.push(sentence);
          lines.push(sentence);
        }
      } else {
        cues.push(session.subtitle || session.title);
        lines.push(session.subtitle || session.title);
        const exercises =
          session.dayNumber != null ? input.exercisesByDayNumber?.get(session.dayNumber) ?? [] : [];
        for (const exercise of exercises.slice(0, 3)) {
          const rawNote = spokenNote(exercise.notes ?? "").slice(0, 160).replace(/[.\s]+$/, "");
          const dose = speakDose(exercise.sets, exercise.reps);
          const note = (dose ? noteWithoutDose(rawNote) : rawNote).replace(/[.\s]+$/, "");
          const load = extraLoad(exercise.loadText, `${note} ${dose}`);
          const pieces = [exercise.name];
          const asSentence = (text: string) =>
            text
              .split(/(?<=[.!?])\s+/)
              .map((part) => {
                const trimmed = part.replace(/[.\s]+$/, "").trim();
                if (!trimmed) return "";
                return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
              })
              .filter(Boolean)
              .join(". ");
          if (dose) pieces.push(asSentence(dose));
          if (note.length > 8) pieces.push(asSentence(note));
          if (load) pieces.push(asSentence(load));
          const spoken = `${pieces.filter(Boolean).join(". ")}.`;
          cues.push(spoken);
          lines.push(spoken);
        }
      }
    } else if (kind === "mobility") {
      const focus = session.title.replace(/^Mobility — /, "");
      cues.push(focus);
      cues.push(session.subtitle || "Easy range. No hard effort.");
      lines.push(focus);
      lines.push(session.subtitle || "Easy range. No grinding.");
    }
    return {
      kind,
      title: session.title,
      cues: cues.map(speakCue).filter(Boolean),
      lines: (lines.length ? lines : cues).map((line) => line.trim()).filter(Boolean),
    };
  });

  return { ...base, dayKind: "train", sessions: takeCues(built) };
}

function opener(facts: DaySummaryFacts) {
  const band = intensityBand(facts.coachingStyle);
  if (facts.coachId === "ricky") {
    if (band === "calm") return `Ricky here. ${facts.weekday}. You're in.`;
    if (band === "lifted") return `Ricky here. ${facts.weekday}. We're on this.`;
    if (band === "balanced") return `Ricky here. ${facts.weekday}. One standard.`;
    return `Ricky here. ${facts.weekday}.`;
  }
  if (facts.coachId === "skye") {
    if (band === "intense") return `Skye. ${facts.weekday}. Here is the day. Do the work.`;
    if (band === "lifted") return `Skye. ${facts.weekday}. Here is the day. You're on it.`;
    return `Skye. ${facts.weekday}. Here is the day.`;
  }
  if (facts.coachId === "maya") {
    if (band === "intense") return `Maya. ${facts.weekday}. One detail. Make it clean.`;
    return `Maya. ${facts.weekday}. One detail to get right.`;
  }
  if (facts.coachId === "mateo") {
    if (band === "calm") return `Mateo. ${facts.weekday}. We'll keep it clean.`;
    return `Mateo. ${facts.weekday}.`;
  }
  if (band === "intense") return `Cole. ${facts.weekday}. Do the work.`;
  if (band === "calm") return `Cole. ${facts.weekday}. I'm with you on this.`;
  return `Cole. ${facts.weekday}. We are on this.`;
}

function kindWord(kind: SummarySessionKind) {
  if (kind === "bag") return "bag work";
  if (kind === "lift") return "a lift";
  if (kind === "cardio") return "cardio";
  if (kind === "mobility") return "mobility";
  return kind;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "training";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function sessionLine(session: DaySummarySession, index: number) {
  const cues = session.cues.join(" ");
  const lead = index === 0 ? "" : "Next. ";
  if (session.kind === "bag") return `${lead}Bag. ${cues}`;
  if (session.kind === "lift") {
    const name = session.title.replace(/^Strength — /, "");
    return `${lead}Lift. ${name}. ${cues}`;
  }
  if (session.kind === "cardio") return `${lead}Cardio. ${cues || session.title}`;
  if (session.kind === "mobility") return `${lead}Mobility. ${cues || session.title}`;
  return `${lead}${session.title}. ${cues}`;
}

/** Deterministic script. Used when the model is unavailable, and as the quality check. */
export function templateDaySummary(facts: DaySummaryFacts) {
  const close = CLOSE[facts.coachId][intensityBand(facts.coachingStyle)];
  if (facts.dayKind === "rest") {
    const note = facts.sessions[0]?.cues.join(" ") ?? "Rest or easy movement.";
    return tidy(
      `${opener(facts)} Today is a rest day. Nothing to log. ${note} Walk if you want. Keep it easy. ${close}`,
    );
  }
  if (facts.dayKind === "sparring") {
    const note = facts.sessions[0]?.cues.join(" ") ?? "Log your rounds after you spar.";
    return tidy(`${opener(facts)} Today is sparring. ${note} ${close}`);
  }
  const lineup = joinList(facts.sessions.map((session) => kindWord(session.kind)));
  const body = facts.sessions.map(sessionLine).join(" ");
  return tidy(`${opener(facts)} You have ${lineup}. ${body} ${close}`);
}

export function summaryWordCount(script: string) {
  return script.split(/\s+/).filter(Boolean).length;
}

export function daySummaryPrompts(facts: DaySummaryFacts) {
  const system = [
    coachingStyleVoice(resolveCoachingStyle(facts.coachingStyle).value, facts.coachName),
    "Say it in that coach's voice at that intensity. Directness, push, accountability, and sentence length follow the intensity. Do not switch coaches.",
    "You are recording a spoken briefing of this member's training for today.",
    "Use only the facts in the user message. Do not invent sessions, loads, a fight date, or medical advice.",
    "Plain spoken sentences. No markdown, no labels, no bullet lists, and no emojis.",
    facts.dayKind === "train"
      ? "Length: about 30 to 60 seconds. That is roughly 80 to 140 words."
      : "This is a rest day or a sparring day. Keep it short, about 20 to 40 seconds, roughly 45 to 90 words.",
    "Say reps in reserve in words. Do not spell the letters RIR.",
    "Do not shame the athlete. End on the next action.",
  ].join(" ");
  const user = [
    `Coach: ${facts.coachName}`,
    `Weekday: ${facts.weekday}`,
    `Day kind: ${facts.dayKind}`,
    ...facts.sessions.map(
      (session) =>
        `${session.kind}: ${session.title}. Cues: ${session.cues.join(" ") || "none"}`,
    ),
  ].join("\n");
  return { system, user };
}

export function chooseSpokenScript(
  raw: string | null | undefined,
  fallback: string,
  dayKind: DaySummaryFacts["dayKind"],
) {
  const cleaned = (raw ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = summaryWordCount(cleaned);
  const min = dayKind === "train" ? 60 : 30;
  const max = dayKind === "train" ? 170 : 120;
  if (!cleaned || words < min || words > max) return fallback;
  if (/\b(as an ai|i cannot|i'm sorry|i am sorry)\b/i.test(cleaned)) return fallback;
  return cleaned;
}

export function daySummaryFactsKey(facts: DaySummaryFacts) {
  const intensity = intensityBand(facts.coachingStyle);
  return createHash("sha256")
    .update(`${SUMMARY_VERSION}|intensity:${intensity}|${JSON.stringify(facts)}`)
    .digest("hex")
    .slice(0, 24);
}

export async function loadDaySummaryFacts(userId: string, now = new Date()): Promise<{
  facts: DaySummaryFacts;
  dayKey: string;
}> {
  const profile = await getProfileForUser(userId);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const swaps = await getWeekPlanSwapsForUser(userId);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: account?.email,
    outsideTraining: profile?.outsideTraining,
    planAnchor: profile?.onboardingCompletedAt ?? null,
  };
  const builtPlan = planForDate(prefs, now, tz, swaps);
  const eased = await easePlanForUser(userId, now, tz, builtPlan);
  const plan = eased.plan;
  const catalog = await findDemoTrainingCatalog();
  const { strength, skill } = catalog;
  const sessions = resolvePlanSessions(plan, { strength, skill });
  const band = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const weightAccess = normalizeWeightAccess(profile?.weightAccess);
  const exercisesByDayNumber = new Map<number, ExerciseCue[]>();
  const skillExercisesByDayNumber = new Map<number, ExerciseCue[]>();
  for (const day of strength?.days ?? []) {
    const scaled = scaleProgramDay(day, {
      band,
      programSlug: strength?.slug,
      weightAccess,
    });
    exercisesByDayNumber.set(
      day.dayNumber,
      scaled.exercises.map((exercise) => ({
        name: exercise.name,
        loadText: exercise.loadText,
        notes: exercise.notes ?? "",
        sets: exercise.sets,
        reps: exercise.reps,
      })),
    );
  }
  for (const day of skill?.days ?? []) {
    const scaled = scaleProgramDay(day, {
      band,
      programSlug: skill?.slug,
      weightAccess,
    });
    skillExercisesByDayNumber.set(
      day.dayNumber,
      scaled.exercises.map((exercise) => ({
        name: exercise.name,
        loadText: exercise.loadText,
        notes: exercise.notes ?? "",
        sets: exercise.sets,
        reps: exercise.reps,
      })),
    );
  }
  const facts = buildDaySummaryFacts({
    coachId: profile?.aiCoachId,
    coachingStyle: profile?.coachingStyle,
    plan,
    sessions,
    exercisesByDayNumber,
    skillExercisesByDayNumber,
    experienceLevel: profile?.experienceLevel,
    weekIndex: planWeekIndex(now, tz, profile?.onboardingCompletedAt),
  });
  return { facts, dayKey: zonedDayKey(now, tz) };
}

export type TodayCoachSummary = {
  script: string;
  audio: Buffer | null;
  mime: string;
  voice: string;
  cached: boolean;
  source: "llm" | "template";
  dayKey: string;
  coachId: AiCoachId;
};

type SummaryDeps = {
  now?: Date;
  complete?: (system: string, user: string) => Promise<string | null>;
  synthesize?: (
    text: string,
    coachId: string,
    coachingStyle?: string,
  ) => Promise<{ audio: Buffer; mime: string; voice: string } | null>;
};

function bytesOf(value: Uint8Array | Buffer | null | undefined) {
  if (!value || value.byteLength < 32) return null;
  return Buffer.from(value);
}

/** Prisma Bytes wants a Uint8Array backed by a plain ArrayBuffer. */
function prismaBytes(audio: Buffer | null) {
  if (!audio) return null;
  return Uint8Array.from(audio);
}

async function writeSummary(input: {
  userId: string;
  dayKey: string;
  coachId: string;
  factsKey: string;
  voice: string;
  script: string;
  audio: Buffer | null;
  mime: string;
  source: "llm" | "template";
}) {
  await prisma.coachDaySummary.deleteMany({
    where: {
      userId: input.userId,
      dayKey: input.dayKey,
      coachId: input.coachId,
      NOT: { factsKey: input.factsKey },
    },
  });
  return prisma.coachDaySummary.upsert({
    where: {
      userId_dayKey_coachId_factsKey: {
        userId: input.userId,
        dayKey: input.dayKey,
        coachId: input.coachId,
        factsKey: input.factsKey,
      },
    },
    create: {
      userId: input.userId,
      dayKey: input.dayKey,
      coachId: input.coachId,
      factsKey: input.factsKey,
      voice: input.voice,
      script: input.script,
      audio: prismaBytes(input.audio),
      mimeType: input.mime,
      source: input.source,
    },
    update: {
      voice: input.voice,
      script: input.script,
      audio: prismaBytes(input.audio),
      mimeType: input.mime,
      source: input.source,
    },
  });
}

/**
 * Script plus speech for this member's local day.
 * The row is reused until the day, coach, or plan facts change.
 */
export async function getTodayCoachSummary(
  userId: string,
  deps: SummaryDeps = {},
): Promise<TodayCoachSummary> {
  const now = deps.now ?? new Date();
  const { facts, dayKey } = await loadDaySummaryFacts(userId, now);
  const factsKey = daySummaryFactsKey(facts);
  const complete = deps.complete ?? ((system, user) => completeCoachText({ system, user, maxTokens: 320 }));
  const synthesize = deps.synthesize ?? synthesizeCoachSpeech;
  const existing = await prisma.coachDaySummary.findUnique({
    where: {
      userId_dayKey_coachId_factsKey: {
        userId,
        dayKey,
        coachId: facts.coachId,
        factsKey,
      },
    },
  });
  if (existing) {
    const cachedAudio = bytesOf(existing.audio);
    if (cachedAudio) {
      return {
        script: existing.script,
        audio: cachedAudio,
        mime: existing.mimeType || "audio/mpeg",
        voice: existing.voice,
        cached: true,
        source: existing.source === "llm" ? "llm" : "template",
        dayKey,
        coachId: facts.coachId,
      };
    }
    const spoken = await synthesize(existing.script, facts.coachId, facts.coachingStyle);
    if (spoken) {
      await writeSummary({
        userId,
        dayKey,
        coachId: facts.coachId,
        factsKey,
        voice: spoken.voice,
        script: existing.script,
        audio: spoken.audio,
        mime: spoken.mime,
        source: existing.source === "llm" ? "llm" : "template",
      });
    }
    return {
      script: existing.script,
      audio: spoken?.audio ?? null,
      mime: spoken?.mime ?? "audio/mpeg",
      voice: spoken?.voice ?? existing.voice,
      cached: true,
      source: existing.source === "llm" ? "llm" : "template",
      dayKey,
      coachId: facts.coachId,
    };
  }

  const fallback = templateDaySummary(facts);
  const prompts = daySummaryPrompts(facts);
  const live = await complete(prompts.system, prompts.user);
  const script = chooseSpokenScript(live, fallback, facts.dayKind);
  const source = script === fallback ? "template" : "llm";
  const spoken = await synthesize(script, facts.coachId, facts.coachingStyle);
  const voice = spoken?.voice ?? resolveAiCoach(facts.coachId).voice;
  await writeSummary({
    userId,
    dayKey,
    coachId: facts.coachId,
    factsKey,
    voice,
    script,
    audio: spoken?.audio ?? null,
    mime: spoken?.mime ?? "audio/mpeg",
    source,
  });
  return {
    script,
    audio: spoken?.audio ?? null,
    mime: spoken?.mime ?? "audio/mpeg",
    voice,
    cached: false,
    source,
    dayKey,
    coachId: facts.coachId,
  };
}
