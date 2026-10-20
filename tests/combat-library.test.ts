import { describe, expect, it } from "vitest";
import {
  COMBAT_LIBRARY,
  libraryReviewQueue,
  memberSwappable,
  needsReview,
  needsTrim,
} from "@/lib/combat-library";
import { filterExerciseLibrary } from "@/lib/exercise-library";
import { DEMO_FORM_VIDEOS, isYoutubeFormUrl } from "@/lib/form-videos";
import { v2StrengthDays } from "@/lib/v2-lifts";
import { planBikeDose, pickBikeSessionForPlan } from "@/lib/bike-sessions";
import { BIKE_SESSIONS } from "@/lib/bike-sessions";
import { shapeDayPlan } from "@/lib/fight-camp";
import type { DayPlan } from "@/lib/week-plan";

describe("combat swap library", () => {
  it("keeps 151 exercises live and holds the rest", () => {
    const queue = libraryReviewQueue();
    expect(COMBAT_LIBRARY).toHaveLength(203);
    expect(queue.needsReview).toHaveLength(20);
    expect(queue.needsTrim).toHaveLength(46);
    expect(queue.live).toBe(151);
    expect(queue.held).toBe(52);
    expect(queue.live + queue.held).toBe(203);
    expect(queue.queueCount).toBe(55);
  });

  it("hides low-confidence clips and long clips that do not start on the form", () => {
    const hidden = COMBAT_LIBRARY.filter((row) => !memberSwappable(row)).map((row) => row.name);
    expect(hidden).toContain("Hip-hinge isometric mid-thigh pull");
    expect(hidden).toContain("Banded neck flexion");
    expect(hidden).toContain("Zercher squat");
    expect(hidden).toContain("Pull-up");
    expect(memberSwappable(COMBAT_LIBRARY.find((row) => row.name === "Meadows row")!)).toBe(true);
    expect(needsTrim(COMBAT_LIBRARY.find((row) => row.name === "Meadows row")!)).toBe(true);
    expect(needsReview(COMBAT_LIBRARY.find((row) => row.name === "Dragon flag")!)).toBe(true);

    const picker = filterExerciseLibrary({ category: "lower", equipment: "gym" }).map((row) => row.name);
    expect(picker).not.toContain("Hip-hinge isometric mid-thigh pull");
    expect(picker).toContain("Bulgarian split squat");
  });

  it("puts high and medium library lifts in the templates and leaves the unverified moves out", () => {
    const names = v2StrengthDays().flatMap((day) => day.exercises.create.map((row) => row.name));
    for (const name of [
      "Zercher squat",
      "Bulgarian split squat",
      "Nordic hamstring curl",
      "Pull-up",
      "Push press",
      "Sandbag front squat",
    ]) {
      expect(names, name).toContain(name);
      expect(isYoutubeFormUrl(DEMO_FORM_VIDEOS[name]?.url ?? ""), name).toBe(true);
    }
    for (const banned of ["med-ball slam", "sled", "banded neck", "mid-thigh"]) {
      expect(names.join(" | ").toLowerCase()).not.toContain(banned);
    }
  });

  it("moves the Wednesday bike from 10/50 toward 10/20 and keeps Sunday aerobic", () => {
    const alactic = BIKE_SESSIONS.find((row) => row.id === "daru-alactic")!;
    const week1 = planBikeDose(alactic, "intermediate", 0);
    const week2 = planBikeDose(alactic, "intermediate", 1);
    const week3 = planBikeDose(alactic, "beginner", 2);
    expect(week1.workSeconds).toBe(10);
    expect(week1.restSeconds).toBe(50);
    expect(week1.roundsPerSet).toBe(6);
    expect(week2.restSeconds).toBe(40);
    expect(week2.roundsPerSet).toBe(8);
    expect(week3.restSeconds).toBe(20);
    expect(week3.sets).toBe(1);
    expect(week3.roundsPerSet).toBe(4);
    expect(planBikeDose(alactic, "intermediate", 0, "taper").workSeconds).toBe(8);
    expect(planBikeDose(alactic, "intermediate", 0, "taper").restSeconds).toBe(60);

    const cardiac = BIKE_SESSIONS.find((row) => row.id === "jamieson-cardiac")!;
    expect(planBikeDose(cardiac, "intermediate", 0).workSeconds).toBe(30 * 60);
    expect(planBikeDose(cardiac, "beginner", 0).workSeconds).toBe(20 * 60);
    expect(planBikeDose(cardiac, "intermediate", 2).workSeconds).toBe(40 * 60);
    expect(pickBikeSessionForPlan("Wednesday", 0).programDayNumber).toBe(5);
    expect(pickBikeSessionForPlan("Sunday", 2, "peak").id).toBe("fight-pace");
  });

  it("swaps the Friday circuit for technical bag in camp and drops it in the taper", () => {
    const day: DayPlan = {
      weekday: "Friday",
      active: true,
      optionalDay: false,
      deload: false,
      testingWeek: false,
      summary: "Circuit+Mobility",
      mesoBlock: "A",
      mesoLabel: "Block A",
      sessions: [
        { kind: "conditioning", label: "Friday circuit", dayNumber: 10 },
        { kind: "mobility", label: "Mobility — easy hips" },
      ],
    };
    const base = shapeDayPlan(day, "base");
    expect(base.sessions[0]?.kind).toBe("skill");
    expect(base.sessions[0]?.label).not.toMatch(/circuit/i);
    const taper = shapeDayPlan(day, "taper");
    expect(taper.sessions.map((session) => session.label)).toEqual(["Mobility — easy hips"]);
    expect(taper.sessions.some((session) => /circuit/i.test(session.label))).toBe(false);
  });
});
