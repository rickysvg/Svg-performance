import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  chipMarksAfterPlans,
  overlayChipSessionIds,
  realignProgramCompletions,
} from "@/lib/chip-days";
import { explicitStartHref, primaryTrainCta } from "@/lib/train-cta";
import {
  applySavedWorkoutToDay,
  createSavedWorkout,
  listDayPlansForUser,
  renameSavedWorkout,
  startDayPlanForUser,
  startSavedWorkoutForUser,
} from "@/lib/my-workouts";
import { APP_TIMEZONE } from "@/lib/timezone";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const pushUp = { name: "Push-up", sets: 3, reps: "10", loadText: "", restSeconds: 60 };

describe("train page lock-in", () => {
  it("keeps one Start or Resume, and Preview does not start a session", () => {
    expect(primaryTrainCta({ resumeHref: "/training/log/draft-1", startHref: "/training/bike/start" })).toEqual({
      verb: "Resume",
      href: "/training/log/draft-1",
    });
    expect(primaryTrainCta({ startHref: "/training/bike/start" })).toEqual({
      verb: "Start",
      href: "/training/bike/start",
    });
    expect(primaryTrainCta({})).toBeNull();
    expect(
      explicitStartHref({
        replaced: true,
        plans: [{ id: "plan-1", complete: false, draftId: null }],
        action: { dayId: "lift", startHref: "/training/lift/start" },
      }),
    ).toBe("/training/my-workouts/day/plan-1/start");
    expect(
      explicitStartHref({
        replaced: false,
        plans: [],
        action: { dayId: "lift", startHref: "/training/lift/start" },
      }),
    ).toBe("/training/lift/start");

    const train = read("src/app/(member)/training/page.tsx");
    const preview = read("src/app/(member)/training/[dayId]/page.tsx");
    const applied = read("src/app/(member)/training/my-workouts/day/[planId]/page.tsx");
    expect(train).toContain("data-primary-train-cta");
    expect(train).toContain("<TodaySummary");
    expect(train).not.toContain("<SparringLogTile");
    expect(train).not.toContain("<StartTodayButton");
    expect(train).not.toContain("<NextSessionCta");
    expect(train.match(/data-resume-workout/g)).toHaveLength(1);
    expect(preview).not.toContain("startWorkoutFromDay");
    expect(preview).toContain("prefetch={false}");
    expect(applied).not.toContain("startDayPlanForUser");
    expect(applied).toContain("data-day-plan-preview");
    expect(read("src/components/training/PlanSessionCard.tsx")).toContain("Preview");
    expect(read("src/components/training/PlanSessionCard.tsx")).not.toContain(">Resume<");
    expect(read("src/components/training/CustomWorkoutCard.tsx")).not.toContain(">Resume<");
    expect(read("src/lib/week-carousel.ts")).toContain("return `${basePath}?day=${day.dayParam}`");
    expect(read("src/components/MemberFrame.tsx")).toContain("min-w-0");
    expect(read("src/components/MemberFrame.tsx")).toContain("pb-36");
  });

  it("overlays apply-to-day on the chip and follows a moved session", () => {
    expect(
      overlayChipSessionIds(["lift", "bag"], [
        { id: "extra", mode: "extra", complete: false, partial: false },
      ]),
    ).toEqual(["lift", "bag", "extra"]);
    expect(
      overlayChipSessionIds(["lift", "bag"], [
        { id: "plan", mode: "replace", complete: true, partial: false },
        { id: "extra", mode: "extra", complete: false, partial: false },
      ]),
    ).toEqual(["plan", "extra"]);

    const replaced = chipMarksAfterPlans({
      days: [{ dayParam: "2026-10-21", weekStart: "2026-10-19", sessionIds: ["lift", "bag"] }],
      completedByDay: {},
      partialDays: [],
      plansByDay: {
        "2026-10-21": [{ id: "plan", mode: "replace", complete: true, partial: false }],
      },
      offPlan: {},
    });
    expect(replaced.sessionIdsByDay["2026-10-21"]).toEqual(["plan"]);
    expect(replaced.loggedDays).toContain("2026-10-21");
    expect(replaced.partialDays).not.toContain("2026-10-21");

    const beside = chipMarksAfterPlans({
      days: [{ dayParam: "2026-10-21", weekStart: "2026-10-19", sessionIds: ["lift"] }],
      completedByDay: {},
      partialDays: [],
      plansByDay: {},
      offPlan: { "2026-10-21": { done: true, partial: false } },
    });
    expect(beside.partialDays).toContain("2026-10-21");
    expect(beside.loggedDays).not.toContain("2026-10-21");

    const alone = chipMarksAfterPlans({
      days: [{ dayParam: "2026-10-20", weekStart: "2026-10-19", sessionIds: [] }],
      completedByDay: {},
      partialDays: [],
      plansByDay: {},
      offPlan: { "2026-10-20": { done: true, partial: false } },
    });
    expect(alone.loggedDays).toContain("2026-10-20");
    expect(alone.partialDays).not.toContain("2026-10-20");

    const short = chipMarksAfterPlans({
      days: [{ dayParam: "2026-10-20", weekStart: "2026-10-19", sessionIds: [] }],
      completedByDay: {},
      partialDays: ["2026-10-20"],
      plansByDay: {},
      offPlan: { "2026-10-20": { done: false, partial: true } },
    });
    expect(short.partialDays).toContain("2026-10-20");
    expect(short.loggedDays).not.toContain("2026-10-20");

    const days = [
      { dayParam: "2026-10-19", weekStart: "2026-10-19", sessionIds: ["bag"] },
      { dayParam: "2026-10-20", weekStart: "2026-10-19", sessionIds: ["lift"] },
    ];
    expect(realignProgramCompletions(days, { "2026-10-19": ["lift"] })["2026-10-20"]).toContain("lift");
    const moved = chipMarksAfterPlans({
      days,
      completedByDay: { "2026-10-19": ["lift"] },
      partialDays: [],
      plansByDay: {},
      offPlan: {},
    });
    expect(moved.loggedDays).toContain("2026-10-20");
    expect(moved.loggedDays).not.toContain("2026-10-19");
    expect(moved.completedByDay["2026-10-19"] ?? []).not.toContain("lift");

    const monday = chipMarksAfterPlans({
      days: [{ dayParam: "2026-10-19", weekStart: "2026-10-19", sessionIds: ["lift", "bag"] }],
      completedByDay: {},
      partialDays: ["2026-10-19"],
      plansByDay: {},
      offPlan: {},
    });
    expect(monday.completedByDay["2026-10-19"]).toEqual([]);
    expect(monday.partialDays).toContain("2026-10-19");
    expect(monday.loggedDays).not.toContain("2026-10-19");
  });

  it("renames the saved workout, the day plan, and the session, and rejects the same name", async () => {
    await resetDatabase();
    const user = await makeUser("rename-lock@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "Daru",
      exercises: [pushUp],
    });
    const plan = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: "2026-10-21",
      mode: "replace",
    });
    const session = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const renamed = await renameSavedWorkout(user.id, saved.id, "Daru two");
    expect(renamed.name).toBe("Daru two");
    expect((await prisma.dayWorkoutPlan.findUnique({ where: { id: plan.id } }))?.name).toBe("Daru two");
    expect((await prisma.workoutSession.findUnique({ where: { id: session.id } }))?.title).toBe("Daru two");
    expect((await listDayPlansForUser(user.id, ["2026-10-21"]))[0]?.name).toBe("Daru two");
    await expect(renameSavedWorkout(user.id, saved.id, "Daru two")).rejects.toThrow(/Stored as "Daru two"/);
    const card = read("src/components/training/MyWorkoutCard.tsx");
    expect(card).toContain("setRenameOpen(false)");
    expect(card).toContain("setApplyOpen(false)");
    expect(card).toContain('Saved as “${rename.name}”.');
    expect(read("src/components/training/SavedWorkoutEditor.tsx")).toContain("Exercises saved.");
    expect(read("src/components/training/SavedWorkoutEditor.tsx")).not.toContain('name="name"');
  });

  it("replaces a day in one transaction and keeps one resume target", async () => {
    await resetDatabase();
    const user = await makeUser("replace-lock@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "Arms",
      exercises: [pushUp],
    });
    const first = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: "2026-10-21",
      mode: "replace",
    });
    const logged = await startDayPlanForUser({
      userId: user.id,
      planId: first.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await prisma.workoutSession.update({ where: { id: logged.id }, data: { status: "complete" } });
    const empty = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        savedWorkoutId: saved.id,
        dayPlanId: first.id,
        title: "Arms",
        performedAt: new Date("2026-10-21T16:00:00Z"),
        status: "draft",
        plannedSetCount: 1,
        sets: { create: [{ exerciseName: "Push-up", setNumber: 1, completed: false }] },
      },
    });
    const second = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: "2026-10-21",
      mode: "replace",
    });
    expect(second.id).not.toBe(first.id);
    expect(await prisma.dayWorkoutPlan.findUnique({ where: { id: first.id } })).toBeNull();
    expect(await prisma.workoutSession.findUnique({ where: { id: empty.id } })).toBeNull();
    const kept = await prisma.workoutSession.findUnique({ where: { id: logged.id } });
    expect(kept?.dayPlanId).toBeNull();
    expect(await prisma.workoutSession.count({ where: { dayPlanId: first.id } })).toBe(0);

    const yesterday = new Date("2026-10-20T16:00:00Z");
    const olderEmpty = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        savedWorkoutId: saved.id,
        title: "Arms",
        performedAt: yesterday,
        status: "draft",
        plannedSetCount: 1,
        sets: { create: [{ exerciseName: "Push-up", setNumber: 1, completed: false }] },
      },
    });
    const ticked = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        savedWorkoutId: saved.id,
        title: "Arms",
        performedAt: yesterday,
        status: "draft",
        plannedSetCount: 1,
        sets: { create: [{ exerciseName: "Push-up", setNumber: 1, reps: 8, completed: true }] },
      },
    });
    const newest = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        savedWorkoutId: saved.id,
        title: "Arms",
        performedAt: yesterday,
        status: "draft",
        plannedSetCount: 1,
        sets: { create: [{ exerciseName: "Push-up", setNumber: 1, completed: false }] },
      },
    });
    const resumed = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(resumed.id).toBe(newest.id);
    expect(await prisma.workoutSession.findUnique({ where: { id: olderEmpty.id } })).toBeNull();
    expect(await prisma.workoutSession.findUnique({ where: { id: ticked.id } })).toBeTruthy();
  });
});
