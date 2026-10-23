import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDayParam } from "@/lib/home";
import {
  WEEK_CAROUSEL_FUTURE_WEEKS,
  WEEK_CAROUSEL_PAST_WEEKS,
  carouselBackfillPastWeeks,
  carouselFocusOffset,
  carouselLoggedRange,
  carouselWeekAnchors,
  carouselWeekStrips,
  packCarouselWeeks,
  weekCarouselLabel,
  nextSelectedDay,
  trainDayHref,
  weekChipHref,
  weekRangeLabel,
} from "@/lib/week-carousel";
import { chipMarkForDay } from "@/lib/chip-mark";
import {
  completedProgramDayIdsForChip,
  completedSessionIdsByLocalDay,
  partialLocalDayKeys,
  scaledPlanByProgramDay,
} from "@/lib/chip-completion";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE, addZonedDays, dayKey, mondayOfZoned, zonedParts } from "@/lib/timezone";
import {
  completedLocalDayKeys,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import {
  calendarFocusStatusSuffix,
  formatCalendarHeading,
  calendarPlanDoses,
  calendarScaledCatalog,
  getCalendarSchedule,
  subtitleCountsAsMissed,
  visibleCalendarExercises,
} from "@/lib/calendar";
import { exerciseSetProgress, prescribedSetTotal, sessionCountsAsPlannedCompletion } from "@/lib/logged-work";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { planWeekIndex, weekStrip } from "@/lib/week-plan";
import { makeUser, resetDatabase } from "./helpers";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const prefs = { primaryFocus: "mma" as const, weeklyAvailability: ["Monday", "Wednesday", "Friday"] };

describe("week day carousel", () => {
  it("labels two weeks back through two weeks ahead in the member zone", () => {
    expect(WEEK_CAROUSEL_PAST_WEEKS).toBe(2);
    expect(WEEK_CAROUSEL_FUTURE_WEEKS).toBe(2);
    expect(weekCarouselLabel(-2)).toBe("2 weeks ago");
    expect(weekCarouselLabel(-1)).toBe("Last week");
    expect(weekCarouselLabel(0)).toBe("This week");
    expect(weekCarouselLabel(1)).toBe("Next week");
    expect(weekCarouselLabel(2)).toBe("In 2 weeks");

    const now = new Date("2026-10-20T06:24:00.000Z");
    const zone = "America/Denver";
    const anchors = carouselWeekAnchors(now, zone);
    expect(anchors.map((anchor) => anchor.offset)).toEqual([-2, -1, 0, 1, 2]);
    expect(anchors.map((anchor) => anchor.label)).toEqual([
      "2 weeks ago",
      "Last week",
      "This week",
      "Next week",
      "In 2 weeks",
    ]);
    expect(anchors.map((anchor) => anchor.weekStart)).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
    expect(anchors.map((anchor) => anchor.rangeLabel)).toEqual([
      "Oct 5 – 11",
      "Oct 12 – 18",
      "Oct 19 – 25",
      "Oct 26 – Nov 1",
      "Nov 2 – 8",
    ]);
    expect(weekRangeLabel(mondayOfZoned(now, zone), zone)).toBe("Oct 19 – 25");
  });

  it("pairs weekday chips with Oct 19–25 in America/Denver and UTC", () => {
    const friday = new Date("2026-10-23T18:00:00.000Z");
    const labels = ["Mon 19", "Tue 20", "Wed 21", "Thu 22", "Fri 23", "Sat 24", "Sun 25"];
    const days = [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];
    const zones = [
      { zone: "America/Denver", mondayMidnight: new Date("2026-10-19T06:00:00.000Z") },
      { zone: "UTC", mondayMidnight: new Date("2026-10-19T00:00:00.000Z") },
    ];
    for (const { zone, mondayMidnight } of zones) {
      const strip = weekStrip(prefs, friday, zone);
      expect(weekRangeLabel(mondayOfZoned(friday, zone), zone)).toBe("Oct 19 – 25");
      expect(strip.map((day) => `${day.short} ${day.dateLabel}`)).toEqual(labels);
      expect(strip.map((day) => day.dayParam)).toEqual(days);
      expect(strip.map((day) => day.weekday)).toEqual([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]);
      for (const day of strip) {
        const parts = zonedParts(day.date, zone);
        expect(parts.weekday).toBe(day.weekday);
        expect(String(parts.day)).toBe(day.dateLabel);
      }
      expect(formatCalendarHeading(strip[0]!.date, friday, zone)).toBe("Monday, October 19th");
      expect(formatCalendarHeading(strip[2]!.date, friday, zone)).toBe("Wednesday, October 21st");
      expect(strip.find((day) => day.short === "Mon")?.dateLabel).toBe("19");
      expect(strip.find((day) => day.short === "Wed")?.dateLabel).toBe("21");

      const atMonday = weekStrip(prefs, mondayMidnight, zone);
      expect(weekRangeLabel(mondayOfZoned(mondayMidnight, zone), zone)).toBe("Oct 19 – 25");
      expect(atMonday.map((day) => `${day.short} ${day.dateLabel}`)).toEqual(labels);
      expect(formatCalendarHeading(atMonday[0]!.date, mondayMidnight, zone)).toBe(
        "Today · Monday, October 19th",
      );
      expect(formatCalendarHeading(atMonday[2]!.date, mondayMidnight, zone)).toBe(
        "Wednesday, October 21st",
      );
    }
  });

  it("uses the member timezone when the UTC date is already the next day", () => {
    const instant = new Date("2026-10-19T06:00:00.000Z");
    expect(carouselWeekAnchors(instant, "America/Denver")[2]?.weekStart).toBe("2026-10-19");
    expect(carouselWeekAnchors(instant, "America/Los_Angeles")[2]?.weekStart).toBe("2026-10-12");
    expect(carouselWeekAnchors(instant, "Pacific/Auckland")[2]?.weekStart).toBe("2026-10-19");
  });

  it("marks today once, past days as past, and future days with a planned summary", () => {
    const now = new Date("2026-10-20T06:24:00.000Z");
    const zone = "America/Denver";
    const built = carouselWeekStrips(prefs, now, zone, now, []);
    expect(built.days).toHaveLength(35);
    expect(built.days.filter((day) => day.isToday)).toHaveLength(1);
    expect(built.days.find((day) => day.isToday)?.dayParam).toBe("2026-10-20");
    expect(built.days.filter((day) => day.dayParam < "2026-10-20").every((day) => day.isPast)).toBe(
      true,
    );
    expect(
      built.days
        .filter((day) => day.dayParam > "2026-10-20")
        .every((day) => !day.isPast && !day.isToday),
    ).toBe(true);
    expect(
      built.days
        .filter((day) => day.dayParam > "2026-10-20" && day.active)
        .every((day) => day.summary.length > 0),
    ).toBe(true);

    const weeks = packCarouselWeeks(built.anchors, built.days);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(carouselFocusOffset(weeks)).toBe(0);

    const later = carouselWeekStrips(
      prefs,
      now,
      zone,
      new Date("2026-11-02T18:00:00.000Z"),
      [],
    );
    expect(carouselFocusOffset(packCarouselWeeks(later.anchors, later.days))).toBe(2);
    expect(later.days.find((day) => day.isSelected)?.dayParam).toBe("2026-11-02");
    expect(later.days.find((day) => day.isToday)?.dayParam).toBe("2026-10-20");
  });

  it("covers the logged-day window from the oldest Monday through the Monday after the last week", () => {
    const now = new Date("2026-10-20T06:24:00.000Z");
    const zone = "America/Denver";
    const range = carouselLoggedRange(now, zone);
    expect(formatDayParam(range.from, zone)).toBe("2026-10-05");
    expect(formatDayParam(range.to, zone)).toBe("2026-11-09");
  });

  it("reaches a day 30 days back from the calendar strip and its URL", () => {
    const now = new Date("2026-10-23T18:00:00.000Z");
    const zone = "America/Denver";
    const past = carouselBackfillPastWeeks(now, zone);
    const built = carouselWeekStrips(prefs, now, zone, undefined, [], past);
    const earliest = "2026-09-23";
    expect(past).toBeGreaterThan(WEEK_CAROUSEL_PAST_WEEKS);
    expect(built.days.some((day) => day.dayParam === earliest)).toBe(true);
    expect(built.anchors[0]!.weekStart <= earliest).toBe(true);
    expect(
      nextSelectedDay({
        type: "url",
        dayParam: earliest,
        known: built.days.map((day) => day.dayParam),
        fallback: "2026-10-23",
      }),
    ).toBe(earliest);
    const window = carouselLoggedRange(now, zone, past);
    expect(formatDayParam(window.from, zone) <= earliest).toBe(true);
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("carouselBackfillPastWeeks");
  });

  it("drops unlogged plan rows from a done calendar card", () => {
    const rows = exerciseSetProgress(
      [
        { name: "Bench press", sets: 2 },
        { name: "Step-out and stick", sets: 4 },
      ],
      [
        { exerciseName: "Bench press", completed: true, reps: 8, loadValue: 95, durationSeconds: null },
        { exerciseName: "Bench press", completed: true, reps: 8, loadValue: 95, durationSeconds: null },
      ],
    );
    expect(rows.find((row) => row.name === "Step-out and stick")).toMatchObject({
      ticked: 0,
      planned: 4,
      state: "open",
    });
    expect(visibleCalendarExercises(rows, true).map((row) => row.name)).toEqual(["Bench press"]);
    expect(visibleCalendarExercises(rows, false).some((row) => row.name === "Step-out and stick")).toBe(true);
  });

  it("snaps the existing chips on Train and Calendar without touching completion logic", () => {
    const strip = read("src/components/training/WeekStrip.tsx");
    const css = read("src/app/globals.css");
    const train = read("src/app/(member)/training/page.tsx");
    const calendar = read("src/app/(member)/training/calendar/page.tsx");

    expect(strip).toContain("data-week-carousel");
    expect(strip).toContain("data-week-scroller");
    expect(strip).toContain('data-testid={`week-chip-${day.dayParam}`}');
    expect(strip).toContain('aria-label="Previous week"');
    expect(strip).toContain('aria-label="Next week"');
    expect(strip).toContain('aria-label="Jump to today"');
    expect(strip).toContain('data-testid="jump-today"');
    expect(strip).toContain('event.key === "ArrowLeft"');
    expect(strip).toContain('event.key === "ArrowRight"');
    expect(strip).toContain("data-week-today");
    expect(strip).toContain("data-week-missed");
    expect(strip).toContain("data-week-complete");
    expect(strip).toContain("data-week-partial");
    expect(strip).toContain("inert={index === activeIndex ? undefined : true}");
    expect(strip).toContain("weekChipHref");
    expect(strip).toContain("data-week-legend");
    expect(strip).toContain("bg-signal");
    expect(css).toContain("scroll-snap-type: x mandatory");
    expect(css).toContain("overscroll-behavior-x: contain");
    expect(css).toContain("contain: inline-size paint");
    expect(css).toContain("[data-week-carousel]");

    expect(train).toContain("carouselWeekStrips");
    expect(train).toContain("carouselLoggedRange");
    expect(train).toContain("focusOffset");
    expect(train).toContain("todayHref");
    expect(train).toContain("<WeekStrip");
    expect(train).toContain("dateLabel={planDateLabel}");
    expect(train).toContain("chipMarksAfterPlans");
    expect(train).toContain("completedSessionIdsByLocalDay");
    expect(train).toContain("<TrainWeekFollow");
    expect(train).toContain("data-train-panel");
    expect(train).not.toContain("rearrange");
    expect(train).not.toContain("This week");
    expect(read("src/components/training/TrainWeekFollow.tsx")).toContain("history.replaceState");
    expect(read("src/components/training/TrainWeekFollow.tsx")).toContain("trainDayHref");
    expect(strip).toContain('type: "chip"');
    expect(strip).toContain('type: "today"');
    expect(strip).toContain("jumpingToToday");
    expect(strip).toContain("router.push(todayHref)");

    expect(calendar).toContain("carouselWeekStrips");
    expect(calendar).toContain("withBikeChipLogHrefs");
    expect(calendar).toContain("rearrange");
    expect(calendar).toContain("focusOffset");
    expect(calendar).toContain("todayHref");
    expect(calendar).toContain("data-calendar-week-title");
    expect(calendar).toContain("weekLabel={week.label}");
    expect(calendar).toContain("chipMarksAfterPlans");
    expect(read("src/components/training/CalendarWeekFollow.tsx")).toContain("history.replaceState");
    expect(read("src/components/training/CalendarWeekFollow.tsx")).toContain('params.set("week"');
    expect(read("src/components/training/CalendarWeekFollow.tsx")).toContain('params.set("day"');
    expect(read("src/lib/chip-completion.ts")).toContain("sessionCountsAsPlannedCompletion");
    expect(read("src/lib/chip-completion.ts")).toContain("plannedSetCount: true");
    expect(read("src/lib/chip-completion.ts")).toContain("prescribedSetTotal");
    expect(read("src/lib/chip-completion.ts")).toContain(
      "exercises: { select: { name: true, sets: true } }",
    );
    expect(read("src/lib/chip-completion.ts")).not.toContain("completionSessionSelect");
    expect(read("src/lib/chip-completion.ts")).not.toContain("WorkoutSessionScalarFieldEnum");
    expect(read("src/lib/logged-work.ts")).not.toContain("chipMarkForDay");
    expect(calendar).not.toContain("data-week-nav");

    for (const file of [
      "src/lib/calendar.ts",
      "src/lib/logged-work.ts",
      "src/lib/workouts.ts",
    ]) {
      expect(read(file)).not.toContain("data-week-carousel");
      expect(read(file)).not.toContain("carouselWeekStrips");
    }
  });

  it("checks a day only when every planned session is complete", () => {
    expect(
      chipMarkForDay({
        plannedSessionIds: ["bag", "lift"],
        completedSessionIds: ["bag", "lift"],
        dayLogged: true,
      }),
    ).toBe("complete");
    expect(
      chipMarkForDay({
        plannedSessionIds: ["bag", "lift"],
        completedSessionIds: ["bag"],
        dayLogged: true,
      }),
    ).toBe("partial");
    expect(
      chipMarkForDay({
        plannedSessionIds: ["bag"],
        completedSessionIds: [],
        dayLogged: false,
      }),
    ).toBe("none");
    expect(
      chipMarkForDay({
        plannedSessionIds: ["lift"],
        completedSessionIds: [],
        dayLogged: false,
        partial: true,
      }),
    ).toBe("partial");
    expect(
      chipMarkForDay({
        plannedSessionIds: ["bike"],
        completedSessionIds: ["bike"],
        dayLogged: true,
      }),
    ).toBe("complete");
  });

  it("moves the highlight on a chip tap and keeps Today from rewriting to yesterday", () => {
    expect(nextSelectedDay({ type: "chip", dayParam: "2026-10-23" })).toBe("2026-10-23");
    expect(nextSelectedDay({ type: "prop", dayParam: "2026-10-22" })).toBe("2026-10-22");
    expect(
      nextSelectedDay({
        type: "url",
        dayParam: "2026-10-22",
        known: ["2026-10-21", "2026-10-22"],
        fallback: "2026-10-21",
      }),
    ).toBe("2026-10-22");

    const allDays = [
      { weekday: "Wednesday", dayParam: "2026-10-07" },
      { weekday: "Wednesday", dayParam: "2026-10-21" },
      { weekday: "Thursday", dayParam: "2026-10-22" },
    ];
    const thisWeek = [
      { weekday: "Wednesday", dayParam: "2026-10-21" },
      { weekday: "Thursday", dayParam: "2026-10-22" },
    ];
    expect(
      nextSelectedDay({
        type: "snap",
        weekDays: thisWeek,
        previousDayParam: "2026-10-07",
        allDays,
        todayParam: "2026-10-22",
        jumpingToToday: true,
      }),
    ).toBe("2026-10-22");
    expect(
      nextSelectedDay({
        type: "today",
        todayParam: "2026-10-22",
      }),
    ).toBe("2026-10-22");
  });

  it("points a Train swipe at the same weekday and that day's plan URL", () => {
    const allDays = [
      { weekday: "Thursday", dayParam: "2026-10-15" },
      { weekday: "Thursday", dayParam: "2026-10-22" },
    ];
    const lastWeek = [{ weekday: "Thursday", dayParam: "2026-10-15" }];
    const dayParam = nextSelectedDay({
      type: "snap",
      weekDays: lastWeek,
      previousDayParam: "2026-10-22",
      allDays,
      todayParam: "2026-10-22",
      jumpingToToday: false,
    });
    expect(dayParam).toBe("2026-10-15");
    expect(trainDayHref("/training", "", dayParam, null)).toBe("/training?day=2026-10-15");
    expect(trainDayHref("/training", "level=beginner", dayParam, "beginner")).toBe(
      "/training?level=beginner&day=2026-10-15",
    );
  });

  it("shows a half ring when one session on a two-session day is short", () => {
    const names = new Map<string, string[]>([
      ["lift", ["Back squat"]],
      ["bag", ["Jab"]],
    ]);
    const rows = [
      {
        status: "complete",
        programDayId: "lift",
        plannedSetCount: 4,
        day: "2026-10-22",
        sets: [1, 2, 3, 4].map(() => ({
          completed: true,
          reps: 5,
          exerciseName: "Back squat",
        })),
      },
      {
        status: "complete",
        programDayId: "bag",
        plannedSetCount: 4,
        day: "2026-10-22",
        sets: [{ completed: true, reps: 5, exerciseName: "Push-up" }],
      },
    ];
    const ids = completedProgramDayIdsForChip(rows, names, "2026-10-22");
    expect(ids).toEqual(["lift"]);
    expect(
      chipMarkForDay({
        plannedSessionIds: ["lift", "bag"],
        completedSessionIds: ids,
        dayLogged: true,
      }),
    ).toBe("partial");
    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain('mark === "partial"');
    expect(strip).toContain("data-week-partial");
    expect(strip).toContain("clip-path:inset(0_50%_0_0)");
  });

  it("leaves a short legacy row off the chip when the stored count is missing", () => {
    const names = new Map<string, string[]>([["bag", ["Jab"]]]);
    const ids = completedProgramDayIdsForChip(
      [
        {
          status: "complete",
          programDayId: "bag",
          plannedSetCount: null,
          prescribedCount: 4,
          day: "2026-10-22",
          sets: [1, 2].map(() => ({
            completed: true,
            reps: 5,
            exerciseName: "Jab",
          })),
        },
      ],
      names,
      "2026-10-22",
    );
    expect(ids).toEqual([]);
    expect(
      chipMarkForDay({
        plannedSessionIds: ["bag"],
        completedSessionIds: ids,
        dayLogged: false,
      }),
    ).not.toBe("complete");
  });

  it("follows Today into the visible week without rewriting the day URL", () => {
    const calendar = read("src/components/training/CalendarWeekFollow.tsx");
    const train = read("src/components/training/TrainWeekFollow.tsx");
    const strip = read("src/components/training/WeekStrip.tsx");
    for (const source of [calendar, train]) {
      expect(source).toContain("initialWeekStart !== trackedWeek");
      expect(source).toContain("setWeekStart(initialWeekStart)");
      expect(source).toContain("if (week.preserveUrl) return;");
    }
    expect(strip).toContain("preserveUrl: jumping");
    expect(strip).not.toContain("if (jumping) return;");
  });

  it("agrees with completedLocalDayKeys on a short legacy row", async () => {
    await resetDatabase();
    const user = await makeUser("chip-legacy-short@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const anchor = new Date(2026, 8, 22, 10, 0, 0);
    const schedule = await getCalendarSchedule(user.id, anchor);
    let picked: {
      session: Awaited<ReturnType<typeof startWorkoutFromDay>>;
      performedAt: Date;
      programDayId: string;
    } | null = null;
    for (const day of schedule.days) {
      for (const activity of day.activities) {
        if (activity.kind !== "workout" || !activity.programDayId) continue;
        const started = await startWorkoutFromDay({
          userId: user.id,
          programDayId: activity.programDayId,
          preferredUnits: "lb",
        });
        if ((started.plannedSetCount ?? 0) > 2) {
          picked = {
            session: started,
            performedAt: day.date,
            programDayId: activity.programDayId,
          };
          break;
        }
        await prisma.workoutSession.delete({ where: { id: started.id } });
      }
      if (picked) break;
    }
    expect(picked).toBeTruthy();
    const planned = picked!.session.sets.filter((set) => set.logMode === "load_reps").slice(0, 2);
    const sets =
      planned.length === 2
        ? planned
        : picked!.session.sets.slice(0, 2);
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: picked!.session.id,
      title: picked!.session.title,
      performedAt: picked!.performedAt,
      notes: "",
      status: "complete",
      sets: sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "load_reps" || !set.logMode ? 8 : null,
        loadValue: set.logMode === "load_reps" || !set.logMode ? 40 : null,
        loadUnit: "lb" as const,
        durationSeconds: set.logMode === "load_reps" || !set.logMode ? null : 60,
        completed: true,
      })),
    });
    await prisma.workoutSession.update({
      where: { id: picked!.session.id },
      data: { plannedSetCount: null },
    });
    const stored = await prisma.workoutSession.findUnique({
      where: { id: picked!.session.id },
      select: {
        plannedSetCount: true,
        sets: { select: { completed: true } },
        programDay: { select: { exercises: { select: { sets: true } } } },
      },
    });
    const dose = (stored?.programDay?.exercises ?? []).reduce(
      (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
      0,
    );
    const ticked = stored?.sets.filter((set) => set.completed).length ?? 0;
    expect(stored?.plannedSetCount).toBeNull();
    expect(dose).toBeGreaterThan(ticked);

    const day = dayKey(picked!.performedAt, APP_TIMEZONE);
    const from = addZonedDays(picked!.performedAt, -1, APP_TIMEZONE);
    const to = addZonedDays(picked!.performedAt, 2, APP_TIMEZONE);
    const keys = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    const chips = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE);
    const chipHasDay = (chips[day] ?? []).includes(picked!.programDayId);
    expect(keys.includes(day)).toBe(false);
    expect(chipHasDay).toBe(false);
    expect(keys.includes(day)).toBe(chipHasDay);
  });

  it("gives the Train chip the same partial mark the calendar shows for a short log", async () => {
    await resetDatabase();
    const user = await makeUser("chip-partial-day@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const anchor = new Date(2026, 9, 22, 10, 0, 0);
    const schedule = await getCalendarSchedule(user.id, anchor);
    let picked: {
      session: Awaited<ReturnType<typeof startWorkoutFromDay>>;
      performedAt: Date;
      programDayId: string;
    } | null = null;
    for (const day of schedule.days) {
      for (const activity of day.activities) {
        if (activity.kind !== "workout" || !activity.programDayId) continue;
        const started = await startWorkoutFromDay({
          userId: user.id,
          programDayId: activity.programDayId,
          preferredUnits: "lb",
        });
        if ((started.plannedSetCount ?? 0) > 3) {
          picked = {
            session: started,
            performedAt: day.date,
            programDayId: activity.programDayId,
          };
          break;
        }
        await prisma.workoutSession.delete({ where: { id: started.id } });
      }
      if (picked) break;
    }
    expect(picked).toBeTruthy();
    const logged = picked!.session.sets.slice(0, 3);
    expect(logged).toHaveLength(3);
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: picked!.session.id,
      title: picked!.session.title,
      performedAt: picked!.performedAt,
      notes: "",
      status: "complete",
      sets: logged.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "load_reps" || !set.logMode ? 8 : null,
        loadValue: set.logMode === "load_reps" || !set.logMode ? 40 : null,
        loadUnit: "lb" as const,
        durationSeconds: set.logMode === "load_reps" || !set.logMode ? null : 60,
        completed: true,
      })),
    });

    const day = dayKey(picked!.performedAt, APP_TIMEZONE);
    const from = addZonedDays(picked!.performedAt, -1, APP_TIMEZONE);
    const to = addZonedDays(picked!.performedAt, 2, APP_TIMEZONE);
    const after = await getCalendarSchedule(user.id, picked!.performedAt);
    const card = after.days
      .flatMap((item) => item.activities)
      .find((item) => item.kind === "workout" && item.programDayId === picked!.programDayId);
    expect(card?.subtitle).toContain("· Partial");
    expect(card?.subtitle).not.toContain("· Missed");
    const counted = /^(\d+)\/(\d+) sets/.exec(card?.setCountLabel ?? "");
    expect(counted).toBeTruthy();
    expect(Number(counted?.[1])).toBeGreaterThan(0);
    expect(Number(counted?.[1])).toBeLessThan(Number(counted?.[2]));

    const keys = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    const chips = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE);
    expect(keys.includes(day)).toBe(false);
    expect(partials.includes(day)).toBe(true);
    expect(
      chipMarkForDay({
        plannedSessionIds: [picked!.programDayId],
        completedSessionIds: chips[day] ?? [],
        dayLogged: keys.includes(day),
        partial: partials.includes(day),
      }),
    ).toBe("partial");

    await prisma.workoutSession.update({
      where: { id: picked!.session.id },
      data: { status: "draft" },
    });
    const draftSchedule = await getCalendarSchedule(user.id, picked!.performedAt);
    const draftCard = draftSchedule.days
      .flatMap((item) => item.activities)
      .find((item) => item.kind === "workout" && item.programDayId === picked!.programDayId);
    const draftPartials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    expect(draftCard?.subtitle.includes("· Partial") || draftCard?.subtitle.startsWith("Partial")).toBe(true);
    expect(draftPartials.includes(day)).toBe(true);
    expect(
      chipMarkForDay({
        plannedSessionIds: [picked!.programDayId],
        completedSessionIds: [],
        dayLogged: false,
        partial: draftPartials.includes(day),
      }),
    ).toBe("partial");

    const train = read("src/app/(member)/training/page.tsx");
    expect(train).toContain("partialLocalDayKeys");
    expect(train).toContain("partialDays={marks.partialDays}");
    expect(read("src/components/training/WeekStrip.tsx")).toContain("partial: partialDays.includes(day.dayParam)");
  });

  it("labels a past partial day Partial, not Missed", () => {
    expect(
      calendarFocusStatusSuffix({
        workouts: [
          { status: "scheduled", subtitle: "Partial · 3/34 sets" },
          { status: "scheduled", subtitle: "Missed. Tap Move to do it another day." },
        ],
        past: true,
        active: true,
      }),
    ).toBe(" · Partial");
    expect(
      calendarFocusStatusSuffix({
        workouts: [{ status: "scheduled", subtitle: "Missed. Tap Move to do it another day." }],
        past: true,
        active: true,
      }),
    ).toBe(" · Missed");
    expect(
      calendarFocusStatusSuffix({
        workouts: [
          { status: "complete", subtitle: "Logged this day." },
          { status: "scheduled", subtitle: "Lift — Core week plan." },
        ],
        past: false,
        active: true,
      }),
    ).toBe(" · Partly logged");
    expect(
      calendarFocusStatusSuffix({
        workouts: [{ status: "complete", subtitle: "Logged this day." }],
        past: true,
        active: true,
      }),
    ).toBe(" · Logged");
    const page = read("src/app/(member)/training/calendar/page.tsx");
    expect(page).toContain("calendarFocusStatusSuffix(");
    expect(page).toContain("subtitleCountsAsMissed(");
    expect(page).not.toContain("· Missed");
    expect(page).toContain("calendarPlanDoses");
    expect(read("src/app/(member)/training/page.tsx")).toContain("calendarPlanDoses");
  });

  it("does not mark a started draft partial when nothing is ticked", async () => {
    await resetDatabase();
    const user = await makeUser("chip-draft-only@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const anchor = new Date(2026, 9, 22, 10, 0, 0);
    const schedule = await getCalendarSchedule(user.id, anchor);
    const activity = schedule.days
      .flatMap((day) => day.activities)
      .find((item) => item.kind === "workout" && item.programDayId);
    expect(activity?.programDayId).toBeTruthy();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: activity!.programDayId!,
      preferredUnits: "lb",
      now: anchor,
      timeZone: APP_TIMEZONE,
    });
    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: started.id },
      data: { reps: 8, loadValue: 40, completed: false },
    });
    const stored = await prisma.workoutSet.findMany({ where: { workoutSessionId: started.id } });
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((set) => set.completed === false && set.reps != null)).toBe(true);

    const day = dayKey(anchor, APP_TIMEZONE);
    const from = addZonedDays(anchor, -1, APP_TIMEZONE);
    const to = addZonedDays(anchor, 2, APP_TIMEZONE);
    const doses = await calendarPlanDoses(user.id, anchor);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, doses);
    const after = await getCalendarSchedule(user.id, anchor);
    const card = after.days
      .flatMap((item) => item.activities)
      .find((item) => item.kind === "workout" && item.programDayId === activity!.programDayId);
    expect(card?.subtitle.includes("· Partial") || card?.subtitle.startsWith("Partial")).toBe(false);
    expect(partials.includes(day)).toBe(false);
    expect(
      chipMarkForDay({
        plannedSessionIds: [activity!.programDayId!],
        completedSessionIds: [],
        dayLogged: false,
        partial: false,
      }),
    ).toBe("none");
  });

  it("gives a partial mark to a short log with no program day", async () => {
    await resetDatabase();
    const user = await makeUser("chip-no-program-day@example.com");
    const anchor = new Date(2026, 9, 22, 10, 0, 0);
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: null,
        title: "Off plan",
        performedAt: anchor,
        status: "complete",
        plannedSetCount: 4,
        sets: {
          create: [{ exerciseName: "Push-up", setNumber: 1, reps: 10, completed: true }],
        },
      },
    });
    const day = dayKey(anchor, APP_TIMEZONE);
    const from = addZonedDays(anchor, -1, APP_TIMEZONE);
    const to = addZonedDays(anchor, 2, APP_TIMEZONE);
    const doses = await calendarPlanDoses(user.id, anchor);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, doses);
    const schedule = await getCalendarSchedule(user.id, anchor);
    const partialCards = schedule.days
      .flatMap((item) => item.activities)
      .filter((item) => item.subtitle.includes("· Partial") || item.subtitle.startsWith("Partial"));
    expect(partials.includes(day)).toBe(true);
    expect(partialCards.length).toBeGreaterThan(0);
    expect(partialCards.every((card) => card.subtitle.includes("· Partial") || card.subtitle.startsWith("Partial"))).toBe(
      true,
    );
    expect(
      chipMarkForDay({
        plannedSessionIds: [],
        completedSessionIds: [],
        dayLogged: false,
        partial: partials.includes(day),
      }),
    ).toBe("partial");
  });

  it("keeps a planned past day off Missed when an ad hoc log is partial", async () => {
    await resetDatabase();
    const user = await makeUser("past-adhoc-partial@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const thursday = new Date(2026, 9, 22, 15, 0, 0);
    const monday = new Date(2026, 9, 19, 11, 0, 0);
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: null,
        title: "Off plan",
        performedAt: monday,
        status: "complete",
        plannedSetCount: 3,
        sets: {
          create: [
            { exerciseName: "Push-up", setNumber: 1, reps: 10, completed: true },
            { exerciseName: "Push-up", setNumber: 2, reps: null, completed: false },
            { exerciseName: "Push-up", setNumber: 3, reps: null, completed: false },
          ],
        },
      },
    });
    const schedule = await getCalendarSchedule(user.id, thursday, monday);
    const mondayKey = dayKey(monday, APP_TIMEZONE);
    const mondayPlan = schedule.days.find((day) => dayKey(day.date, APP_TIMEZONE) === mondayKey);
    const workouts = mondayPlan?.activities.filter((item) => item.kind === "workout") ?? [];
    const notDone = "Not done — you logged Off plan instead. Tap Move to reschedule.";
    expect(workouts.some((item) => item.subtitle.startsWith("Missed"))).toBe(false);
    expect(workouts.some((item) => item.subtitle === notDone)).toBe(true);
    expect(workouts.some((item) => item.subtitle.includes("Core week plan."))).toBe(false);
    expect(workouts.filter((item) => subtitleCountsAsMissed(item.subtitle)).map((item) => item.subtitle)).toEqual([
      notDone,
    ]);
    expect(workouts.some((item) => item.subtitle.includes("· Partial") || item.subtitle.startsWith("Partial"))).toBe(
      true,
    );
    expect(
      calendarFocusStatusSuffix({
        workouts,
        past: true,
        active: Boolean(mondayPlan?.active),
      }),
    ).toBe(" · Partial");
    const from = addZonedDays(monday, -1, APP_TIMEZONE);
    const to = addZonedDays(monday, 2, APP_TIMEZONE);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    expect(partials.includes(mondayKey)).toBe(true);
  });

  it("uses the calendar scaled dose when a short log has no stored count", async () => {
    await resetDatabase();
    const user = await makeUser("chip-scaled-dose@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        experienceLevel: "advanced",
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const anchor = new Date(2026, 9, 22, 10, 0, 0);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    const catalog = await findDemoTrainingCatalog();
    const plans = scaledPlanByProgramDay(
      calendarScaledCatalog(catalog, {
        experienceLevel: profile.experienceLevel,
        competitionStatus: profile.competitionStatus,
        weightAccess: profile.weightAccess,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        now: anchor,
        timeZone: APP_TIMEZONE,
        camp: null,
      }),
    );
    const weekIndex = planWeekIndex(anchor, APP_TIMEZONE, profile.onboardingCompletedAt);
    let picked: { programDayId: string; sessionId: string; raw: number } | null = null;
    const days = [...(catalog.strength?.days ?? []), ...(catalog.skill?.days ?? [])];
    for (const programDay of days) {
      const plan = plans.get(programDay.id);
      const raw = prescribedSetTotal(programDay.exercises);
      const rawNames = programDay.exercises.map((exercise) => exercise.name.trim()).filter(Boolean);
      if (!plan || plan.dose <= raw || raw < 1) continue;
      if (!rawNames.every((name) => plan.names.includes(name))) continue;
      const started = await startWorkoutFromDay({
        userId: user.id,
        programDayId: programDay.id,
        preferredUnits: "lb",
        now: anchor,
        timeZone: APP_TIMEZONE,
        planAnchor: profile.onboardingCompletedAt,
        scale: {
          experienceLevel: "advanced",
          competitionStatus: profile.competitionStatus,
          weightAccess: profile.weightAccess,
          weekIndex,
        },
      });
      const pools = new Map<string, string[]>();
      for (const set of started.sets) {
        const list = pools.get(set.exerciseName) ?? [];
        list.push(set.id);
        pools.set(set.exerciseName, list);
      }
      const chosen: string[] = [];
      let namesFit = true;
      for (const name of rawNames) {
        const id = pools.get(name)?.shift();
        if (!id) {
          namesFit = false;
          break;
        }
        chosen.push(id);
      }
      for (const set of started.sets) {
        if (chosen.length >= raw) break;
        if (!chosen.includes(set.id)) chosen.push(set.id);
      }
      if (!namesFit || chosen.length < raw || chosen.length >= plan.dose) {
        await prisma.workoutSession.delete({ where: { id: started.id } });
        continue;
      }
      await prisma.workoutSet.updateMany({
        where: { workoutSessionId: started.id },
        data: { completed: false, reps: null, loadValue: null, durationSeconds: null },
      });
      await prisma.workoutSet.updateMany({
        where: { id: { in: chosen } },
        data: { completed: true, reps: 8, loadValue: 40 },
      });
      await prisma.workoutSession.update({
        where: { id: started.id },
        data: { status: "complete", plannedSetCount: null, performedAt: anchor },
      });
      picked = { programDayId: programDay.id, sessionId: started.id, raw };
      break;
    }
    expect(picked).toBeTruthy();
    const stored = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: picked!.sessionId },
      include: { sets: true, programDay: { include: { exercises: true } } },
    });
    expect(
      sessionCountsAsPlannedCompletion(
        { ...stored, plannedSetCount: null },
        stored.programDay?.exercises.map((exercise) => exercise.name) ?? [],
        picked!.raw,
      ),
    ).toBe(true);

    const day = dayKey(anchor, APP_TIMEZONE);
    const from = addZonedDays(anchor, -1, APP_TIMEZONE);
    const to = addZonedDays(anchor, 2, APP_TIMEZONE);
    const doses = await calendarPlanDoses(user.id, anchor);
    const partials = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, doses);
    const after = await getCalendarSchedule(user.id, anchor);
    const card = after.days
      .flatMap((item) => item.activities)
      .find((item) => item.kind === "workout" && item.programDayId === picked!.programDayId);
    expect(card?.subtitle.includes("· Partial") || card?.subtitle.startsWith("Partial")).toBe(true);
    expect(partials.includes(day)).toBe(true);
    const completedDays = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    const completedIds = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE);
    expect(completedDays.includes(day)).toBe(false);
    expect(completedIds[day] ?? []).not.toContain(picked!.programDayId);
    expect(
      chipMarkForDay({
        plannedSessionIds: [picked!.programDayId],
        completedSessionIds: [],
        dayLogged: false,
        partial: partials.includes(day),
      }),
    ).toBe("partial");

    const scaledDose = plans.get(picked!.programDayId)?.dose ?? 0;
    const rows = await prisma.workoutSet.findMany({
      where: { workoutSessionId: picked!.sessionId },
      orderBy: { setNumber: "asc" },
    });
    const stillOpen = rows.filter((set) => !set.completed).slice(0, Math.max(0, scaledDose - picked!.raw));
    expect(picked!.raw + stillOpen.length).toBe(scaledDose);
    await prisma.workoutSet.updateMany({
      where: { id: { in: stillOpen.map((set) => set.id) } },
      data: { completed: true, reps: 8, loadValue: 40 },
    });
    const partialsAfter = await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE, doses);
    const completedAfter = await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE);
    const idsAfter = await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE);
    expect(partialsAfter.includes(day)).toBe(false);
    expect(completedAfter.includes(day)).toBe(true);
    expect(idsAfter[day] ?? []).toContain(picked!.programDayId);
  });

  it("says Partial in the header when a past day's card is Partial", async () => {
    await resetDatabase();
    const user = await makeUser("chip-past-partial@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
        goalKey: "stronger-for-class",
        primaryFocus: "mma",
      },
    });
    const thursday = new Date(2026, 9, 22, 15, 0, 0);
    const monday = new Date(2026, 9, 19, 10, 0, 0);
    const schedule = await getCalendarSchedule(user.id, thursday, monday);
    const mondayKey = dayKey(monday, APP_TIMEZONE);
    const mondayPlan = schedule.days.find((day) => dayKey(day.date, APP_TIMEZONE) === mondayKey);
    const activity = mondayPlan?.activities.find((item) => item.kind === "workout" && item.programDayId);
    expect(activity?.programDayId).toBeTruthy();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: activity!.programDayId!,
      preferredUnits: "lb",
      now: monday,
      timeZone: APP_TIMEZONE,
    });
    expect((started.plannedSetCount ?? 0) > 1).toBe(true);
    const logged = started.sets.slice(0, 1);
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: monday,
      notes: "",
      status: "complete",
      sets: logged.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "load_reps" || !set.logMode ? 8 : null,
        loadValue: set.logMode === "load_reps" || !set.logMode ? 40 : null,
        loadUnit: "lb" as const,
        durationSeconds: set.logMode === "load_reps" || !set.logMode ? null : 60,
        completed: true,
      })),
    });
    const after = await getCalendarSchedule(user.id, thursday, monday);
    const focus = after.days.find((day) => dayKey(day.date, APP_TIMEZONE) === mondayKey);
    const workouts = focus?.activities.filter((item) => item.kind === "workout") ?? [];
    const card = workouts.find((item) => item.programDayId === activity!.programDayId);
    expect(card?.subtitle.includes("· Partial") || card?.subtitle.startsWith("Partial")).toBe(true);
    expect(card?.status).toBe("scheduled");
    expect(
      calendarFocusStatusSuffix({
        workouts,
        past: true,
        active: Boolean(focus?.active),
      }),
    ).toBe(" · Partial");
  });

  it("sends every chip to that date, including today", () => {
    expect(weekChipHref({ isToday: true, dayParam: "2026-10-22", logHref: "/training/bike/start" }, "/training")).toBe(
      "/training?day=2026-10-22",
    );
    expect(
      weekChipHref({ isToday: false, dayParam: "2026-10-07", logHref: "/training/bike/start" }, "/training/calendar"),
    ).toBe("/training/calendar?day=2026-10-07");
    expect(weekChipHref({ isToday: false, dayParam: "2026-10-07" }, "/training")).toBe("/training?day=2026-10-07");
  });
});
