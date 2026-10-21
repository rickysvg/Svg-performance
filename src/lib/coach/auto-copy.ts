/**
 * Template copy for coach messages that must not call OpenAI.
 * The optional weekly polish lives in auto-notes.ts behind COACH_RECAP_AI, off by default.
 */

export const RECAP_LOCAL_HOUR = 18;

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export type LoadChange = {
  name: string;
  from: number;
  to: number;
  unit: string;
  pr?: boolean;
};

export type WeekRecapFacts = {
  sessionsDone: number;
  missed: number;
  planKnown: boolean;
  streak: number;
  loadUps: LoadChange[];
  sparringBody: Array<number | null>;
};

export function recapSundayKey(
  now: Date,
  timeZone: string,
  parts: { weekday: string; hour: number },
  dayKeyOf: (date: Date) => string,
  shiftDays: (date: Date, days: number) => Date,
): string {
  const today = shiftDays(now, 0);
  const index = WEEKDAY_INDEX[parts.weekday] ?? 0;
  let sunday = shiftDays(today, -index);
  if (parts.weekday === "Sunday" && parts.hour < RECAP_LOCAL_HOUR) {
    sunday = shiftDays(sunday, -7);
  }
  return dayKeyOf(sunday);
}

export function daysBetweenDayKeys(fromKey: string, toKey: string) {
  const from = keyUtc(fromKey);
  const to = keyUtc(toKey);
  if (from == null || to == null) return null;
  return Math.round((to - from) / 86_400_000);
}

function keyUtc(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function weeklyRecapMessage(facts: WeekRecapFacts) {
  const sessions =
    facts.sessionsDone === 0
      ? "No sessions logged."
      : `You logged ${facts.sessionsDone} session${facts.sessionsDone === 1 ? "" : "s"}.`;
  const load = loadSentence(facts.loadUps);
  const streak =
    facts.streak > 0
      ? `Streak is ${facts.streak} day${facts.streak === 1 ? "" : "s"}.`
      : "";
  const missed = facts.planKnown
    ? facts.missed === 0
      ? "No missed sessions."
      : `Missed ${facts.missed} session${facts.missed === 1 ? "" : "s"}.`
    : "";
  return ["Week recap.", sessions, load, streak, missed, sparringSentence(facts.sparringBody), nextWeekFocus(facts)]
    .filter(Boolean)
    .join(" ");
}

function loadSentence(rows: LoadChange[]) {
  const row = rows[0];
  if (!row) return "";
  const verb = row.pr ? "PR" : "up";
  const extra = rows.length > 1 ? ` ${rows.length - 1} more went up.` : "";
  return `${row.name} ${verb}, ${formatLoad(row.from)} to ${formatLoad(row.to)} ${row.unit}.${extra}`;
}

function sparringSentence(ratings: Array<number | null>) {
  if (ratings.length === 0) return "No sparring log this week.";
  const numbers = ratings.filter((value): value is number => value != null);
  if (numbers.length === 0) return "Sparring logged. No body rating.";
  if (numbers.length === 1) return `Sparring body rating ${numbers[0]}.`;
  return `Sparring body rating ${numbers[0]}, then ${numbers[numbers.length - 1]}.`;
}

export function nextWeekFocus(facts: WeekRecapFacts) {
  const lastBody = [...facts.sparringBody].reverse().find((value) => value != null);
  if (lastBody != null && lastBody <= 2) {
    return "Next week: keep sparring technical until the body rating comes up.";
  }
  if (facts.planKnown && facts.missed > 0) {
    return "Next week: make the session you missed. Nothing extra.";
  }
  if (facts.sessionsDone === 0) {
    return "Next week: log the first session on your plan.";
  }
  if (facts.loadUps.length === 0) {
    return "Next week: add a little load on one main lift and write the RIR.";
  }
  return "Next week: repeat this week. Same sessions, same standard.";
}

export function postWorkoutNote(input: { loadUps: LoadChange[]; missedRir: string[] }) {
  if (input.loadUps.length === 0 && input.missedRir.length === 0) return null;
  const parts = ["Logged."];
  const row = input.loadUps[0];
  if (row) {
    parts.push(
      `${row.name} went from ${formatLoad(row.from)} to ${formatLoad(row.to)} ${row.unit}.`,
    );
  }
  const missed = input.missedRir[0];
  if (missed) {
    parts.push(`RIR was blank on ${missed}. Write how many reps you had left.`);
  }
  return parts.join(" ");
}

export function sparringCheckNote(input: { bodyRating: number | null; sore: string[] }) {
  const sore = input.sore.length ? ` Sore spots on the log: ${input.sore.join(", ")}.` : "";
  if (input.bodyRating == null) {
    return `Yesterday's sparring is in.${sore} You didn't rate the body. Add that next time.`;
  }
  if (input.bodyRating <= 2) {
    return `Yesterday's sparring, body rating ${input.bodyRating}.${sore} If something is sharp, swollen, or not settling, talk to a coach or a doctor before you train hard.`;
  }
  return `Yesterday's sparring, body rating ${input.bodyRating}.${sore} Train what's on the plan. Keep the first round technical.`;
}

export function fightReminderNote(days: 7 | 3 | 1) {
  if (days === 7) {
    return "Fight is in 7 days. Do the sessions already on the plan. No new experiments.";
  }
  if (days === 3) {
    return "Fight is in 3 days. Sleep, food you already tolerate, and the sessions on the plan. Nothing extra.";
  }
  return "Fight is tomorrow. Light work only. If you feel off, tell your coach.";
}

export function isFightReminderDay(days: number | null): days is 7 | 3 | 1 {
  return days === 7 || days === 3 || days === 1;
}

function formatLoad(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
