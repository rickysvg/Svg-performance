import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSessionRecord } from "@/lib/auth";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import {
  completedProgramDayIdsOnDay,
  getPreviousLoadsForSlots,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { extendSessionExpiry } from "@/lib/session";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import { previousSetLabel } from "@/lib/exercise-media";
import { applyPreviousToSet } from "@/lib/logger-prefill";
import { activeRest, mergeDraftOntoSets, type LoggerDraft } from "@/lib/logger-draft";
import { remainingRestSeconds, startRestTimer } from "@/lib/rest-timer";
import { todayStartAction, todayStartLabel } from "@/lib/today-start";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("prescription slot history", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps a 5×5 day separate from an 8–12 day of the same exercise", () => {
    const five = prescriptionSlotKey({
      exerciseName: "Goblet squat",
      reps: "5",
      programSlug: "demo-strength-base",
      dayNumber: 1,
    });
    const hypertrophy = prescriptionSlotKey({
      exerciseName: "Goblet squat",
      reps: "8–12",
      programSlug: "demo-strength-base",
      dayNumber: 12,
    });
    expect(five).not.toBe(hypertrophy);
    expect(five).toContain("goblet squat::5");
    expect(hypertrophy).toContain("goblet squat::8-12");
    expect(
      prescriptionSlotKey({
        exerciseName: "Goblet squat",
        reps: "8–12",
        programSlug: "demo-strength-base",
        dayNumber: 12,
      }),
    ).toBe(hypertrophy);
  });

  it("does not reuse the other scheme as previous load, and shows stored RIR", async () => {
    const user = await makeUser("slots@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const five = prescriptionSlotKey({
      exerciseName: "Goblet squat",
      reps: "5",
      programSlug: program.slug,
      dayNumber: 1,
    });
    const hypertrophy = prescriptionSlotKey({
      exerciseName: "Goblet squat",
      reps: "8-12",
      programSlug: program.slug,
      dayNumber: 12,
    });

    const heavy = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: heavy.id,
      title: heavy.title,
      performedAt: new Date("2026-09-01T15:00:00Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 5,
          loadValue: 95,
          loadUnit: "lb",
          completed: true,
          prescriptionKey: five,
          rir: "0-2 RIR",
        },
      ],
    });

    const pump = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: pump.id,
      title: pump.title,
      performedAt: new Date("2026-09-08T15:00:00Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 10,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
          prescriptionKey: hypertrophy,
          rir: "2-4 RIR",
        },
      ],
    });

    const current = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const stamped = current.sets.find((set) => set.exerciseName === "Goblet squat");
    expect(stamped?.prescriptionKey).toContain("goblet squat::");
    expect(stamped?.rir).toMatch(/RIR/);

    const previousFive = await getPreviousLoadsForSlots(
      user.id,
      [{ exerciseName: "Goblet squat", prescriptionKey: five }],
      current.id,
    );
    const previousPump = await getPreviousLoadsForSlots(
      user.id,
      [{ exerciseName: "Goblet squat", prescriptionKey: hypertrophy }],
      current.id,
    );
    expect(previousFive["Goblet squat"]?.[1]).toMatchObject({
      reps: 5,
      loadValue: 95,
      rir: "0-2 RIR",
      prescriptionKey: five,
    });
    expect(previousPump["Goblet squat"]?.[1]?.loadValue).toBe(40);
    expect(previousFive["Goblet squat"]?.[1]?.loadValue).not.toBe(40);
    expect(
      previousSetLabel({
        reps: 5,
        loadValue: 95,
        loadUnit: "lb",
        rir: "0-2 RIR",
      }),
    ).toBe("5 × 95 lbs · 0-2 RIR");
  });

  it("copies one previous set and leaves the other rows alone", () => {
    const sets = [
      {
        id: "a",
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: null,
        loadValue: null,
        durationSeconds: null,
        rir: "",
      },
      {
        id: "b",
        exerciseName: "Goblet squat",
        setNumber: 2,
        reps: null,
        loadValue: null,
        durationSeconds: null,
        rir: "",
      },
    ];
    const next = applyPreviousToSet(sets, "a", {
      reps: 5,
      loadValue: 95,
      durationSeconds: null,
      rir: "0-2 RIR",
    });
    expect(next[0]).toMatchObject({ reps: 5, loadValue: 95, rir: "0-2 RIR" });
    expect(next[1]).toMatchObject({ reps: null, loadValue: null, rir: "" });
  });
});

describe("crash-proof logger draft", () => {
  it("restores the completed set and recomputes rest from the original end time", () => {
    const started = 1_700_000_000_000;
    const rest = startRestTimer("Goblet squat", 90, started);
    const draft: LoggerDraft = {
      version: 1,
      sessionId: "session-1",
      savedAt: started + 25_000,
      rest,
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 5,
          loadValue: 95,
          loadUnit: "lb",
          logMode: "load_reps",
          durationSeconds: null,
          completed: true,
          notes: "",
          prescriptionKey: "demo:1|goblet squat::5",
          rir: "0-2 RIR",
        },
      ],
    };
    const merged = mergeDraftOntoSets(
      [
        {
          id: "server-1",
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          durationSeconds: null,
          completed: false,
          notes: "",
          prescriptionKey: "demo:1|goblet squat::5",
          rir: "0-2 RIR",
        },
        {
          id: "server-2",
          exerciseName: "Goblet squat",
          setNumber: 2,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          durationSeconds: null,
          completed: false,
          notes: "",
          prescriptionKey: "demo:1|goblet squat::5",
          rir: "0-2 RIR",
        },
      ],
      draft,
    );
    expect(merged[0]).toMatchObject({ id: "server-1", completed: true, reps: 5, loadValue: 95 });
    expect(merged[1]).toMatchObject({ id: "server-2", completed: false });
    const now = started + 25_000;
    const resumed = activeRest(draft.rest, now);
    expect(resumed?.endsAtMs).toBe(rest.endsAtMs);
    expect(remainingRestSeconds(resumed, now)).toBe(65);
    expect(activeRest(draft.rest, rest.endsAtMs)).toBeNull();
  });

  it("syncs a logged set and the original rest end time", async () => {
    const user = await makeUser("draft-rest@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const endsAt = new Date("2026-10-03T18:05:00.000Z");
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date("2026-10-03T18:00:00.000Z"),
      notes: "",
      status: "draft",
      rest: { exerciseName: "Goblet squat", endsAtMs: endsAt.getTime() },
      sets: session.sets.map((set) => {
        const tapped = set.exerciseName === "Goblet squat" && set.setNumber === 1;
        return {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: tapped ? 8 : null,
          loadValue: tapped ? 40 : null,
          loadUnit: "lb" as const,
          completed: tapped,
          prescriptionKey: set.prescriptionKey,
          rir: set.rir,
        };
      }),
    });
    const saved = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    const tapped = saved.sets.find(
      (set) => set.exerciseName === "Goblet squat" && set.setNumber === 1,
    );
    expect(tapped).toMatchObject({ completed: true, reps: 8, loadValue: 40 });
    expect(saved.restExerciseName).toBe("Goblet squat");
    expect(saved.restEndsAt?.toISOString()).toBe(endsAt.toISOString());
    const untouched = saved.sets.find(
      (set) => set.exerciseName === "Goblet squat" && set.setNumber === 2,
    );
    expect(untouched?.completed).toBe(false);
  });

  it("slides a live login forward and leaves an expired one alone", async () => {
    const user = await makeUser("extend-session@example.com");
    const { token } = await createSessionRecord(user.id);
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() + 60_000) },
    });
    const extended = await extendSessionExpiry(token);
    expect(extended).not.toBeNull();
    expect(extended!.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 60 * 60 * 1000);

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });
    expect(await extendSessionExpiry(token)).toBeNull();
  });
});

describe("start today", () => {
  const sessions = [
    {
      kind: "skill",
      label: "Bag",
      title: "Bag — intelligent jab",
      subtitle: "Intelligent jab · Block A — Jab IQ and range",
      dayId: "bag",
      href: "/training/bag",
      minutes: 32,
    },
    {
      kind: "strength",
      label: "Lower",
      title: "Lower body",
      subtitle: "Squat, hinge, and anti-rotation · Block A",
      dayId: "lift",
      href: "/training/lift",
      minutes: 28,
    },
  ];

  it("names today's session and becomes Resume when that session is in progress", () => {
    const start = todayStartAction(sessions, () => undefined);
    expect(start).toMatchObject({
      verb: "Start today",
      modality: "Skill",
      theme: "Intelligent jab",
      minutes: 32,
      dayId: "bag",
    });
    expect(todayStartLabel(start!)).toBe("Start today · Skill · Intelligent jab · ~32 min");

    const resume = todayStartAction(sessions, (dayId) => (dayId === "bag" ? "draft-9" : undefined));
    expect(resume).toMatchObject({ verb: "Resume", draftId: "draft-9", theme: "Intelligent jab" });
    expect(todayStartLabel(resume!)).toBe("Resume · Skill · Intelligent jab · ~32 min");
  });

  it("starts the next session after today's first one is already done", () => {
    const next = todayStartAction(
      sessions.map((session) =>
        session.dayId === "bag" ? { ...session, completed: true } : session,
      ),
      () => undefined,
    );
    expect(next).toMatchObject({
      verb: "Start today",
      modality: "Strength",
      theme: "Squat, hinge, and anti-rotation",
      dayId: "lift",
    });
    expect(todayStartAction([{ kind: "rest", label: "Rest", title: "Rest", subtitle: "Off", minutes: 0 }], () => undefined)).toBeNull();
  });

  it("puts the start button above the week strip and keeps rest inside the logger", () => {
    const page = read("src/app/(member)/training/page.tsx");
    const form = read("src/components/training/WorkoutLogForm.tsx");
    expect(page.indexOf("<StartTodayButton")).toBeGreaterThan(-1);
    expect(page.indexOf("<StartTodayButton")).toBeLessThan(page.indexOf("<WeekStrip"));
    expect(form).toContain("data-use-previous");
    expect(form).toContain("data-rest-countdown");
    expect(form).toContain("data-rest-skip");
    expect(form).toContain("data-rest-plus");
    expect(form).toContain("data-rest-minus");
    expect(form).toContain("writeLoggerDraft");
    expect(form).toContain("syncWorkoutDraftAction");
    expect(form).not.toContain("text-6xl");
    expect(form).not.toContain("Start rest");
    expect(form).toContain("/api/session/touch");
    const logPage = read("src/app/(member)/training/log/[sessionId]/page.tsx");
    expect(logPage).not.toContain("extendActiveSession");
    expect(read("src/app/api/session/touch/route.ts")).toContain("extendActiveSession");
  });
});

describe("today's finished program days", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts a program day complete only when it was finished on that local day", async () => {
    const user = await makeUser("done-today@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const other = program.days[1];
    const finished = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: finished.id,
      title: finished.title,
      performedAt: new Date("2026-10-03T18:00:00Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 5,
          loadValue: 50,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const onDay = await completedProgramDayIdsOnDay(
      user.id,
      [day.id, other.id],
      new Date("2026-10-03T18:00:00Z"),
      "UTC",
    );
    expect(onDay).toEqual([day.id]);
    const nextDay = await completedProgramDayIdsOnDay(
      user.id,
      [day.id],
      new Date("2026-10-04T18:00:00Z"),
      "UTC",
    );
    expect(nextDay).toEqual([]);
  });
});
