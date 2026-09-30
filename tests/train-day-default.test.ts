import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Train default is one day", () => {
  const page = read("src/app/(member)/training/page.tsx");
  const board = read("src/components/training/TrainWeekBoard.tsx");
  const rir = read("src/components/training/RirExplainer.tsx");

  it("keeps day chips and shows the selected day as the body", () => {
    expect(page).toContain("parseDayParam");
    expect(page).toContain("<WeekStrip");
    expect(page).toContain("data-selected-day-plan");
    expect(page).toContain("mesoBlockLabel");
    const day = page.indexOf("data-selected-day-plan");
    const toggle = page.indexOf("<TrainWeekToggle");
    expect(toggle).toBeGreaterThan(-1);
    expect(day).toBeGreaterThan(toggle);
    expect(page.indexOf('aria-label="More training"')).toBeGreaterThan(day);
    expect(page).toContain("Round timer");
    expect(page).not.toContain("Free tool");
  });

  it("hides the weekday cards behind a closed This week control", () => {
    expect(page).not.toContain("<TrainWeekBoard");
    expect(page).not.toContain("This Core week");
    expect(board).toContain("data-train-week");
    expect(board).toContain("This week");
    expect(board).toContain("<details");
    expect(board).not.toContain("<details open");
    expect(board).toContain("TrainWeekToggle");
  });

  it("starts the RIR note collapsed", () => {
    expect(rir).toContain("data-rir-explainer");
    expect(rir).not.toContain("<details open");
  });

  it("leaves Calendar as its own page", () => {
    const calendar = read("src/app/(member)/training/calendar/page.tsx");
    expect(calendar).toContain("WeekStrip");
    expect(calendar).toContain("data-selected-day-plan");
    expect(calendar).toContain("CalendarList");
    expect(page).toContain('href: "/training/calendar"');
  });
});
