import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { startRequestCreatesSession } from "@/lib/start-request";

function headers(init: Record<string, string>) {
  return new Headers(init);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("start request writes", () => {
  it("creates a session for a normal navigation", () => {
    expect(startRequestCreatesSession(headers({}))).toBe(true);
    expect(startRequestCreatesSession(headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(startRequestCreatesSession(headers({ "sec-fetch-site": "same-site" }))).toBe(true);
    expect(startRequestCreatesSession(headers({ "sec-fetch-site": "none" }))).toBe(true);
  });

  it("does not create a session for a cross-site GET", () => {
    expect(startRequestCreatesSession(headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(startRequestCreatesSession(headers({ "sec-fetch-site": "CROSS-SITE" }))).toBe(false);
  });

  it("does not create a session for a prefetch", () => {
    expect(startRequestCreatesSession(headers({ "next-router-prefetch": "1" }))).toBe(false);
    expect(startRequestCreatesSession(headers({ "next-router-prefetch": "" }))).toBe(false);
    expect(startRequestCreatesSession(headers({ "next-router-segment-prefetch": "/training" }))).toBe(false);
    expect(startRequestCreatesSession(headers({ purpose: "prefetch" }))).toBe(false);
    expect(startRequestCreatesSession(headers({ "sec-purpose": "prefetch" }))).toBe(false);
    expect(startRequestCreatesSession(headers({ purpose: "prefetch;prerender" }))).toBe(false);
  });

  it("checks the gate before loading the member, and Start links do not prefetch", () => {
    const route = read("src/app/(member)/training/[dayId]/start/route.ts");
    const gate = route.indexOf("startRequestCreatesSession");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(route.indexOf("requireUser("));
    expect(route).toContain("redirect(`/training/log/${session.id}`)");

    const counts: Record<string, number> = {
      "src/components/home/HomeToday.tsx": 2,
      "src/components/training/StartTodayButton.tsx": 1,
      "src/components/home/TodayGuide.tsx": 1,
      "src/components/training/NextSessionCta.tsx": 1,
      "src/components/training/PlanSessionCard.tsx": 0,
      "src/app/(member)/training/[dayId]/page.tsx": 2,
      "src/app/(member)/training/my-workouts/day/[planId]/page.tsx": 1,
      "src/components/timer/BikeClockScreen.tsx": 1,
    };
    for (const [file, count] of Object.entries(counts)) {
      expect(read(file).match(/prefetch=\{false\}/g) ?? [], file).toHaveLength(count);
    }
    expect(read("src/components/training/WeekStrip.tsx")).not.toContain("day.logHref");
    const custom = read("src/app/(member)/training/my-workouts/day/[planId]/start/route.ts");
    const customGate = custom.indexOf("startRequestCreatesSession");
    expect(customGate).toBeGreaterThan(-1);
    expect(customGate).toBeLessThan(custom.indexOf("requireUser("));
    expect(read("src/app/(member)/training/my-workouts/day/[planId]/page.tsx")).not.toContain(
      "startDayPlanForUser",
    );
    expect(read("src/components/training/CalendarList.tsx")).toContain(
      "prefetch={isBikeLoggerHref(activity.href) ? false : undefined}",
    );
  });
});
