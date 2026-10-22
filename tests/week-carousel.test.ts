import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDayParam } from "@/lib/home";
import {
  WEEK_CAROUSEL_FUTURE_WEEKS,
  WEEK_CAROUSEL_PAST_WEEKS,
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
import { Prisma } from "@prisma/client";
import { chipMarkForDay } from "@/lib/chip-mark";
import {
  completedProgramDayIdsForChip,
  completionSessionSelect,
} from "@/lib/chip-completion";
import { mondayOfZoned } from "@/lib/timezone";

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
    expect(train).toContain("completedLocalDayKeys");
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
    expect(calendar).toContain("completedLocalDayKeys");
    expect(read("src/components/training/CalendarWeekFollow.tsx")).toContain("history.replaceState");
    expect(read("src/components/training/CalendarWeekFollow.tsx")).toContain('params.set("week"');
    expect(read("src/components/training/CalendarWeekFollow.tsx")).toContain('params.set("day"');
    expect(read("src/lib/chip-completion.ts")).toContain("sessionCountsAsPlannedCompletion");
    expect(read("src/lib/chip-completion.ts")).toContain("plannedSetCount");
    expect(read("src/lib/chip-completion.ts")).toContain("completionSessionSelect");
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

  it("selects plannedSetCount when the workout session has that column", () => {
    const select = completionSessionSelect();
    expect(select).toMatchObject({ status: true, programDayId: true, performedAt: true });
    const fields = Prisma.WorkoutSessionScalarFieldEnum as Record<string, string>;
    const source = read("src/lib/chip-completion.ts");
    expect(source).toContain("plannedSetCount");
    expect(source).toContain("sessionCountsAsPlannedCompletion");
    if ("plannedSetCount" in fields) {
      expect(select).toMatchObject({ plannedSetCount: true });
      const names = new Map<string, string[]>([
        ["lift", ["Back squat"]],
        ["bag", ["Jab"]],
      ]);
      const ids = completedProgramDayIdsForChip(
        [
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
            sets: [{ completed: true, reps: 5, exerciseName: "Jab" }],
          },
        ],
        names,
        "2026-10-22",
      );
      expect(
        chipMarkForDay({
          plannedSessionIds: ["lift", "bag"],
          completedSessionIds: ids,
          dayLogged: ids.length > 0,
        }),
      ).toBe("partial");
    } else {
      expect(select).not.toHaveProperty("plannedSetCount");
    }
  });

  it("sends non-today chips to that date and keeps today's bike logger", () => {
    expect(weekChipHref({ isToday: true, dayParam: "2026-10-22", logHref: "/training/bike/start" }, "/training")).toBe(
      "/training/bike/start",
    );
    expect(
      weekChipHref({ isToday: false, dayParam: "2026-10-07", logHref: "/training/bike/start" }, "/training/calendar"),
    ).toBe("/training/calendar?day=2026-10-07");
    expect(weekChipHref({ isToday: false, dayParam: "2026-10-07" }, "/training")).toBe("/training?day=2026-10-07");
  });
});
