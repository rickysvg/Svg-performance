import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { coachReplyLabel, recordedCoachIdAt } from "@/lib/coaches";
import { loggedSetVolume } from "@/lib/home-telemetry";
import { partialSetsLine } from "@/lib/logged-work";
import { mealTypeForZonedNow } from "@/lib/nutrition";
import { nextTrainAction } from "@/lib/train-next";
import { openLogsByProgramDay, todayStartAction, todayStartLabel } from "@/lib/today-start";
import { shouldCollapseWeighIn } from "@/components/progress/WeighInDisclosure";
import { shortBuildSha } from "@/lib/build-info";

const zone = "America/Denver";

describe("Oct 22 partial saves", () => {
  const sessions = [
    {
      id: "short",
      status: "complete",
      performedAt: new Date("2026-10-22T14:00:00.000Z"),
      programDayId: "lift",
      plannedSetCount: 4,
      sets: [
        { exerciseName: "Goblet squat", completed: true, reps: 8, loadValue: 95, durationSeconds: null },
      ],
      programDay: {
        exercises: [
          { name: "Goblet squat", sets: 4 },
          { name: "Row", sets: 3 },
        ],
      },
    },
    {
      id: "draft",
      status: "draft",
      performedAt: new Date("2026-10-22T15:00:00.000Z"),
      programDayId: "bag",
      sets: [{ exerciseName: "Jab", completed: false, reps: 8, loadValue: null, durationSeconds: null }],
      programDay: { exercises: [{ name: "Jab", sets: 3 }] },
    },
    {
      id: "empty",
      status: "draft",
      performedAt: new Date("2026-10-22T16:00:00.000Z"),
      programDayId: "shadow",
      sets: [{ exerciseName: "Jab", completed: false, reps: null, loadValue: null, durationSeconds: null }],
      programDay: { exercises: [{ name: "Jab", sets: 3 }] },
    },
  ];

  it("treats a short save as partial with ticked and planned counts", () => {
    const open = openLogsByProgramDay(sessions, "2026-10-22", zone);
    expect(open.get("lift")).toMatchObject({
      id: "short",
      partial: true,
      ticked: 1,
      planned: 7,
      progress: "Partial · 1/7 sets",
    });
    expect(open.get("bag")).toMatchObject({ id: "draft", partial: false, progress: undefined });
    expect(open.has("shadow")).toBe(false);
    expect(partialSetsLine(1, 7)).toBe("Partial · 1/7 sets");
  });

  it("makes Today and the next action Resume for a partial and a draft", () => {
    const logs = openLogsByProgramDay(sessions, "2026-10-22", zone);
    const today = todayStartAction(
      [
        {
          kind: "strength",
          label: "Lift",
          title: "Lift 3",
          subtitle: "Lightest lift of the week",
          dayId: "lift",
          minutes: 56,
        },
        {
          kind: "skill",
          label: "Bag",
          title: "Bag",
          subtitle: "Jab",
          dayId: "bag",
          minutes: 20,
        },
      ],
      (dayId) => logs.get(dayId),
    );
    expect(today).toMatchObject({ verb: "Resume", draftId: "short", partial: true, ticked: 1, planned: 7 });
    expect(todayStartLabel(today!)).toContain("Resume");
    expect(todayStartLabel(today!)).not.toContain("Continue");
    expect(todayStartLabel(today!)).toContain("Partial · 1/7 sets");

    const next = nextTrainAction(
      [
        { title: "Lift 3", kind: "strength", dayId: "lift" },
        { title: "Bag", kind: "skill", dayId: "bag" },
      ],
      (dayId) => logs.get(dayId),
      (dayId) => dayId === "done",
    );
    expect(next).toMatchObject({ verb: "Resume", draftId: "short", progress: "Partial · 1/7 sets" });
  });

  it("does not Resume a finished day because a second tab left a draft", () => {
    const finished = todayStartAction(
      [
        {
          kind: "strength",
          label: "Lift",
          title: "Lift 3",
          subtitle: "Lightest lift of the week",
          dayId: "lift",
          minutes: 56,
          completed: true,
        },
      ],
      () => "leftover-draft",
    );
    expect(finished).toBeNull();

    const next = nextTrainAction(
      [{ title: "Lift 3", kind: "strength", dayId: "lift" }],
      () => ({ id: "leftover-draft", partial: false, ticked: 0, planned: 7 }),
      () => true,
    );
    expect(next).toBeNull();

    const other = todayStartAction(
      [
        {
          kind: "strength",
          label: "Lift",
          title: "Lift 3",
          subtitle: "Lightest lift of the week",
          dayId: "lift",
          minutes: 56,
          completed: true,
        },
        {
          kind: "skill",
          label: "Bag",
          title: "Bag",
          subtitle: "Jab",
          dayId: "bag",
          minutes: 20,
        },
      ],
      (dayId) => (dayId === "lift" ? "leftover-draft" : undefined),
    );
    expect(other).toMatchObject({ verb: "Start today", dayId: "bag", draftId: undefined });
  });

  it("keeps a partial save when a newer empty draft is on that day and uses the scaled dose", () => {
    const open = openLogsByProgramDay(
      [
        {
          id: "empty-newer",
          status: "draft",
          performedAt: new Date("2026-10-22T18:00:00.000Z"),
          programDayId: "lift",
          sets: [
            {
              exerciseName: "Goblet squat",
              completed: false,
              reps: null,
              loadValue: null,
              durationSeconds: null,
            },
          ],
          programDay: { exercises: [{ name: "Goblet squat", sets: 4 }, { name: "Row", sets: 3 }] },
        },
        {
          id: "partial-older",
          status: "partial",
          performedAt: new Date("2026-10-22T14:00:00.000Z"),
          programDayId: "lift",
          sets: [
            {
              exerciseName: "Goblet squat",
              completed: true,
              reps: 8,
              loadValue: 40,
              durationSeconds: null,
            },
          ],
          programDay: { exercises: [{ name: "Goblet squat", sets: 4 }, { name: "Row", sets: 3 }] },
        },
      ],
      "2026-10-22",
      zone,
      new Map([["lift", { dose: 3, names: ["Goblet squat"] }]]),
    );
    expect(open.get("lift")).toMatchObject({
      id: "partial-older",
      partial: true,
      ticked: 1,
      planned: 3,
      progress: "Partial · 1/3 sets",
    });
    const today = todayStartAction(
      [
        {
          kind: "strength",
          label: "Lift",
          title: "Lift 3",
          subtitle: "Lightest lift of the week",
          dayId: "lift",
          minutes: 56,
        },
      ],
      (dayId) => open.get(dayId),
    );
    expect(today).toMatchObject({ verb: "Resume", draftId: "partial-older", planned: 3 });
  });

  it("drops a leftover draft on a day that already has a planned completion", () => {
    const sets = Array.from({ length: 4 }, () => ({
      exerciseName: "Goblet squat",
      completed: true,
      reps: 8,
      loadValue: 95,
      durationSeconds: null,
    }));
    const open = openLogsByProgramDay(
      [
        {
          id: "leftover",
          status: "draft",
          performedAt: new Date("2026-10-22T18:00:00.000Z"),
          programDayId: "lift",
          sets: [
            {
              exerciseName: "Goblet squat",
              completed: false,
              reps: 5,
              loadValue: 40,
              durationSeconds: null,
            },
          ],
          programDay: { exercises: [{ name: "Goblet squat", sets: 4 }] },
        },
        {
          id: "done",
          status: "complete",
          performedAt: new Date("2026-10-22T15:00:00.000Z"),
          programDayId: "lift",
          plannedSetCount: 4,
          sets,
          programDay: { exercises: [{ name: "Goblet squat", sets: 4 }] },
        },
      ],
      "2026-10-22",
      zone,
    );
    expect(open.has("lift")).toBe(false);
  });

  it("counts a blank-rep load as one rep and ignores an empty set", () => {
    expect(
      loggedSetVolume(
        [
          { reps: null, loadValue: 95, loadUnit: "lb" },
          { reps: 0, loadValue: 40, loadUnit: "lb" },
          { reps: null, loadValue: null, loadUnit: "lb" },
        ],
        "lb",
      ),
    ).toBe(135);
  });
});

describe("Oct 22 member clock and chrome", () => {
  it("picks lunch at 21:00Z in Denver", () => {
    expect(mealTypeForZonedNow(new Date("2026-10-22T21:00:00.000Z"), zone)).toBe("lunch");
    expect(mealTypeForZonedNow(new Date("2026-10-22T13:17:00.000Z"), zone)).toBe("breakfast");
  });

  it("collapses the weigh-in disclosure on Escape only while it is the focused surface", () => {
    expect(
      shouldCollapseWeighIn({ key: "Escape", defaultPrevented: false, open: true, inside: true }),
    ).toBe(true);
    expect(
      shouldCollapseWeighIn({ key: "Escape", defaultPrevented: true, open: true, inside: true }),
    ).toBe(false);
    expect(
      shouldCollapseWeighIn({ key: "Escape", defaultPrevented: false, open: false, inside: true }),
    ).toBe(false);
  });

  it("leaves a reply unlabeled unless the coach was already chosen", () => {
    const choice = new Date("2026-10-22T12:00:00.000Z");
    expect(
      recordedCoachIdAt({
        messageAt: new Date("2026-10-21T12:00:00.000Z"),
        coachChoiceAt: choice,
        aiCoachId: "maya",
      }),
    ).toBeNull();
    expect(
      recordedCoachIdAt({
        messageAt: new Date("2026-10-22T13:00:00.000Z"),
        coachChoiceAt: choice,
        aiCoachId: "maya",
      }),
    ).toBe("maya");
    expect(
      recordedCoachIdAt({
        messageAt: new Date("2026-10-22T13:00:00.000Z"),
        coachChoiceAt: null,
        aiCoachId: "skye",
      }),
    ).toBeNull();
    expect(coachReplyLabel(null)).toBe("Coach");
    expect(coachReplyLabel("")).toBe("Coach");
    expect(coachReplyLabel("maya")).toBe("Maya");
    const sql = fs.readFileSync(
      "prisma/migrations/20261022160000_chat_message_coach/migration.sql",
      "utf8",
    );
    expect(sql).toContain("coachChoiceAt");
    expect(sql).not.toContain("COALESCE");
  });

  it("shows local when the deploy has no commit sha", () => {
    const previous = process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    expect(shortBuildSha()).toBe("");
    process.env.VERCEL_GIT_COMMIT_SHA = "abc1234def";
    expect(shortBuildSha()).toBe("abc1234");
    if (previous == null) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previous;
  });
});
