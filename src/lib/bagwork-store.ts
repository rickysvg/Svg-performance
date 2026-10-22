import { AppError } from "@/lib/errors";
import { highestSetNumber } from "@/lib/logger-insert";
import { prisma } from "@/lib/prisma";
import { BAGWORK_PRESCRIPTION, bagWorkoutBySlug, bagworkTimerConfig, customIdFromKey, parseBagRegions, parseSessionRpe, viewFromCatalog, viewFromCustom, type BagworkQuery, type BagworkView } from "@/lib/bagwork";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { sessionCompletionDay } from "@/lib/performed-at";
import { clampDurationSeconds, clampRounds } from "@/lib/round-timer";
import { roundSaveStatus, roundSessionDuration } from "@/lib/round-session";
import { updateWorkoutSessionForUser } from "@/lib/workouts";

const NAME_MIN = 2;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 500;

export async function listCustomBagWorkouts(userId: string) {
  return prisma.customBagWorkout.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCustomBagWorkout(userId: string, id: string) {
  if (!id) return null;
  return prisma.customBagWorkout.findFirst({ where: { id, userId } });
}

export async function resolveBagworkView(userId: string, key: string): Promise<BagworkView | null> {
  const customId = customIdFromKey(key);
  if (customId) {
    const row = await getCustomBagWorkout(userId, customId);
    return row ? viewFromCustom(row) : null;
  }
  const catalog = bagWorkoutBySlug(key);
  return catalog ? viewFromCatalog(catalog) : null;
}

export async function resolveBagworkLaunch(userId: string, query: BagworkQuery) {
  const key = (query.bagwork ?? "").trim();
  if (!key) return null;
  const view = await resolveBagworkView(userId, key);
  if (!view) return null;
  const config = bagworkTimerConfig(query, view.suggested);
  return {
    key: view.key,
    name: view.name,
    rounds: config.rounds,
    workSeconds: config.workSeconds,
    restSeconds: config.restSeconds,
    backHref: view.custom ? `/bagwork/saved/${customIdFromKey(view.key)}` : `/bagwork/${view.key}`,
  };
}

export function cleanBagWorkoutInput(input: { name: string; description: string; regions: string }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new AppError("BAGWORK", "Name the workout in 2 to 60 characters.");
  }
  const description = input.description.trim().slice(0, DESCRIPTION_MAX);
  const regions = parseBagRegions(input.regions);
  return { name, description, regions: regions.join(",") };
}

export async function saveCustomBagWorkoutForUser(input: {
  userId: string;
  id?: string;
  name: string;
  description: string;
  regions: string;
}) {
  const cleaned = cleanBagWorkoutInput(input);
  if (input.id) {
    const existing = await getCustomBagWorkout(input.userId, input.id);
    if (!existing) throw new AppError("BAGWORK", "That custom workout is not yours.");
    return prisma.customBagWorkout.update({
      where: { id: existing.id },
      data: cleaned,
    });
  }
  return prisma.customBagWorkout.create({
    data: { userId: input.userId, ...cleaned },
  });
}

export async function deleteCustomBagWorkoutForUser(userId: string, id: string) {
  const existing = await getCustomBagWorkout(userId, id);
  if (!existing) throw new AppError("BAGWORK", "That custom workout is not yours.");
  await prisma.customBagWorkout.delete({ where: { id: existing.id } });
}

/** Rounds already in the session keep their numbers. New rounds follow the highest one. */
export function bagworkRoundSets(input: {
  exerciseName: string;
  rounds: number;
  workSeconds: number;
  existing?: { exerciseName?: string | null; setNumber?: number | null }[];
}) {
  const start = highestSetNumber(input.existing ?? [], input.exerciseName);
  return Array.from({ length: input.rounds }, (_, index) => ({
    exerciseName: input.exerciseName,
    setNumber: start + index + 1,
    sortOrder: start + index,
    reps: null,
    loadValue: null,
    loadUnit: "lb" as const,
    logMode: "timed_round" as const,
    durationSeconds: input.workSeconds,
    completed: true,
    prescriptionKey: BAGWORK_PRESCRIPTION,
  }));
}

export async function logBagworkSessionForUser(input: {
  userId: string;
  workoutKey: string;
  rounds: number;
  workSeconds: number;
  notes: string;
  rpe: number | null;
  restSeconds?: number | null;
  configuredRounds?: number | null;
  elapsedSeconds?: number | null;
  now?: Date;
}) {
  const view = await resolveBagworkView(input.userId, input.workoutKey);
  if (!view) throw new AppError("BAGWORK", "That bag workout is not on your list.");
  const rounds = clampRounds(input.rounds);
  if (rounds < 1) throw new AppError("BAGWORK", "Finish at least one round to log it.");
  const workSeconds = clampDurationSeconds(input.workSeconds);
  const notes = input.notes.trim().slice(0, DESCRIPTION_MAX);
  const rpe = parseSessionRpe(input.rpe);
  const restSeconds = Math.max(0, Math.round(input.restSeconds ?? 0));
  const configured =
    input.configuredRounds == null ? rounds : Math.max(1, Math.round(input.configuredRounds));
  const status = roundSaveStatus({
    roundsCompleted: rounds,
    plannedRounds: configured,
    configuredRounds: configured,
  });
  const now = input.now ?? new Date();
  const sets = bagworkRoundSets({
    exerciseName: view.name,
    rounds,
    workSeconds,
  }).map((set) => ({
    ...set,
    notes: restSeconds > 0 ? `Rest ${restSeconds}s` : "",
  }));
  const profile = await getProfileForUser(input.userId);
  const timeZone = await timeZoneForUser(input.userId, profile?.timeZone ?? null);
  const workoutId = await reuseBagworkSessionId({
    userId: input.userId,
    title: view.name,
    now,
    timeZone,
  });
  return updateWorkoutSessionForUser({
    userId: input.userId,
    workoutId,
    title: view.name,
    performedAt: now,
    notes,
    status,
    sets,
    rest: null,
    timeZone,
    elapsedSeconds:
      input.elapsedSeconds ?? roundSessionDuration(rounds, workSeconds, restSeconds),
    plannedSetCount: configured,
    sessionRpe: rpe,
  });
}

async function reuseBagworkSessionId(input: {
  userId: string;
  title: string;
  now: Date;
  timeZone: string;
}) {
  const from = new Date(input.now.getTime() - 36 * 60 * 60 * 1000);
  const to = new Date(input.now.getTime() + 36 * 60 * 60 * 1000);
  const today = sessionCompletionDay({ performedAt: input.now }, input.timeZone);
  const rows = await prisma.workoutSession.findMany({
    where: {
      userId: input.userId,
      title: input.title,
      status: { in: ["draft", "partial", "complete"] },
      performedAt: { gte: from, lte: to },
    },
    include: { sets: { select: { prescriptionKey: true } } },
    orderBy: { createdAt: "asc" },
  });
  const matches = rows.filter(
    (row) =>
      sessionCompletionDay(row, input.timeZone) === today &&
      (row.sets.length === 0 ||
        row.sets.some((set) => set.prescriptionKey === BAGWORK_PRESCRIPTION)),
  );
  const saved = matches.find((row) => row.status === "complete" || row.status === "partial");
  const draft = matches.find((row) => row.status === "draft");
  if (saved) return saved.id;
  if (draft) return draft.id;
  const created = await prisma.workoutSession.create({
    data: {
      userId: input.userId,
      title: input.title,
      performedAt: input.now,
      status: "draft",
    },
  });
  return created.id;
}
