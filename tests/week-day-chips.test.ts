import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAG_FOCUS, BAG_ROUND_COUNTS_ADVANCED_LONG, bagMinutesForBand, bagRoundCountFor, isAdvancedLongBagDay } from "@/lib/bag-sessions";
import { coreSkeletonSessions } from "@/lib/week-plan";
import { weekChipActivities } from "@/components/training/WeekStrip";
import { FRIDAY_CONDITIONING_CHIP_WORD, FRIDAY_CONDITIONING_LABEL } from "@/lib/mesocycle";

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

  it("gives today the lime chip and a previewed day a thin light outline", () => {
    const strip = read("src/components/training/WeekStrip.tsx");
    expect(strip).toContain("data-week-today");
    expect(strip).toContain("data-week-selected");
    expect(strip).toContain("border-accent");
    expect(strip).toContain("bg-accent/15");
    expect(strip).toContain("border-[#cfd6c8]");
    expect(strip).toContain('aria-current={day.isToday ? "date" : undefined}');
    expect(strip).not.toContain("ring-accent");
    expect(strip).not.toContain("bg-black text-white");
    expect(read("src/app/globals.css")).toContain("[data-week-strip] a:focus-visible");
    expect(read("src/lib/home.ts")).toContain("weekStrip(prefs, now, tz, selected, swaps, selected)");
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
    expect(weekChipActivities("Conditioning+Mobility").map((item) => item.id)).toEqual([
      "Conditioning",
      "Mobility",
    ]);
    expect(weekChipActivities("Circuit+Mobility").map((item) => item.label)).toEqual([
      "Conditioning",
      "Mobility",
    ]);
    expect(weekChipActivities("Engine").map((item) => item.label)).toEqual(["Conditioning"]);
    expect(FRIDAY_CONDITIONING_LABEL).toBe("Conditioning");
    expect(FRIDAY_CONDITIONING_CHIP_WORD).toBe("Engine");
    expect(FRIDAY_CONDITIONING_LABEL.length).toBeGreaterThan(8);

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
    expect(strip).toContain("bg-carbon text-accent");
    expect(strip).toContain("M9.15.9 3.2 8.7h3.7l-1 6.4 6.9-8.6H8.9L9.15.9z");
    expect(strip).not.toContain('circle cx="8" cy="2.6"');
    expect(strip).toContain("FRIDAY_CONDITIONING_LABEL");
  });

  it("keeps Monday and Tuesday as lifts, and Wednesday is the bike", () => {
    const mon = coreSkeletonSessions("Monday", "mma");
    const tue = coreSkeletonSessions("Tuesday", "mma");
    const wed = coreSkeletonSessions("Wednesday", "mma");
    expect(mon[0]?.kind).toBe("strength");
    expect(tue[0]?.kind).toBe("strength");
    expect(mon.some((session) => session.kind === "skill")).toBe(false);
    expect(tue.some((session) => session.kind === "skill")).toBe(false);
    expect(mon[0]?.dayNumber).not.toBe(tue[0]?.dayNumber);
    expect(BAG_FOCUS.Monday.dayNumber).not.toBe(BAG_FOCUS.Tuesday.dayNumber);
    expect(wed[0]?.kind).toBe("conditioning");
    expect(wed.some((session) => session.kind === "skill")).toBe(false);
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
