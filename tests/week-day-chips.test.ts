import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAG_FOCUS, BAG_ROUND_COUNTS_ADVANCED_LONG, bagMinutesForBand, bagRoundCountFor, isAdvancedLongBagDay } from "@/lib/bag-sessions";
import { coreSkeletonSessions } from "@/lib/week-plan";
import { weekChipLabelLines } from "@/components/training/WeekStrip";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Train / Calendar day chips", () => {
  it("makes week chips links with ?day= on Train and Calendar", () => {
    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain("dayParam");
    expect(strip).toContain("href=");
    expect(strip).toContain("data-week-chip");
    expect(strip).toContain("weekChipLabelLines");
    expect(strip).toContain("h-[4.75rem]");
    expect(strip).toContain("min-w-0");
    expect(read("src/app/(member)/training/page.tsx")).toContain("parseDayParam");
    expect(read("src/app/(member)/training/page.tsx")).toContain("data-selected-day-plan");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("parseDayParam");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("WeekStrip");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("data-selected-day-plan");
  });

  it("stacks long chip labels onto two centered lines without changing summaries", () => {
    expect(weekChipLabelLines("Bag+Lift+Bike")).toEqual(["Bag+Lift", "+Bike"]);
    expect(weekChipLabelLines("Bag+Lift")).toEqual(["Bag", "+Lift"]);
    expect(weekChipLabelLines("Bag+GPP")).toEqual(["Bag", "+GPP"]);
    expect(weekChipLabelLines("Off")).toEqual(["Off"]);
    expect(weekChipLabelLines("Rest")).toEqual(["Rest"]);
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
