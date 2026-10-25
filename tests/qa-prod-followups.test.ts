import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calendarLoggedExercises, calendarLoggedHref } from "@/lib/calendar";
import { applySessionPlacements } from "@/lib/calendar-placements";
import { templateDaySummary, type DaySummaryFacts } from "@/lib/coach/day-summary";
import { loggedSessionView } from "@/lib/logged-session-view";
import { zonedCivilToUtc } from "@/lib/timezone";
import { weekChipDateLabel } from "@/lib/week-plan";
import { liveBikeLoggedSeconds, workoutCompleteTiles } from "@/lib/workout-complete";
import { REMOVE_TOAST_MS } from "@/components/training/RemoveToast";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("prod QA follow-ups", () => {
  it("moves a Tuesday card back to Monday before the server list catches up", () => {
    const key = "Monday:demo-strength-base:1";
    const week = [
      { weekday: "Monday", activities: [] as { sessionKey: string; title: string; weekday: string }[] },
      {
        weekday: "Tuesday",
        activities: [{ sessionKey: key, title: "Lift 1", weekday: "Tuesday" }],
      },
    ];
    const live = applySessionPlacements(week, { [key]: "Monday" });
    expect(live.find((day) => day.weekday === "Tuesday")?.activities).toEqual([]);
    expect(live.find((day) => day.weekday === "Monday")?.activities.map((row) => row.title)).toEqual([
      "Lift 1",
    ]);

    const move = read("src/components/training/WorkoutMove.tsx");
    const body = move.slice(move.indexOf("async function moveHome"), move.indexOf("async function undo"));
    expect(body).toContain("placementAfterMoveBack");
    expect(body).toContain("beginSaving");
    expect(body).toContain("submitPlanIntent");
    expect(body).toContain('intent: "restore"');
    expect(body).toContain("acceptIntent");
    expect(body).toContain("refreshIfSettled");
    expect(body).not.toContain("useTransition");
    expect(move).toContain("replacePlanPlacements");
    expect(read("src/components/training/CalendarList.tsx")).toContain("usePlanPlacements");
    expect(read("src/components/MemberFrame.tsx")).toContain("min-w-0");
    expect(read("src/components/MemberFrame.tsx")).toContain("pb-36");
  });

  it("uses the live clock on a finished ride and the structure on a backfilled ride", () => {
    const created = new Date("2026-10-25T16:00:00.000Z");
    const sets = [
      {
        exerciseName: "Assault bike intervals",
        reps: null,
        loadValue: null,
        loadUnit: "lb" as const,
        completed: true,
        durationSeconds: 105 * 60,
        prescriptionKey: `timer#bw:c.${105 * 60}.0.1.0.0`,
      },
    ];
    const live = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Assault bike",
        status: "complete",
        performedAt: created,
        createdAt: created,
        updatedAt: new Date(created.getTime() + 135_000),
        elapsedSeconds: 135,
        sets,
      },
    });
    expect(live.find((tile) => tile.key === "time")?.value).toBe("2:15");

    const backfilled = workoutCompleteTiles({
      displayUnit: "lb",
      newPrCount: 0,
      session: {
        title: "Assault bike",
        status: "complete",
        performedAt: created,
        createdAt: created,
        updatedAt: new Date(created.getTime() + 135_000),
        elapsedSeconds: 135,
        backfilled: true,
        sets,
      },
    });
    expect(backfilled.find((tile) => tile.key === "time")?.value).toBe("1:45:00");
    expect(backfilled.find((tile) => tile.key === "time")?.value).not.toBe("2:15");
  });

  it("saves a live plan-day bike as the ridden seconds and keeps the plan on a past log", () => {
    expect(liveBikeLoggedSeconds({ plannedSeconds: 1500, sessionElapsed: 95 })).toBe(95);
    expect(liveBikeLoggedSeconds({ plannedSeconds: 1500, timerElapsed: 60, sessionElapsed: 635 })).toBe(60);
    expect(liveBikeLoggedSeconds({ plannedSeconds: 1500, timerElapsed: 0, sessionElapsed: 635 })).toBe(635);
    expect(
      liveBikeLoggedSeconds({ plannedSeconds: 1500, timerElapsed: 60, sessionElapsed: 95, backfilled: true }),
    ).toBe(1500);

    const created = new Date("2026-10-25T16:00:00.000Z");
    const key = "demo-strength-base:8|jamieson cardiac output bike::25:00";
    const ride = (elapsedSeconds: number, durationSeconds: number, backfilled = false) =>
      workoutCompleteTiles({
        displayUnit: "lb",
        newPrCount: 0,
        session: {
          title: "Cardio — bike",
          status: "complete",
          performedAt: created,
          createdAt: created,
          updatedAt: new Date(created.getTime() + elapsedSeconds * 1000),
          elapsedSeconds,
          backfilled,
          sets: [
            {
              exerciseName: "Jamieson cardiac output bike",
              reps: null,
              loadValue: null,
              loadUnit: "lb",
              completed: true,
              durationSeconds,
              prescriptionKey: key,
            },
          ],
        },
      });

    const short = ride(95, 95);
    expect(short.find((tile) => tile.key === "time")?.value).toBe("1:35");
    expect(short.find((tile) => tile.key === "volume")?.value).toBe("1:35");
    expect(short.find((tile) => tile.key === "time")?.value).not.toBe("25:00");

    const started = ride(635, 60);
    expect(started.find((tile) => tile.key === "time")?.value).toBe("1:00");
    expect(started.find((tile) => tile.key === "volume")?.value).toBe("1:00");
    expect(started.find((tile) => tile.key === "time")?.value).not.toBe("25:00");

    const past = ride(95, 1500, true);
    expect(past.find((tile) => tile.key === "time")?.value).toBe("25:00");

    const form = read("src/components/training/WorkoutLogForm.tsx");
    expect(form).toContain("liveBikeLoggedSeconds");
    expect(form).toContain("onRideSeconds");
    expect(read("src/components/training/BikeSetTimer.tsx")).toContain("onRideSeconds");
  });

  it("says conditioning and cardio once each", () => {
    const facts: DaySummaryFacts = {
      coachId: "ricky",
      coachName: "Ricky",
      coachingStyle: "tough",
      weekday: "Friday",
      dayKind: "train",
      sessions: [
        { kind: "cardio", title: "Conditioning", cues: ["Circuit."], lines: ["Circuit."] },
        { kind: "cardio", title: "Cardio — bike", cues: ["Easy spin."], lines: ["Easy spin."] },
        { kind: "mobility", title: "Mobility — hips", cues: ["Easy range."], lines: ["Hips."] },
      ],
    };
    const script = templateDaySummary(facts);
    expect(script).toMatch(/conditioning, cardio, and mobility/i);
    expect(script).not.toMatch(/cardio, cardio/);
  });

  it("shows the logged names and minutes for a completed day", () => {
    const view = loggedSessionView({
      status: "complete",
      elapsedSeconds: 47 * 60,
      performedAt: new Date("2026-10-19T15:00:00.000Z"),
      createdAt: new Date("2026-10-19T15:00:00.000Z"),
      updatedAt: new Date("2026-10-19T15:47:00.000Z"),
      sets: [
        { exerciseName: "Sit-to-stand", completed: true, reps: 8 },
        { exerciseName: "Sit-to-stand", completed: true, reps: 8 },
        { exerciseName: "Trap-bar DL", completed: true, reps: 5, loadValue: 95 },
        { exerciseName: "Reverse lunge", completed: false, reps: 8 },
      ],
    });
    expect(view).toEqual({ names: ["Sit-to-stand", "Trap-bar DL"], minutes: 47 });

    const performedAt = new Date("2026-10-19T15:00:00.000Z");
    const sets = [
      { exerciseName: "Goblet squat", completed: true, reps: 8 },
      { exerciseName: "Goblet squat", completed: true, reps: 8 },
      { exerciseName: "Goblet squat", completed: true, reps: 8 },
    ];
    for (const status of ["partial", "complete"] as const) {
      expect(
        loggedSessionView({
          status,
          elapsedSeconds: 657,
          performedAt,
          createdAt: performedAt,
          updatedAt: new Date(performedAt.getTime() + 23 * 60 * 1000),
          sets,
        })?.minutes,
      ).toBe(11);
    }
    expect(
      loggedSessionView({
        status: "partial",
        elapsedSeconds: null,
        performedAt,
        createdAt: performedAt,
        updatedAt: new Date(performedAt.getTime() + 23 * 60 * 1000),
        sets,
      })?.minutes,
    ).toBe(23);
    const list = read("src/lib/workouts.ts");
    const resumable = list.slice(
      list.indexOf("export async function listResumableSessionsForUser"),
      list.indexOf("export async function countWorkoutSessionsForUser"),
    );
    expect(resumable).toContain("readTimerFieldsByIds");
    expect(read("src/lib/calendar.ts")).toContain("sessionClockSeconds");
    const detail = read("src/app/(member)/training/[dayId]/page.tsx");
    const card = read("src/components/training/PlanSessionCard.tsx");
    expect(detail).toContain("loggedSessionView");
    expect(detail).toContain("onDay");
    expect(card).toContain("data-logged-session");
    expect(read("src/lib/calendar.ts")).toContain("?on=${dayKey}");
    expect(read("src/lib/calendar.ts")).not.toContain("ticked: 1");
    expect(
      calendarLoggedExercises([
        { name: "Goblet squat", ticked: 3, planned: 4, state: "partial" as const },
        { name: "Row", ticked: 1, planned: 4, state: "partial" as const },
        { name: "Carry", ticked: 0, planned: 3, state: "open" as const },
      ]),
    ).toEqual([
      { name: "Goblet squat", ticked: 3, planned: 4, state: "partial" },
      { name: "Row", ticked: 1, planned: 4, state: "partial" },
    ]);
    expect(
      calendarLoggedHref("/training/day-1", { status: "partial", done: false, dayKey: "2026-10-19" }),
    ).toBe("/training/day-1?on=2026-10-19");
    expect(
      calendarLoggedHref("/training/day-1", { status: "complete", done: false, dayKey: "2026-10-19" }),
    ).toBe("/training/day-1?on=2026-10-19");
    expect(
      calendarLoggedHref("/training/day-1", { status: "draft", done: false, dayKey: "2026-10-19" }),
    ).toBe("/training/day-1");
    expect(calendarLoggedHref("/training/day-1", { status: "draft", done: true, dayKey: "2026-10-19" })).toBe(
      "/training/day-1",
    );
  });

  it("labels the first calendar chip and a month change", () => {
    const zone = "America/Denver";
    const sep28 = zonedCivilToUtc(2026, 9, 28, zone);
    const sep29 = zonedCivilToUtc(2026, 9, 29, zone);
    const sep30 = zonedCivilToUtc(2026, 9, 30, zone);
    const oct1 = zonedCivilToUtc(2026, 10, 1, zone);
    expect(weekChipDateLabel(sep28, "28", 0, undefined, zone)).toBe("Sep 28");
    expect(weekChipDateLabel(sep29, "29", 1, sep28, zone)).toBe("29");
    expect(weekChipDateLabel(oct1, "1", 3, sep30, zone)).toBe("Oct 1");
    expect(read("src/components/training/WeekStrip.tsx")).toContain("data-week-chip-date");
    expect(read("src/components/training/WeekStrip.tsx")).toContain("weekChipDateLabel");
  });

  it("keeps the undo toast, swap confirm, and fuel save on the page", () => {
    expect(REMOVE_TOAST_MS).toBe(8000);
    const sheet = read("src/components/training/ExerciseLibrarySheet.tsx");
    expect(sheet).toContain("data-library-confirm");
    expect(sheet).toContain("max-h-[46dvh]");
    expect(sheet).toContain("scrollIntoView");
    expect(sheet).toContain("[data-swap-scope='session']");
    const action = read("src/app/actions/nutrition.ts");
    expect(action).not.toContain('redirect("/nutrition?celebrate=streak")');
    expect(action).toContain("celebrate: celebrateStreak");
    const board = read("src/components/nutrition/FuelBoard.tsx");
    expect(board).toContain("data-fuel-today");
    expect(board).toContain("data-fuel-log");
    expect(board).toContain("onSaved");
    expect(read("src/components/nutrition/NutritionEntryForm.tsx")).toContain("nutrition-save-estimate");
  });
});
