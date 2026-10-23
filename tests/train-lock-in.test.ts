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
import { draftHasResumeWork } from "@/lib/logged-work";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { APPLY_TOAST, APPLY_TOAST_MS, REPLACE_LOGGED_CONFIRM, RENAME_TOAST_MS, applySheetSettle, confirmReplaceForDay, renameSheetSettle, renameToast } from "@/lib/workout-sheet";
import { sessionCompletionDay } from "@/lib/performed-at";
import {
  applySavedWorkoutToDay,
  createSavedWorkout,
  listDayPlansForUser,
  renameSavedWorkout,
  revertDayToProgram,
  sessionBlocksDayReplace,
  startDayPlanForUser,
  startSavedWorkoutForUser,
} from "@/lib/my-workouts";
import { getCalendarSchedule, loggedSessionCardLine, sessionStatusLine, subtitleCountsAsMissed } from "@/lib/calendar";
import { chipMarkForDay } from "@/lib/chip-mark";
import { offPlanMarksByLocalDay, partialLocalDayKeys } from "@/lib/chip-completion";
import { deleteWorkoutSessionForUser } from "@/lib/workouts";
import { formatDayParam } from "@/lib/home";
import { APP_TIMEZONE, dayKey } from "@/lib/timezone";

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
    expect(
      explicitStartHref({
        replaced: false,
        plans: [],
        action: { href: "/training/lift", logHref: "/training/lift" },
      }),
    ).toBeNull();
    expect(
      explicitStartHref({
        replaced: false,
        plans: [],
        action: { draftId: "today-draft", href: "/training/lift" },
      }),
    ).toBe("/training/log/today-draft");
    expect(
      explicitStartHref({
        replaced: true,
        plans: [{ id: "plan-1", complete: false, draftId: "old-draft" }],
        action: null,
      }),
    ).toBe("/training/my-workouts/day/plan-1/start");

    const train = read("src/app/(member)/training/page.tsx");
    const preview = read("src/app/(member)/training/[dayId]/page.tsx");
    const applied = read("src/app/(member)/training/my-workouts/day/[planId]/page.tsx");
    expect(train).toContain("data-primary-train-cta");
    expect(train).toContain("draftHasResumeWork");
    expect(train).toContain("todayDrafts");
    expect(train).not.toContain("[...drafts].sort");
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

    const partialMoved = chipMarksAfterPlans({
      days,
      completedByDay: {},
      partialDays: ["2026-10-19"],
      partialByDay: { "2026-10-19": ["lift"] },
      plansByDay: {},
      offPlan: {},
    });
    expect(partialMoved.partialDays).toContain("2026-10-20");
    // The lift follows Thursday's chip, and the day it was logged stays partly logged.
    expect(partialMoved.partialDays).toContain("2026-10-19");
    expect(partialMoved.loggedDays).not.toContain("2026-10-19");

    const partialStayed = chipMarksAfterPlans({
      days: [{ dayParam: "2026-10-19", weekStart: "2026-10-19", sessionIds: ["lift", "bag"] }],
      completedByDay: {},
      partialDays: ["2026-10-19"],
      partialByDay: { "2026-10-19": ["lift"] },
      plansByDay: {},
      offPlan: { "2026-10-19": { done: false, partial: true } },
    });
    expect(partialStayed.partialDays).toContain("2026-10-19");

    // Mobility+Cardio is the plan. Lift 3 was logged partial on that civil day
    // and is shown on the lift chip. The plan card stays Missed. The chip does not.
    const loggedInstead = chipMarksAfterPlans({
      days: [
        { dayParam: "2026-10-20", weekStart: "2026-10-19", sessionIds: ["mobility", "cardio"] },
        { dayParam: "2026-10-22", weekStart: "2026-10-19", sessionIds: ["lift-3"] },
      ],
      completedByDay: {},
      partialDays: ["2026-10-20"],
      partialByDay: { "2026-10-20": ["lift-3"] },
      plansByDay: {},
      offPlan: {},
    });
    expect(loggedInstead.partialDays).toContain("2026-10-20");
    expect(loggedInstead.partialDays).toContain("2026-10-22");
    expect(loggedInstead.loggedDays).not.toContain("2026-10-20");
    expect(
      chipMarkForDay({
        plannedSessionIds: ["mobility", "cardio"],
        completedSessionIds: [],
        dayLogged: false,
        partial: loggedInstead.partialDays.includes("2026-10-20"),
      }),
    ).toBe("partial");
    expect(
      subtitleCountsAsMissed(
        "Not done — you logged Lift 3 instead. Tap Move to reschedule.",
      ),
    ).toBe(true);
  });

  it("ignores an untouched draft and a deleted session on the week chip", async () => {
    await resetDatabase();
    const user = await makeUser("chip-drafts@example.com");
    const performedAt = new Date("2026-10-22T18:00:00.000Z");
    const day = dayKey(performedAt, APP_TIMEZONE);
    const from = new Date("2026-10-21T12:00:00.000Z");
    const to = new Date("2026-10-24T12:00:00.000Z");
    const prefillKey = addedPrescriptionKey({
      exerciseName: "Push-up",
      reps: "10",
      restSeconds: 60,
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        status: "draft",
        title: "Push-up",
        performedAt,
        sets: {
          create: [
            {
              exerciseName: "Push-up",
              setNumber: 1,
              reps: 10,
              completed: false,
              prescriptionKey: prefillKey,
              logMode: "reps_only",
            },
          ],
        },
      },
    });
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        status: "deleted",
        title: "Deleted lift",
        performedAt,
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 8,
              loadValue: 40,
              completed: true,
            },
          ],
        },
      },
    });
    expect(draftHasResumeWork([{ completed: false, reps: 10, prescriptionKey: prefillKey, logMode: "reps_only" }])).toBe(
      false,
    );
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect((await offPlanMarksByLocalDay(user.id, from, to, APP_TIMEZONE))[day]).toBeUndefined();

    const resumed = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        status: "draft",
        title: "Lift 3",
        performedAt,
        plannedSetCount: 34,
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 5,
              loadValue: 35,
              completed: true,
            },
          ],
        },
      },
    });
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
    await deleteWorkoutSessionForUser(resumed.id, user.id);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);

    const worked = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        status: "partial",
        title: "Lift 3",
        performedAt,
        plannedSetCount: 34,
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 8,
              loadValue: 40,
              completed: true,
            },
          ],
        },
      },
    });
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
    await deleteWorkoutSessionForUser(worked.id, user.id);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect(await prisma.workoutSession.findUnique({ where: { id: worked.id } })).toBeNull();
  });

  it("asks before replace when today has a ticked draft from another plan", async () => {
    await resetDatabase();
    const user = await makeUser("replace-lift-draft@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "Daru Alactic Power",
      exercises: [pushUp],
    });
    const day = "2026-10-22";
    const draft = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lift 3 — Light full body",
        status: "draft",
        performedAt: new Date("2026-10-22T18:00:00.000Z"),
        plannedSetCount: 34,
        sets: {
          create: [
            { exerciseName: "Ankle circles", setNumber: 1, reps: 8, completed: true },
            { exerciseName: "Goblet squat", setNumber: 1, completed: false },
          ],
        },
      },
    });
    const prefill = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Untouched",
        status: "draft",
        performedAt: new Date("2026-10-21T18:00:00.000Z"),
        sets: {
          create: [
            {
              exerciseName: "Push-up",
              setNumber: 1,
              reps: 10,
              completed: false,
              logMode: "reps_only",
              prescriptionKey: addedPrescriptionKey({
                exerciseName: "Push-up",
                reps: "10",
                restSeconds: 60,
              }),
            },
          ],
        },
      },
    });
    expect(
      sessionBlocksDayReplace({
        status: "draft",
        sets: [{ exerciseName: "Ankle circles", reps: 8, completed: true }],
      }),
    ).toBe(true);
    expect(
      sessionBlocksDayReplace({
        status: "draft",
        sets: [{ completed: false, reps: null, notes: "" }],
      }),
    ).toBe(false);
    await expect(
      applySavedWorkoutToDay({
        userId: user.id,
        savedWorkoutId: saved.id,
        dayKey: day,
        mode: "replace",
      }),
    ).rejects.toThrow(REPLACE_LOGGED_CONFIRM);
    expect(await prisma.dayWorkoutPlan.count({ where: { userId: user.id, dayKey: day } })).toBe(0);
    expect((await prisma.workoutSession.findUnique({ where: { id: draft.id } }))?.title).toBe(
      "Lift 3 — Light full body",
    );

    const applied = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: day,
      mode: "replace",
      confirm: true,
    });
    expect(applied.name).toBe("Daru Alactic Power");
    expect(await prisma.workoutSession.findUnique({ where: { id: draft.id } })).toBeTruthy();
    expect(await prisma.workoutSession.findUnique({ where: { id: prefill.id } })).toBeTruthy();

    const otherDay = await createSavedWorkout({
      userId: user.id,
      name: "Easy",
      exercises: [pushUp],
    });
    const quiet = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: otherDay.id,
      dayKey: "2026-10-21",
      mode: "replace",
    });
    expect(quiet.dayKey).toBe("2026-10-21");
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
    const submit = card.slice(card.indexOf("onSubmit={(event)"), card.indexOf("data-apply-replace"));
    expect(card).toContain("setRenameOpen(false)");
    expect(card).toContain("renameSheetSettle");
    expect(card).toContain("applySheetSettle");
    expect(card).toContain("RENAME_TOAST_MS");
    expect(card).toContain("APPLY_TOAST_MS");
    expect(card).toContain("data-apply-replace-confirm");
    expect(card).toContain("data-replace-logged-confirm");
    const applySheet = card.slice(card.indexOf("data-apply-sheet"), card.indexOf("data-delete-confirm"));
    expect(applySheet).toContain('type="button"');
    expect(applySheet).toContain("Cancel");
    expect(card).toContain("data-apply-toast");
    expect(submit).not.toContain("setApplyOpen(false)");
    expect(submit).toContain("applyStarted.current = true");
    expect(renameToast("Daru two")).toBe("Saved as “Daru two”.");
    expect(renameSheetSettle({ renamed: true, name: "Daru two" })).toEqual({
      close: true,
      toast: "Saved as “Daru two”.",
    });
    expect(RENAME_TOAST_MS).toBe(3000);
    expect(APPLY_TOAST_MS).toBe(3000);
    expect(sessionStatusLine("Lift", "Missed")).toBe("Lift · Missed");
    expect(sessionStatusLine("Bag", "Partial")).toBe("Bag · Partial");
    expect(
      loggedSessionCardLine({
        title: "Lift 1 — Full body",
        status: "scheduled",
        subtitle: "Partial · 4/10 sets",
      }),
    ).toBe("Lift 1 — Full body · Partial · 4/10 sets");
    expect(
      loggedSessionCardLine({
        title: "Quick lift",
        status: "scheduled",
        subtitle: "Quick lift · Partial",
      }),
    ).toBe("Quick lift · Partial");
    expect(
      loggedSessionCardLine({
        title: "Daru Alactic Power",
        status: "complete",
        subtitle: "Daru Alactic Power · Done",
      }),
    ).toBe("Daru Alactic Power · Done");
    expect(
      loggedSessionCardLine({
        title: "Lift 1 — Full body",
        status: "complete",
        subtitle: "Logged this day. Lift 1 — Full body",
      }),
    ).toBe("Lift 1 — Full body · Done");
    expect(confirmReplaceForDay({ confirmField: "replace", confirmDayKey: "2026-10-20", dayKey: "2026-10-20" })).toBe(
      true,
    );
    expect(confirmReplaceForDay({ confirmField: "replace", confirmDayKey: "2026-10-20", dayKey: "2026-10-22" })).toBe(
      false,
    );
    expect(confirmReplaceForDay({ confirmField: "replace", confirmDayKey: "", dayKey: "2026-10-22" })).toBe(false);
    expect(card).toContain("confirmDayKey");
    expect(card).toContain("value={applyDayKey}");
    expect(card).toContain("setApplyDismissed(true)");
    expect(card).not.toContain("defaultValue={todayKey}");
    expect(read("src/components/training/SavedWorkoutEditor.tsx")).toContain("Exercises saved.");
    expect(read("src/components/training/SavedWorkoutEditor.tsx")).not.toContain('name="name"');
  });

  it("keeps the Apply sheet open until the save settles and releases the lock", () => {
    expect(applySheetSettle({ pending: true, started: true, applied: false })).toEqual({
      locked: true,
      open: null,
      toast: null,
    });
    expect(applySheetSettle({ pending: false, started: false, applied: false }).open).toBeNull();
    expect(applySheetSettle({ pending: false, started: true, applied: true })).toEqual({
      locked: false,
      open: false,
      toast: APPLY_TOAST,
    });
    const again = applySheetSettle({ pending: false, started: true, applied: false });
    expect(again.locked).toBe(false);
    expect(again.open).toBe(true);
    expect(again.toast).toBeNull();
    expect(REPLACE_LOGGED_CONFIRM).toBe("You have logged sets on this day. Replace anyway?");
    expect(draftHasResumeWork([{ completed: true, reps: 8 }])).toBe(true);
    expect(draftHasResumeWork([{ completed: false, reps: 8 }])).toBe(true);
    expect(draftHasResumeWork([{ completed: false, reps: null, notes: "" }])).toBe(false);
    expect(
      draftHasResumeWork([
        {
          completed: false,
          reps: 10,
          loadValue: null,
          exerciseName: "Push-up",
          logMode: "reps_only",
          notes: "",
          prescriptionKey: addedPrescriptionKey({
            exerciseName: "Push-up",
            reps: "10",
            restSeconds: 60,
          }),
        },
      ]),
    ).toBe(false);
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
    const now = new Date("2026-10-22T18:00:00Z");
    const resumed = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    expect(resumed.id).not.toBe(newest.id);
    expect(resumed.id).not.toBe(olderEmpty.id);
    expect(resumed.id).not.toBe(ticked.id);
    expect(sessionCompletionDay(resumed, APP_TIMEZONE)).toBe("2026-10-22");
    expect(await prisma.workoutSession.findUnique({ where: { id: olderEmpty.id } })).toBeTruthy();
    expect(await prisma.workoutSession.findUnique({ where: { id: newest.id } })).toBeTruthy();
    expect(await prisma.workoutSession.findUnique({ where: { id: ticked.id } })).toBeTruthy();
    const again = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    expect(again.id).toBe(resumed.id);

    const worked = await startDayPlanForUser({
      userId: user.id,
      planId: second.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: worked.id },
      data: { reps: 8, completed: true },
    });
    await expect(
      applySavedWorkoutToDay({
        userId: user.id,
        savedWorkoutId: saved.id,
        dayKey: "2026-10-21",
        mode: "replace",
      }),
    ).rejects.toThrow(REPLACE_LOGGED_CONFIRM);
    expect((await prisma.workoutSession.findUnique({ where: { id: worked.id } }))?.dayPlanId).toBe(second.id);
    const replaced = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: "2026-10-21",
      mode: "replace",
      confirm: true,
    });
    const keptWork = await prisma.workoutSession.findUnique({ where: { id: worked.id } });
    expect(keptWork?.dayPlanId).toBeNull();
    expect(replaced.id).not.toBe(second.id);

    const edited = await startDayPlanForUser({
      userId: user.id,
      planId: replaced.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now,
    });
    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: edited.id },
      data: { reps: 4, completed: false },
    });
    await expect(
      applySavedWorkoutToDay({
        userId: user.id,
        savedWorkoutId: saved.id,
        dayKey: "2026-10-21",
        mode: "replace",
      }),
    ).rejects.toThrow(/Replace anyway/);
    expect((await prisma.workoutSession.findUnique({ where: { id: edited.id } }))?.dayPlanId).toBe(replaced.id);
  });

  it("keeps a note-only draft on revert and deletes a prefill-only draft", async () => {
    await resetDatabase();
    const user = await makeUser("revert-drafts@example.com");
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
    const noted = await startDayPlanForUser({
      userId: user.id,
      planId: plan.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: noted.id },
      data: { notes: "sore", completed: false },
    });
    const prefill = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        dayPlanId: plan.id,
        status: "draft",
        title: "Daru",
        performedAt: new Date("2026-10-21T16:00:00.000Z"),
        sets: {
          create: [
            {
              exerciseName: "Push-up",
              setNumber: 1,
              reps: 10,
              completed: false,
              prescriptionKey: addedPrescriptionKey({
                exerciseName: "Push-up",
                reps: "10",
                restSeconds: 60,
              }),
            },
          ],
        },
      },
    });
    expect(draftHasResumeWork([{ notes: "sore", completed: false, reps: null, loadValue: null, durationSeconds: null }])).toBe(true);
    await revertDayToProgram(user.id, "2026-10-21");
    expect(await prisma.dayWorkoutPlan.findUnique({ where: { id: plan.id } })).toBeNull();
    expect((await prisma.workoutSession.findUnique({ where: { id: noted.id } }))?.dayPlanId).toBeNull();
    expect(await prisma.workoutSession.findUnique({ where: { id: prefill.id } })).toBeNull();
  });

  it("counts a finished Start now session as Done on its own card", async () => {
    await resetDatabase();
    const user = await makeUser("daru-own-done@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "Daru",
      exercises: [pushUp],
    });
    const loggedAt = new Date("2026-10-21T18:00:00.000Z");
    const now = new Date("2026-10-22T18:00:00.000Z");
    const started = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: loggedAt,
    });
    await prisma.workoutSession.update({
      where: { id: started.id },
      data: { status: "complete", plannedSetCount: started.sets.length, performedAt: loggedAt },
    });
    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: started.id },
      data: { reps: 10, completed: true },
    });
    const schedule = await getCalendarSchedule(user.id, now, new Date("2026-10-19T16:00:00.000Z"));
    const day = formatDayParam(loggedAt, APP_TIMEZONE);
    const cards =
      schedule.days.find((item) => formatDayParam(item.date, APP_TIMEZONE) === day)?.activities ?? [];
    const daru = cards.find((item) => item.title === "Daru");
    expect(daru?.status).toBe("complete");
    expect(daru?.subtitle).toBe(sessionStatusLine("Daru", "Done"));
    expect(daru?.programDayId).toBeUndefined();
    const program = cards.filter((item) => item.programDayId);
    expect(program.length).toBeGreaterThan(0);
    expect(program.every((item) => item.status !== "complete")).toBe(true);
    expect(program.every((item) => item.subtitle.endsWith("· Missed") || item.subtitle.endsWith("· Partial"))).toBe(
      true,
    );
  });
});
