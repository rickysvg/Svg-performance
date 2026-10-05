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
    expect(weekChipActivities("Bag+Lift+Bike").map((item) => item.id)).toEqual(["Bag", "Lift", "Bike"]);
    expect(weekChipActivities("Bag+Lift").map((item) => item.label)).toEqual(["Bag", "Lift"]);
    expect(weekChipActivities("Bag+GPP").map((item) => item.label)).toEqual([
      "Bag",
      "GPP · conditioning",
    ]);
    expect(weekChipActivities("Off")).toEqual([{ id: "Off", label: "Off" }]);
    expect(weekChipActivities("Rest")).toEqual([{ id: "Rest", label: "Rest" }]);
    expect(weekChipActivities("Recover")).toEqual([{ id: "Recover", label: "Recover" }]);

    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain("<svg");
    expect(strip).toContain("data-week-activity");
    expect(strip).toContain("title={activity.label}");
    expect(strip).toContain('className="sr-only">{activity.label}');
    expect(strip).toContain("WORD_LABELS");
    expect(strip).toContain("data-week-legend");
    expect(strip).toContain("Activity key");
    expect(strip).toContain("GPP · conditioning");
    for (const label of ["Bag", "Lift", "Bike", "GPP"]) {
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

  it("scales bag minutes beginner ~30, intermediate ~35–40, advanced ~45 / ~60 on long days", () => {
    expect(bagMinutesForBand("beginner")).toBeGreaterThanOrEqual(28);
    expect(bagMinutesForBand("beginner")).toBeLessThanOrEqual(32);
    expect(bagMinutesForBand("intermediate")).toBeGreaterThanOrEqual(34);
    expect(bagMinutesForBand("intermediate")).toBeLessThanOrEqual(42);
    // Tue/Thu (and default) advanced stay ~45
    expect(bagMinutesForBand("advanced")).toBeGreaterThanOrEqual(42);
    expect(bagMinutesForBand("advanced")).toBeLessThanOrEqual(48);
    expect(bagMinutesForBand("advanced", 2)).toBeGreaterThanOrEqual(42);
    expect(bagMinutesForBand("advanced", 2)).toBeLessThanOrEqual(48);
    expect(bagMinutesForBand("advanced", 4)).toBeGreaterThanOrEqual(42);
    expect(bagMinutesForBand("advanced", 4)).toBeLessThanOrEqual(48);
    // Mon/Wed/Fri advanced long bag ~60
    for (const day of [1, 3, 5]) {
      expect(bagMinutesForBand("advanced", day)).toBeGreaterThanOrEqual(58);
      expect(bagMinutesForBand("advanced", day)).toBeLessThanOrEqual(62);
    }
  });

  it("gives advanced Mon/Wed/Fri more rounds than Tue/Thu", () => {
    expect(bagRoundCountFor("advanced", 1)).toBe(BAG_ROUND_COUNTS_ADVANCED_LONG);
    expect(bagRoundCountFor("advanced", 3)).toBe(BAG_ROUND_COUNTS_ADVANCED_LONG);
    expect(bagRoundCountFor("advanced", 5)).toBe(BAG_ROUND_COUNTS_ADVANCED_LONG);
    expect(bagRoundCountFor("advanced", 2)).toBe(10);
    expect(bagRoundCountFor("advanced", 4)).toBe(10);
    expect(isAdvancedLongBagDay(1)).toBe(true);
    expect(isAdvancedLongBagDay(2)).toBe(false);
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
