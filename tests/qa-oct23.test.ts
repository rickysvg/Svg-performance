import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { visibleFinishDose, visibleSessionDose } from "@/lib/finish-plan";
import type { SwapRecord } from "@/lib/exercise-swap";
import { sessionProgress } from "@/lib/session-progress";
import {
  correctionEatenAt,
  createNutritionEntryForUser,
  updateNutritionEntryForUser,
} from "@/lib/nutrition";
import { formatMemberDateTime, parseDateTimeLocal } from "@/lib/timezone";
import {
  WEEK_CAROUSEL_FUTURE_WEEKS,
  WEEK_CAROUSEL_PAST_WEEKS,
  calendarFocusMatches,
  carouselBackfillPastWeeks,
  carouselFocusOffset,
  carouselWeekStrips,
  packCarouselWeeks,
  weekChipHref,
  weekScrollLeft,
} from "@/lib/week-carousel";
import {
  getWeekPlanSwapsForUser,
  writePrunedSwapsIfUnchanged,
} from "@/lib/week-plan-swap-store";
import { parseWeekPlanSwaps, pruneAutoRolledSwaps } from "@/lib/week-plan-swaps";
import { makeUser, resetDatabase } from "./helpers";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function friendly(date: Date, timeZone: string) {
  return formatMemberDateTime(date, timeZone).replace(/[\u202f\u00a0]/g, " ");
}

const prefs = {
  primaryFocus: "mma" as const,
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
};

describe("Oct 23 QA fixes", () => {
  it("formats a meal and a workout in the member zone, including daylight time", () => {
    const denver = "America/Denver";
    const summer = new Date("2026-10-23T13:22:00.000Z");
    expect(friendly(summer, denver)).toBe("Fri, Oct 23, 2026, 7:22 AM");
    expect(friendly(summer, denver)).not.toMatch(/6:22/);
    expect(friendly(summer, denver)).not.toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}/);

    const winter = new Date("2026-01-15T19:22:00.000Z");
    expect(friendly(winter, denver)).toBe("Thu, Jan 15, 2026, 12:22 PM");

    expect(friendly(summer, "Australia/Sydney")).toBe("Sat, Oct 24, 2026, 12:22 AM");

    expect(parseDateTimeLocal("2026-10-23T07:22", denver)?.toISOString()).toBe(
      "2026-10-23T13:22:00.000Z",
    );
    expect(parseDateTimeLocal("2026-01-15T12:22", denver)?.toISOString()).toBe(
      "2026-01-15T19:22:00.000Z",
    );

    const history = read("src/app/(member)/training/history/page.tsx");
    const nutrition = read("src/components/nutrition/FuelBoard.tsx");
    const nutritionPage = read("src/app/(member)/nutrition/page.tsx");
    expect(history).toContain("formatMemberDateTime");
    expect(nutrition).toContain("formatMemberDateTime");
    expect(history).not.toContain("toLocaleString");
    expect(nutrition).not.toContain("toLocaleString");
    expect(nutritionPage).not.toContain("toLocaleString");
  });

  it("keeps the original eaten time when a correction is saved, and shows a spinner", () => {
    const form = read("src/components/nutrition/NutritionEntryForm.tsx");
    const action = read("src/lib/nutrition.ts");
    expect(action).toContain("correctionEatenAt");
    expect(action).toContain("formatDateTimeLocal(existing, timeZone) === formatDateTimeLocal(submitted, timeZone)");
    expect(form).toContain("data-nutrition-spinner");
    expect(form).toContain("disabled={pending}");
    expect(form).toContain("state.saved");
    expect(form).toContain("formatDateTimeLocal");
    expect(form).not.toContain("getHours(");
  });

  it("drops a swapped exercise from the finish dose after it is removed", () => {
    const names = [
      "Goblet squat",
      "Romanian deadlift",
      "Walking lunge",
      "Kettlebell swing",
      "Calf raise",
      "Plank",
      "Dead bug",
      "Side plank",
    ];
    const swap: SwapRecord = {
      originalName: "Kettlebell swing",
      replacementName: "Cable pull-through",
      scope: "session",
      workoutSessionId: "sess",
      blockKey: "2026-w",
      sets: 4,
      reps: "10",
      loadText: "",
      restSeconds: 60,
      logMode: "load_reps",
      notes: "",
      retiredNames: [],
    };
    const visible = visibleFinishDose({
      exercises: names.map((name) => ({ name, sets: 4 })),
      swaps: [swap],
      removals: [
        {
          originalName: "Kettlebell swing",
          exerciseName: "Cable pull-through",
          workoutSessionId: "sess",
        },
      ],
      sessionId: "sess",
      blockKey: "2026-w",
      catalogDose: 32,
    });
    expect(visible.dose).toBe(28);
    expect(visible.names).toHaveLength(7);
    expect(visible.names).not.toContain("Kettlebell swing");
    expect(visible.names).not.toContain("Cable pull-through");

    const progress = sessionProgress(
      {
        status: "partial",
        programDayId: "day",
        plannedSetCount: 28,
        sets: [
          { exerciseName: "Goblet squat", completed: true, reps: 8, loadValue: 24 },
          { exerciseName: "Goblet squat", completed: true, reps: 8, loadValue: 24 },
        ],
      },
      { dose: visible.dose, names: visible.names, exercises: visible.exercises },
    );
    expect(progress.text).toBe("2/28 sets · Partial");
    expect(progress.rows).toHaveLength(7);
    expect(progress.rows.map((row) => row.name)).not.toContain("Kettlebell swing");
    expect(progress.rows.map((row) => row.name)).not.toContain("Cable pull-through");
    expect(read("src/app/(member)/training/log/[sessionId]/done/page.tsx")).toContain(
      "visibleFinishDose",
    );
    expect(visibleSessionDose({
      exercises: names.map((name) => ({ name, sets: 4 })),
      swaps: [swap],
      removals: [
        {
          originalName: "Kettlebell swing",
          exerciseName: "Cable pull-through",
          workoutSessionId: "sess",
        },
      ],
      sessionId: "sess",
      blockKey: "2026-w",
      catalogDose: 32,
    })).toEqual(visible);

    const fewerSets = visibleSessionDose({
      exercises: names.map((name) => ({ name, sets: 4 })),
      swaps: [{ ...swap, sets: 3 }],
      removals: [
        {
          originalName: "Kettlebell swing",
          exerciseName: "Cable pull-through",
          workoutSessionId: "sess",
        },
      ],
      sessionId: "sess",
      blockKey: "2026-w",
      catalogDose: 32,
    });
    expect(fewerSets.dose).toBe(28);
    expect(fewerSets.names).not.toContain("Kettlebell swing");
    expect(read("src/lib/finish-plan.ts")).toContain("return visibleSessionDose(input)");
    expect(read("src/lib/calendar.ts")).toContain("visibleDoseForSession");
    expect(read("src/app/(member)/training/history/page.tsx")).toContain("visibleDoseForSession");
    expect(read("src/lib/home.ts")).toContain("visibleDoseForSession");
    expect(read("src/lib/today-start.ts")).toContain("visibleDoseForSession");
    expect(read("src/app/(member)/training/page.tsx")).toContain("withVisiblePlanExercises");

    const token = "timer#bw:c.15.15.8.0.0.2.60";
    const interval = {
      exerciseName: "Assault bike intervals",
      completed: true,
      reps: null,
      loadValue: null,
      durationSeconds: 15,
      prescriptionKey: token,
      logMode: "timed_round" as const,
    };
    const sixteenSets = Array.from({ length: 16 }, () => interval);
    const intervalDose = visibleSessionDose({
      exercises: [{ name: "Assault bike intervals", sets: 1 }],
      swaps: [],
      removals: [],
      sessionId: "bike",
      blockKey: "2026-w",
      catalogDose: 1,
      loggedSets: sixteenSets,
    });
    expect(intervalDose.dose).toBe(16);
    expect(intervalDose.exercises[0]?.sets).toBe(16);
    expect(
      sessionProgress(
        { status: "complete", programDayId: "bike", plannedSetCount: 1, sets: sixteenSets },
        { dose: intervalDose.dose, names: intervalDose.names, exercises: intervalDose.exercises },
      ).text,
    ).toBe("16/16 rounds · Done");
    expect(
      sessionProgress(
        {
          status: "partial",
          programDayId: "bike",
          plannedSetCount: 1,
          sets: sixteenSets.slice(0, 12),
        },
        { dose: intervalDose.dose, names: intervalDose.names, exercises: intervalDose.exercises },
      ).text,
    ).toBe("12/16 rounds · Partial");

    const bag = {
      exerciseName: "Heavy bag rounds",
      completed: true,
      reps: null,
      loadValue: null,
      durationSeconds: 180,
      prescriptionKey: "round:bag:60",
      logMode: "timed_round" as const,
    };
    const squat = { exerciseName: "Squat", completed: true, reps: 5, loadValue: 135, durationSeconds: null };
    const mixedExercises = [
      { name: "Squat", sets: 5 },
      { name: "Heavy bag rounds", sets: 3 },
    ];
    const mixedDose = visibleSessionDose({
      exercises: mixedExercises,
      swaps: [],
      removals: [],
      sessionId: "mixed",
      blockKey: "2026-w",
      catalogDose: 8,
      loggedSets: [...Array.from({ length: 5 }, () => squat), ...Array.from({ length: 3 }, () => bag)],
    });
    expect(mixedDose.dose).toBe(8);
    expect(
      sessionProgress(
        {
          status: "complete",
          programDayId: "mixed",
          plannedSetCount: 8,
          sets: [...Array.from({ length: 5 }, () => squat), ...Array.from({ length: 3 }, () => bag)],
        },
        { dose: mixedDose.dose, names: mixedDose.names, exercises: mixedDose.exercises },
      ).text,
    ).toBe("5/5 sets · 3/3 rounds · Done");

    const shadowSets = [1, 2].map((round) => ({
      exerciseName: `Shadowbox round ${round} — empty hands`,
      completed: true,
      reps: null,
      loadValue: null,
      durationSeconds: 180,
    }));
    expect(
      sessionProgress({ status: "complete", plannedSetCount: 2, sets: shadowSets }, visibleSessionDose({
        exercises: [],
        swaps: [],
        removals: [],
        sessionId: "shadow",
        blockKey: "2026-w",
        loggedSets: shadowSets,
      })).text,
    ).toBe("2/2 rounds · Done");
  });

  it("lines the focused week up with its header and day links, and keeps the carousel", () => {
    const zone = "America/Denver";
    const now = new Date("2026-10-23T15:22:00.000Z");
    expect(WEEK_CAROUSEL_PAST_WEEKS).toBe(2);
    expect(WEEK_CAROUSEL_FUTURE_WEEKS).toBe(2);
    const past = carouselBackfillPastWeeks(now, zone);
    expect(past).toBeGreaterThan(WEEK_CAROUSEL_PAST_WEEKS);
    const built = carouselWeekStrips(prefs, now, zone, now, [], past);
    const weeks = packCarouselWeeks(built.anchors, built.days);
    expect(weeks[0]?.weekStart).toBe("2026-09-21");
    expect(weekChipHref(weeks[0]!.days[0]!, "/training/calendar")).toBe(
      "/training/calendar?day=2026-09-21",
    );

    const focus = carouselFocusOffset(weeks);
    const focusIndex = weeks.findIndex((week) => week.offset === focus);
    const focused = weeks[focusIndex]!;
    expect(focusIndex).toBeGreaterThan(0);
    expect(focused.rangeLabel).toBe("Oct 19 – 25");
    expect(focused.days.map((day) => day.dayParam)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(focused.days.map((day) => `${day.short} ${day.dateLabel}`)).toEqual([
      "Mon 19",
      "Tue 20",
      "Wed 21",
      "Thu 22",
      "Fri 23",
      "Sat 24",
      "Sun 25",
    ]);
    expect(weekChipHref(focused.days[0]!, "/training/calendar")).toBe(
      "/training/calendar?day=2026-10-19",
    );
    expect(focused.days.find((day) => day.isToday)?.dayParam).toBe("2026-10-23");
    expect(weekScrollLeft(focusIndex, 390)).toBe(focusIndex * 390);
    expect(weekScrollLeft(focusIndex, 0)).toBe(0);

    const lastWeek = weeks.find((week) => week.offset === -1);
    expect(lastWeek?.days.find((day) => day.short === "Sat")?.dayParam).toBe("2026-10-17");
    expect(calendarFocusMatches("2026-10-16", "2026-10-17")).toBe(false);
    expect(calendarFocusMatches("2026-10-17", "2026-10-17")).toBe(true);

    const strip = read("src/components/training/WeekStrip.tsx");
    const follow = read("src/components/training/CalendarWeekFollow.tsx");
    const calendar = read("src/app/(member)/training/calendar/page.tsx");
    expect(strip).toContain("weekScrollLeft");
    expect(strip).toContain("el.scrollLeft = left");
    expect(strip).toContain("lockChipNavigation={Boolean(onDayChange)}");
    expect(follow).toContain("history.replaceState");
    expect(follow).toContain('params.set("week"');
    expect(follow).toContain('params.set("day"');
    expect(follow).toContain("CalendarFocusGate");
    expect(follow).toContain("onDayChange");
    expect(calendar).toContain("CalendarFocusGate");
    expect(calendar).toContain("initialDay={dayParam}");
    expect(calendar).toContain("carouselBackfillPastWeeks");
  });

  it("lets Undo run while a refresh is in flight, and leaves the summary text-only", () => {
    const move = read("src/components/training/WorkoutMove.tsx");
    expect(move).not.toContain("if (!toast || pending) return");
    expect(move).toContain("if (!toast || undoing) return");
    expect(move).not.toContain("router.refresh(");
    expect(move).toContain("data-plan-pending");
    expect(move).toContain("saving || undoing");
    expect(move).not.toContain("useTransition");
    expect(move).toContain("placementAfterMoveBack");
    expect(move).toContain("submitPlanIntent");
    expect(move).toContain("Saving…");
    expect(move).not.toContain("moveWorkoutAction");
    const outbox = read("src/lib/plan-intent-outbox.ts");
    expect(outbox).toContain("keepalive: true");
    expect(outbox).toContain("sendBeacon");
    expect(outbox).toContain("pagehide");
    const moveBack = read("src/components/training/MoveBackButton.tsx");
    expect(moveBack).toContain("moveHome");
    expect(moveBack).not.toContain("useTransition");
    expect(read("src/app/actions/week-plan.ts")).toContain("revalidatePath");
    expect(read("src/lib/week-plan-swap-store.ts")).toContain("writePrunedSwapsIfUnchanged");
    expect(read("src/components/home/SummaryReader.tsx")).toContain(
      "if (!coachVoiceEnabled()) return null",
    );
    const frame = read("src/components/MemberFrame.tsx");
    expect(frame).toContain("min-w-0");
    expect(frame).toContain("pb-36");
  });
});

describe("Oct 23 saved rows", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps an untouched When minute and saves an explicit change", async () => {
    const denver = "America/Denver";
    const existing = new Date("2026-10-23T16:43:12.000Z");
    const sameMinute = new Date("2026-10-23T16:43:00.000Z");
    expect(correctionEatenAt(existing, sameMinute, denver).toISOString()).toBe(existing.toISOString());
    const eight = parseDateTimeLocal("2026-10-23T08:00", denver);
    expect(eight?.toISOString()).toBe("2026-10-23T14:00:00.000Z");
    expect(correctionEatenAt(existing, eight!, denver).toISOString()).toBe("2026-10-23T14:00:00.000Z");
    const winter = new Date("2026-01-15T19:22:45.000Z");
    expect(correctionEatenAt(winter, new Date("2026-01-15T19:22:00.000Z"), denver).toISOString()).toBe(
      winter.toISOString(),
    );

    const user = await makeUser("qa-oct23-food@example.com");
    const eatenAt = new Date("2026-10-23T16:43:12.000Z");
    const entry = await createNutritionEntryForUser(user.id, {
      name: "Rice cake",
      mealType: "breakfast",
      servings: 1,
      servingLabel: "cake",
      calories: 10,
      proteinG: 0,
      carbsG: 2,
      fatG: 0,
      eatenAt,
    });
    const untouched = await updateNutritionEntryForUser(
      entry.id,
      user.id,
      {
        name: "Rice cake",
        mealType: "breakfast",
        servings: 1,
        servingLabel: "cake",
        calories: 15,
        proteinG: 0,
        carbsG: 2,
        fatG: 0,
        eatenAt: sameMinute,
      },
      denver,
    );
    expect(untouched.calories).toBe(15);
    expect(untouched.eatenAt.toISOString()).toBe(eatenAt.toISOString());

    const moved = await updateNutritionEntryForUser(
      entry.id,
      user.id,
      {
        name: "Rice cake",
        mealType: "breakfast",
        servings: 1,
        servingLabel: "cake",
        calories: 15,
        proteinG: 0,
        carbsG: 2,
        fatG: 0,
        eatenAt: eight!,
      },
      denver,
    );
    expect(moved.eatenAt.toISOString()).toBe("2026-10-23T14:00:00.000Z");
  });

  it("does not let a stale prune write replace an Undo", async () => {
    const user = await makeUser("qa-oct23-undo@example.com");
    const moved = JSON.stringify([
      {
        weekStart: "2026-10-19",
        sourceByDay: { Saturday: "Friday" },
        sessionDays: { "Friday:strength:1": "Saturday" },
      },
    ]);
    const pruned = JSON.stringify(pruneAutoRolledSwaps(parseWeekPlanSwaps(moved)));
    expect(pruned).not.toBe(moved);

    await prisma.profile.update({
      where: { userId: user.id },
      data: { weekPlanSwapsJson: "[]" },
    });
    const stale = await writePrunedSwapsIfUnchanged(user.id, moved, pruned);
    expect(stale.count).toBe(0);
    const home = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { weekPlanSwapsJson: true },
    });
    expect(home?.weekPlanSwapsJson).toBe("[]");

    await prisma.profile.update({
      where: { userId: user.id },
      data: { weekPlanSwapsJson: moved },
    });
    const fresh = await writePrunedSwapsIfUnchanged(user.id, moved, pruned);
    expect(fresh.count).toBe(1);
    const kept = await getWeekPlanSwapsForUser(user.id);
    expect(kept[0]?.sessionDays?.["Friday:strength:1"]).toBeUndefined();
    expect(kept[0]?.sourceByDay.Saturday).toBe("Friday");
    const again = await getWeekPlanSwapsForUser(user.id);
    expect(JSON.stringify(again)).toBe(JSON.stringify(kept));
  });
});
