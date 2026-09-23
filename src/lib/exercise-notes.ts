import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { answerScopedCoachQuestion } from "@/lib/coach/chat";
import { plannedSetLine, resolveLogMode } from "@/lib/exercise-log-mode";

export type ExerciseNoteView = {
  exerciseName: string;
  programDayId: string;
  body: string;
  aiReply: string;
  aiOffline: boolean;
};

export function coachLaneForExercise(name: string): { topic: string; art?: string } {
  const text = name.toLowerCase();
  if (/\b(jab|cross|hook|boxing)\b/.test(text)) {
    return { topic: "martial_art", art: "boxing" };
  }
  if (/\b(teep|kick|clinch|knee|muay)\b/.test(text)) {
    return { topic: "martial_art", art: "muay-thai" };
  }
  if (/\b(sprawl|shot|level change|double-leg|wrestling)\b/.test(text)) {
    return { topic: "martial_art", art: "wrestling" };
  }
  if (/\b(guard|shrimp|mount|jiu|bjj)\b/.test(text)) {
    return { topic: "martial_art", art: "jiu-jitsu" };
  }
  if (/\b(bag|pads|g&p|ground-and-pound|frame)\b/.test(text)) {
    return { topic: "martial_art", art: "mma" };
  }
  return { topic: "conditioning" };
}

function normalizeDayId(programDayId?: string | null) {
  return (programDayId ?? "").trim();
}

function toView(note: {
  exerciseName: string;
  programDayId: string;
  body: string;
  aiReply: string;
  aiOffline: boolean;
}): ExerciseNoteView {
  return {
    exerciseName: note.exerciseName,
    programDayId: note.programDayId,
    body: note.body,
    aiReply: note.aiReply,
    aiOffline: note.aiOffline,
  };
}

export async function listExerciseNotesForUser(
  userId: string,
  input: { exerciseNames: string[]; programDayId?: string | null },
) {
  const names = [...new Set(input.exerciseNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return {} as Record<string, ExerciseNoteView>;
  const dayId = normalizeDayId(input.programDayId);
  const rows = await prisma.exerciseNote.findMany({
    where: { userId, exerciseName: { in: names } },
  });
  const map: Record<string, ExerciseNoteView> = {};
  for (const row of rows) {
    if (row.programDayId === "" && !map[row.exerciseName]) {
      map[row.exerciseName] = toView(row);
    }
  }
  for (const row of rows) {
    if (row.programDayId === dayId) {
      map[row.exerciseName] = toView(row);
    }
  }
  return map;
}

export async function upsertExerciseNoteForUser(input: {
  userId: string;
  exerciseName: string;
  programDayId?: string | null;
  body: string;
}) {
  const exerciseName = input.exerciseName.trim().slice(0, 80);
  if (!exerciseName) {
    throw new AppError("VALIDATION", "Pick an exercise first.");
  }
  const programDayId = normalizeDayId(input.programDayId);
  const body = input.body.trim().slice(0, 2000);
  const saved = await prisma.exerciseNote.upsert({
    where: {
      userId_exerciseName_programDayId: {
        userId: input.userId,
        exerciseName,
        programDayId,
      },
    },
    update: { body },
    create: {
      userId: input.userId,
      exerciseName,
      programDayId,
      body,
    },
  });
  return toView(saved);
}

export async function askExerciseNoteForUser(input: {
  userId: string;
  exerciseName: string;
  programDayId?: string | null;
  body: string;
  logMode?: string | null;
  plannedLine?: string;
  experienceLevel?: string;
  coachingTone?: string;
}) {
  const note = await upsertExerciseNoteForUser(input);
  if (!note.body) {
    throw new AppError("VALIDATION", "Type a note or question first.");
  }
  const mode = resolveLogMode({
    logMode: input.logMode,
    name: note.exerciseName,
  });
  const planned =
    input.plannedLine?.trim() ||
    plannedSetLine({
      sets: 0,
      reps: "",
      restSeconds: 0,
      logMode: mode,
      name: note.exerciseName,
    });
  const lane = coachLaneForExercise(note.exerciseName);
  const message = [
    `Exercise: ${note.exerciseName}.`,
    `Log mode: ${mode}. Only weighted lifts (load_reps) use reps + lbs — do not invent pounds.`,
    planned ? `Planned work: ${planned}.` : "",
    `Member note or question: ${note.body}`,
    "Give one or two practical cues. YouTube / Learn clips are external references, not SVG-produced film.",
  ]
    .filter(Boolean)
    .join(" ");
  const reply = await answerScopedCoachQuestion({
    userId: input.userId,
    message,
    experienceLevel: input.experienceLevel,
    coachingTone: input.coachingTone,
    topic: lane.topic,
    art: lane.art,
  });
  const saved = await prisma.exerciseNote.update({
    where: {
      userId_exerciseName_programDayId: {
        userId: input.userId,
        exerciseName: note.exerciseName,
        programDayId: note.programDayId,
      },
    },
    data: { aiReply: reply.content, aiOffline: reply.offline },
  });
  return { ...toView(saved), refused: reply.refused };
}
