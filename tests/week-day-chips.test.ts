import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAG_FOCUS, bagMinutesForBand } from "@/lib/bag-sessions";
import { coreSkeletonSessions } from "@/lib/week-plan";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Train / Calendar day chips", () => {
  it("makes week chips links with ?day= on Train and Calendar", () => {
    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain("dayParam");
    expect(strip).toContain("href=");
    expect(strip).toContain("data-week-chip");
    expect(read("src/app/(member)/training/page.tsx")).toContain("parseDayParam");
    expect(read("src/app/(member)/training/page.tsx")).toContain("data-selected-day-plan");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("parseDayParam");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("WeekStrip");
    expect(read("src/app/(member)/training/calendar/page.tsx")).toContain("data-selected-day-plan");
  });

  it("keeps Mon and Wed bag day numbers distinct", () => {
    const mon = coreSkeletonSessions("Monday", "mma")[0]?.dayNumber;
    const wed = coreSkeletonSessions("Wednesday", "mma")[0]?.dayNumber;
    expect(mon).toBe(BAG_FOCUS.Monday.dayNumber);
    expect(wed).toBe(BAG_FOCUS.Wednesday.dayNumber);
    expect(mon).not.toBe(wed);
  });

  it("scales bag minutes beginner ~30, intermediate ~35–40, advanced ~45", () => {
    expect(bagMinutesForBand("beginner")).toBeGreaterThanOrEqual(28);
    expect(bagMinutesForBand("beginner")).toBeLessThanOrEqual(32);
    expect(bagMinutesForBand("intermediate")).toBeGreaterThanOrEqual(34);
    expect(bagMinutesForBand("intermediate")).toBeLessThanOrEqual(42);
    expect(bagMinutesForBand("advanced")).toBeGreaterThanOrEqual(42);
    expect(bagMinutesForBand("advanced")).toBeLessThanOrEqual(48);
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
