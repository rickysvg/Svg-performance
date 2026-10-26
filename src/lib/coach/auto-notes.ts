import { prisma } from "@/lib/prisma";
import { getMemberCoachThread } from "@/lib/coach/chat";
import { authoringCoachId } from "@/lib/coach/author";
import {
  daysBetweenDayKeys,
  fightReminderNote,
  isFightReminderDay,
  postWorkoutNote,
  recapSundayKey,
  sparringCheckNote,
  weeklyRecapMessage,
  type LoadChange,
  type WeekRecapFacts,
} from "@/lib/coach/auto-copy";
import { hasRirCue } from "@/lib/rir";
import { loggedSetSome, setHasLoggedWork } from "@/lib/logged-work";
import { getProfileForUser } from "@/lib/profile";
import { buildTrainingStreak, plannerPrefsFromProfile, streakQuerySince } from "@/lib/streaks";
import {
  addZonedDays,
  dayKey,
  resolveTimeZone,
  startOfZonedDay,
  zonedCivilToUtc,
  zonedParts,
} from "@/lib/timezone";
import { planForDate } from "@/lib/week-plan";
import { sendPushToUser } from "@/lib/weekly-checkin-push";

const RECAP_OUTPUT_TOKENS = 150;
const RECAP_MODEL = "gpt-4o-mini";

export function coachRecapAiEnabled() {
  const value = process.env.COACH_RECAP_AI?.trim().toLowerCase() ?? "";
  return value === "1" || value === "true" || value === "on";
}

export function sundayKeyFor(now: Date, timeZone: string) {
  const parts = zonedParts(now, timeZone);
  return recapSundayKey(
    now,
    timeZone,
    parts,
    (date) => dayKey(date, timeZone),
    (date, days) => (days === 0 ? startOfZonedDay(date, timeZone) : addZonedDays(date, days, timeZone)),
  );
}

/**
 * One optional gpt-4o-mini rewrite per recap. Off unless COACH_RECAP_AI is set.
 * A failure keeps the template. Proactive notes never call this.
 */
export async function maybePolishRecap(template: string) {
  if (!coachRecapAiEnabled()) return template;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return template;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: RECAP_MODEL,
        max_tokens: RECAP_OUTPUT_TOKENS,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the draft as SVG Coach. Use only facts already in the draft. Do not add numbers, sessions, loads, or medical advice. No weight cuts. Under 80 words.",
          },
          { role: "user", content: template },
        ],
      }),
    });
    if (!response.ok) return template;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) return template;
    return text.slice(0, 900);
  } catch {
    return template;
  }
}

async function claim(userId: string, dedupeKey: string, kind: string) {
  const existing = await prisma.coachAutoNote.findUnique({
    where: { userId_dedupeKey: { userId, dedupeKey } },
    select: { id: true },
  });
  if (existing) return false;
  try {
    await prisma.coachAutoNote.create({ data: { userId, dedupeKey, kind } });
    return true;
  } catch {
    return false;
  }
}

async function release(userId: string, dedupeKey: string) {
  await prisma.coachAutoNote.deleteMany({ where: { userId, dedupeKey } }).catch(() => undefined);
}

async function deliver(userId: string, content: string) {
  const thread = await getMemberCoachThread(userId);
  await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content,
      coachId: await authoringCoachId(userId),
      refused: false,
      offline: false,
    },
  });
  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });
  await sendPushToUser(userId, {
    title: "SVG Coach",
    body: content.replace(/\s+/g, " ").slice(0, 140),
    url: "/coach",
  }).catch(() => undefined);
}

function dateFromKey(key: string, timeZone: string) {
  const [year, month, day] = key.split("-").map(Number);
  return zonedCivilToUtc(year ?? 1970, month ?? 1, day ?? 1, timeZone);
}

function civilKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fightKeyFor(userId: string, nextFightDate: Date | null) {
  const camp = await prisma.fightCamp.findUnique({
    where: { userId },
    select: { fightDateKey: true, status: true, cancelledAt: true },
  });
  if (camp && camp.status === "active" && !camp.cancelledAt && camp.fightDateKey) {
    return camp.fightDateKey;
  }
  return nextFightDate ? civilKey(nextFightDate) : null;
}

function maxLoad(sets: Array<{ exerciseName: string; loadValue: number | null; loadUnit: string }>) {
  const best = new Map<string, { load: number; unit: string; name: string }>();
  for (const set of sets) {
    if (set.loadValue == null || !Number.isFinite(set.loadValue) || set.loadValue <= 0) continue;
    const key = set.exerciseName.trim().toLowerCase();
    const current = best.get(key);
    if (!current || set.loadValue > current.load) {
      best.set(key, { load: set.loadValue, unit: set.loadUnit || "lb", name: set.exerciseName.trim() });
    }
  }
  return best;
}

async function weekFacts(userId: string, now: Date, timeZone: string, sundayKey: string): Promise<WeekRecapFacts> {
  const profile = await getProfileForUser(userId);
  if (!profile) {
    return {
      sessionsDone: 0,
      missed: 0,
      planKnown: false,
      streak: 0,
      loadUps: [],
      sparringBody: [],
    };
  }
  const prefs = plannerPrefsFromProfile(profile);
  const planKnown =
    (profile?.weeklyAvailability.length ?? 0) > 0 || (profile?.sessionsPerWeek ?? 0) > 0;
  const sunday = dateFromKey(sundayKey, timeZone);
  const monday = addZonedDays(sunday, -6, timeZone);
  const end = addZonedDays(sunday, 1, timeZone);
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: monday, lt: end },
      sets: loggedSetSome,
    },
    include: { sets: true },
  });
  const prior = await prisma.workoutSet.findMany({
    where: {
      loadValue: { not: null },
      session: { userId, status: "complete", performedAt: { lt: monday } },
    },
    select: { exerciseName: true, loadValue: true, loadUnit: true },
  });
  const weekBest = maxLoad(sessions.flatMap((row) => row.sets));
  const priorBest = maxLoad(prior);
  const loadUps: LoadChange[] = [];
  for (const [key, row] of weekBest) {
    const before = priorBest.get(key);
    if (!before || before.unit !== row.unit || row.load <= before.load) continue;
    loadUps.push({
      name: row.name,
      from: before.load,
      to: row.load,
      unit: row.unit,
      pr: true,
    });
  }
  loadUps.sort((a, b) => b.to - b.from - (a.to - a.from));

  const completed = new Set(sessions.map((row) => dayKey(row.performedAt, timeZone)));
  let missed = 0;
  if (planKnown) {
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addZonedDays(monday, offset, timeZone);
      if (!planForDate(prefs, day, timeZone).active) continue;
      if (!completed.has(dayKey(day, timeZone))) missed += 1;
    }
  }

  const all = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      sets: loggedSetSome,
      performedAt: { gte: streakQuerySince(now) },
    },
    select: { performedAt: true },
  });
  const streak = buildTrainingStreak({
    completedDates: all.map((row) => row.performedAt),
    prefs,
    now,
    timeZone,
  }).current;

  const logs = await prisma.outsideSessionLog.findMany({
    where: { userId, dateKey: { gte: dayKey(monday, timeZone), lte: sundayKey } },
    orderBy: { dateKey: "asc" },
    select: { bodyRating: true },
  });

  return {
    sessionsDone: sessions.length,
    missed,
    planKnown,
    streak,
    loadUps,
    sparringBody: logs.map((row) => row.bodyRating),
  };
}

export async function postWeeklyRecap(userId: string, now = new Date()) {
  const profile = await getProfileForUser(userId);
  if (!profile?.onboardingCompletedAt) return { posted: false as const, reason: "onboarding" };
  const timeZone = resolveTimeZone(profile.timeZone, "America/Denver");
  const sundayKey = sundayKeyFor(now, timeZone);
  if (dayKey(profile.onboardingCompletedAt, timeZone) > sundayKey) {
    return { posted: false as const, reason: "joined-later" };
  }
  const dedupeKey = `recap:${sundayKey}`;
  if (!(await claim(userId, dedupeKey, "recap"))) {
    return { posted: false as const, reason: "already" };
  }
  try {
    const facts = await weekFacts(userId, now, timeZone, sundayKey);
    const template = weeklyRecapMessage(facts);
    const content = await maybePolishRecap(template);
    await deliver(userId, content);
    return { posted: true as const, dedupeKey };
  } catch (error) {
    await release(userId, dedupeKey);
    throw error;
  }
}

async function workoutChanges(userId: string, workoutId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: workoutId, userId, status: "complete" },
    include: { sets: true, programDay: { include: { exercises: true } } },
  });
  if (!session || !session.sets.some(setHasLoggedWork)) return null;
  const names = [...new Set(session.sets.map((set) => set.exerciseName.trim()).filter(Boolean))];
  const prior = await prisma.workoutSet.findMany({
    where: {
      exerciseName: { in: names },
      loadValue: { not: null },
      session: { userId, status: "complete", id: { not: workoutId } },
    },
    select: { exerciseName: true, loadValue: true, loadUnit: true },
  });
  const current = maxLoad(session.sets);
  const before = maxLoad(prior);
  const loadUps: LoadChange[] = [];
  for (const [key, row] of current) {
    const previous = before.get(key);
    if (!previous || previous.unit !== row.unit || row.load <= previous.load) continue;
    loadUps.push({ name: row.name, from: previous.load, to: row.load, unit: row.unit });
  }
  loadUps.sort((a, b) => b.to - b.from - (a.to - a.from));

  const rirExercises = new Set(
    (session.programDay?.exercises ?? [])
      .filter((exercise) => hasRirCue(exercise.loadText))
      .map((exercise) => exercise.name.trim().toLowerCase()),
  );
  const missedRir: string[] = [];
  for (const name of names) {
    if (!rirExercises.has(name.toLowerCase())) continue;
    const logged = session.sets.filter(
      (set) => set.exerciseName.trim().toLowerCase() === name.toLowerCase() && setHasLoggedWork(set),
    );
    if (logged.length > 0 && logged.every((set) => !set.rir.trim())) missedRir.push(name);
  }
  return postWorkoutNote({ loadUps, missedRir });
}

/** After a saved workout. No model call. One proactive note per local day. */
export async function noteAfterWorkout(userId: string, workoutId: string, now = new Date()) {
  const text = await workoutChanges(userId, workoutId);
  if (!text) return { posted: false as const, reason: "nothing" };
  const profile = await getProfileForUser(userId);
  const timeZone = resolveTimeZone(profile?.timeZone, "America/Denver");
  const dedupeKey = `day:${dayKey(now, timeZone)}`;
  if (!(await claim(userId, dedupeKey, "workout"))) {
    return { posted: false as const, reason: "capped" };
  }
  try {
    await deliver(userId, text);
    return { posted: true as const, dedupeKey };
  } catch (error) {
    await release(userId, dedupeKey);
    throw error;
  }
}

async function proactiveText(userId: string, now: Date, timeZone: string, nextFightDate: Date | null) {
  const fightKey = await fightKeyFor(userId, nextFightDate);
  const today = dayKey(now, timeZone);
  if (fightKey) {
    const days = daysBetweenDayKeys(today, fightKey);
    if (isFightReminderDay(days)) {
      return { kind: "fight" as const, text: fightReminderNote(days) };
    }
  }
  const yesterday = dayKey(addZonedDays(now, -1, timeZone), timeZone);
  const sparring = await prisma.outsideSessionLog.findUnique({
    where: { userId_dateKey: { userId, dateKey: yesterday } },
    select: { bodyRating: true, soreSpots: true },
  });
  if (!sparring) return null;
  let sore: string[] = [];
  try {
    const parsed = JSON.parse(sparring.soreSpots) as unknown;
    if (Array.isArray(parsed)) sore = parsed.filter((item) => typeof item === "string");
  } catch {
    sore = [];
  }
  return {
    kind: "sparring" as const,
    text: sparringCheckNote({ bodyRating: sparring.bodyRating, sore }),
  };
}

export async function postProactiveNote(userId: string, now = new Date()) {
  const profile = await getProfileForUser(userId);
  if (!profile?.onboardingCompletedAt) return { posted: false as const, reason: "onboarding" };
  const timeZone = resolveTimeZone(profile.timeZone, "America/Denver");
  const note = await proactiveText(userId, now, timeZone, profile.nextFightDate);
  if (!note) return { posted: false as const, reason: "nothing" };
  const dedupeKey = `day:${dayKey(now, timeZone)}`;
  if (!(await claim(userId, dedupeKey, note.kind))) {
    return { posted: false as const, reason: "capped" };
  }
  try {
    await deliver(userId, note.text);
    return { posted: true as const, dedupeKey, kind: note.kind };
  } catch (error) {
    await release(userId, dedupeKey);
    throw error;
  }
}

async function onboardedIds() {
  const rows = await prisma.profile.findMany({
    where: { onboardingCompletedAt: { not: null } },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

export async function runCoachRecapCron(now = new Date()) {
  const ids = await onboardedIds();
  let posted = 0;
  let skipped = 0;
  for (const userId of ids) {
    try {
      const result = await postWeeklyRecap(userId, now);
      if (result.posted) posted += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
      console.warn("[coach] recap skipped");
    }
  }
  return { scanned: ids.length, posted, skipped };
}

export async function runCoachProactiveCron(now = new Date()) {
  const ids = await onboardedIds();
  let posted = 0;
  let skipped = 0;
  for (const userId of ids) {
    try {
      const result = await postProactiveNote(userId, now);
      if (result.posted) posted += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
      console.warn("[coach] proactive note skipped");
    }
  }
  return { scanned: ids.length, posted, skipped };
}
