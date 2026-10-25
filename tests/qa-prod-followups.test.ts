import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applySessionPlacements } from "@/lib/calendar-placements";
import { templateDaySummary, type DaySummaryFacts } from "@/lib/coach/day-summary";
import { loggedSessionView } from "@/lib/logged-session-view";
import { zonedCivilToUtc } from "@/lib/timezone";
import { weekChipDateLabel } from "@/lib/week-plan";
import { workoutCompleteTiles } from "@/lib/workout-complete";
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
    const detail = read("src/app/(member)/training/[dayId]/page.tsx");
    const card = read("src/components/training/PlanSessionCard.tsx");
    expect(detail).toContain("loggedSessionView");
    expect(detail).toContain("onDay");
    expect(card).toContain("data-logged-session");
    expect(read("src/lib/calendar.ts")).toContain("?on=${dayKey}");
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
