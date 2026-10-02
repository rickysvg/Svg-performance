import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Train default is one day", () => {
  const page = read("src/app/(member)/training/page.tsx");
  const day = read("src/app/(member)/training/[dayId]/page.tsx");
  const hint = read("src/components/training/RirHint.tsx");

  it("puts the next-session action under the day chips and drops the week board", () => {
    expect(page).toContain("parseDayParam");
    expect(page).toContain("<WeekStrip");
    expect(page).toContain("data-selected-day-plan");
    expect(page).toContain("mesoBlockLabel");
    expect(page).toContain("<NextSessionCta");
    expect(page).toContain("<SessionDetails");
    expect(read("src/components/training/SessionDetails.tsx")).toContain("data-session-details");
    expect(page).toContain('data-session-phase="first"');
    expect(page).toContain('data-session-phase="next"');
    expect(page).toContain('data-session-phase="finish"');
    expect(page).toContain("data-bag-session");
    const chips = page.indexOf("<WeekStrip");
    const selected = page.indexOf("data-selected-day-plan");
    const next = page.indexOf("<NextSessionCta");
    const details = page.indexOf("<SessionDetails");
    expect(selected).toBeGreaterThan(chips);
    expect(next).toBeGreaterThan(selected);
    expect(details).toBeGreaterThan(next);
    expect(page).not.toContain("TrainWeekToggle");
    expect(page).not.toContain("This week");
    expect(page).not.toContain("RirExplainer");
    expect(page.indexOf('aria-label="More training"')).toBeGreaterThan(selected);
    expect(page).toContain("Round timer");
    expect(page).not.toContain("Free tool");
    expect(page).toContain("fromProfile ? null");
  });

  it("structures the day page as First, Next, Finish with collapsed session details", () => {
    expect(day).toContain('data-session-phase="first"');
    expect(day).toContain('data-session-phase="next"');
    expect(day).toContain('data-session-phase="finish"');
    expect(day).toContain("<SessionDetails");
    expect(day).toContain("data-start-bar");
    expect(day).toContain("sticky bottom-0");
    expect(day).toContain("data-first-controls");
    expect(day).not.toContain("WatchFormInline");
    const first = day.indexOf('data-session-phase="first"');
    const next = day.indexOf('data-session-phase="next"');
    const finish = day.indexOf('data-session-phase="finish"');
    expect(first).toBeLessThan(next);
    expect(next).toBeLessThan(finish);
  });

  it("uses compact How heavy help beside a lift instead of a big RIR card", () => {
    expect(hint).toContain("data-rir-hint");
    expect(hint).toContain("How heavy?");
    expect(hint).not.toContain("<details open");
    expect(day).toContain("<RirHint />");
    expect(page).not.toContain("<RirExplainer");
  });

  it("lists Calendar sessions before collapsed Session details, with warm-up and bike zones inside", () => {
    const calendar = read("src/app/(member)/training/calendar/page.tsx");
    expect(calendar).toContain("WeekStrip");
    expect(calendar).toContain("data-selected-day-plan");
    expect(calendar).toContain("CalendarList");
    expect(calendar).toContain("fromProfile ? null");
    expect(page).toContain('href: "/training/calendar"');
    expect(calendar).toContain("<SessionDetails");
    const sessions = calendar.indexOf("<PlanSessionCard");
    const details = calendar.indexOf("<SessionDetails");
    const warmup = calendar.indexOf("/mobility/daily-warmup/play");
    const zone = calendar.indexOf("<BikeZoneNote");
    expect(sessions).toBeGreaterThan(-1);
    expect(details).toBeGreaterThan(sessions);
    expect(warmup).toBeGreaterThan(details);
    expect(zone).toBeGreaterThan(warmup);
    expect(calendar.indexOf("</SessionDetails>")).toBeGreaterThan(zone);
  });

  it("drops the unused week board component", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/components/training/TrainWeekBoard.tsx"))).toBe(
      false,
    );
  });
});
