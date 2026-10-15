import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAG_FOCUS, BAG_ROUND_COUNTS_ADVANCED_LONG, bagMinutesForBand, bagRoundCountFor, isAdvancedLongBagDay } from "@/lib/bag-sessions";
import { coreSkeletonSessions } from "@/lib/week-plan";
import { weekChipActivities } from "@/components/training/WeekStrip";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Train / Calendar day chips", () => {
  it("makes week chips links with ?day= on Train and Calendar", () => {
    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain("dayParam");
    expect(strip).toContain("href=");
    expect(strip).toContain("data-week-chip");
    expect(strip).toContain("weekChipActivities");
    expect(strip).toContain("data-week-chip-date");
    expect(strip).toContain("h-[5.5rem]");
    expect(strip).toContain("min-w-0");
    expect(read("src/app/(member)/training/page.tsx")).toContain("parseDayParam");
    expect(read("src/app/(member)/training/page.tsx")).toContain("data-selected-day-plan");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("parseDayParam");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("WeekStrip");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("rearrange");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("data-selected-day-plan");
    expect(strip).toContain("data-move-sheet");
    expect(strip).toContain("onContextMenu");
    expect(read("src/app/(member)/training/page.tsx")).not.toContain("rearrange");
  });

  it("turns summaries into activity icons and keeps rest words", () => {
    expect(weekChipActivities("Bag+Lift+Cardio").map((item) => item.id)).toEqual([
      "Bag",
      "Lift",
      "Cardio",
    ]);
    expect(weekChipActivities("Bag+Lift").map((item) => item.label)).toEqual(["Bag", "Lift"]);
    expect(weekChipActivities("Bag+GPP").map((item) => item.label)).toEqual(["Bag", "Cardio"]);
    expect(weekChipActivities("Off")).toEqual([{ id: "Off", label: "Off" }]);
    expect(weekChipActivities("Rest")).toEqual([{ id: "Rest", label: "Rest" }]);
    expect(weekChipActivities("Recover")).toEqual([{ id: "Mobility", label: "Mobility" }]);

    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain("<svg");
    expect(strip).toContain("data-week-activity");
    expect(strip).toContain("title={activity.label}");
    expect(strip).toContain('className="sr-only">{activity.label}');
    expect(strip).toContain("WORD_LABELS");
    expect(strip).toContain("data-week-legend");
    expect(strip).toContain("Activity key");
    expect(strip).not.toContain("GPP · conditioning");
    for (const label of ["Bag", "Lift", "Cardio", "Mobility"]) {
      expect(strip).toContain(label);
    }
    expect(strip).not.toContain("ACTIVITY_MARK");
    expect(strip).not.toContain("activity.mark");
  });

  it("keeps Mon and Wed bag day numbers distinct", () => {
    const mon = coreSkeletonSessions("Monday", "mma")[0]?.dayNumber;
    const wed = coreSkeletonSessions("Wednesday", "mma")[0]?.dayNumber;
    expect(mon).toBe(BAG_FOCUS.Monday.dayNumber);
    expect(wed).toBe(BAG_FOCUS.Wednesday.dayNumber);
    expect(mon).not.toBe(wed);
  });

  it("keeps every bag day between 30 and 45 minutes", () => {
    for (const band of ["beginner", "intermediate", "advanced"] as const) {
      for (const day of [1, 2, 3, 4, 5, 6]) {
        const minutes = bagMinutesForBand(band, day);
        expect(minutes).toBeGreaterThanOrEqual(30);
        expect(minutes).toBeLessThanOrEqual(45);
      }
    }
    expect(isAdvancedLongBagDay(1)).toBe(false);
    expect(bagRoundCountFor("advanced", 1)).toBe(BAG_ROUND_COUNTS_ADVANCED_LONG);
    expect(bagRoundCountFor("advanced", 1)).toBe(bagRoundCountFor("advanced", 2));
    expect(bagRoundCountFor("advanced", 5)).toBe(bagRoundCountFor("advanced", 4));
  });

  it("never says bout in the new week seed or planner", () => {
    for (const file of [
      "src/lib/week-plan.ts",
      "src/lib/bag-sessions.ts",
      "src/lib/demo-week-seed.ts",
      "src/app/(member)/training/page.tsx",
      "src/app/(member)/training/calendar/page.tsx",
    ]) {
      expect(read(file).toLowerCase()).not.toContain("bout");
    }
  });
});
