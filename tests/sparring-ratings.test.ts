import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { saveSparringLog, sparringNeedsEase, sparringTrend } from "@/lib/outside-log";
import { easeDayPlan, recoveryEaseReason, writeRecoveryCheckIn } from "@/lib/recovery-ease";
import { easePlanForUser } from "@/lib/recovery-ease";
import type { DayPlan } from "@/lib/week-plan";
import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";

function heavyDay(): DayPlan {
  return {
    weekday: "Sunday",
    active: true,
    optionalDay: false,
    summary: "Lift",
    sessions: [
      {
        kind: "strength",
        label: "Strength — lower",
        title: "Strength — lower",
        heavy: true,
        dayNumber: 1,
      },
    ],
    deload: false,
    testingWeek: false,
    mesoBlock: "A",
    mesoLabel: "Block A",
    outside: null,
  };
}

describe("sparring session and body ratings", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores ratings and sore spots", async () => {
    const user = await makeUser("spar@example.com");
    // RIR auto-adjust and the recovery check-in are Pro; give this member an active trial.
    await prisma.profile.update({
      where: { userId: user.id },
      data: { aiCoachId: "maya", trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    });
    const saved = await saveSparringLog(user.id, {
      dateKey: "2026-10-17",
      weekday: "Saturday",
      rounds: 5,
      minutesPerRound: 3,
      intensity: "hard",
      sessionRating: 4,
      bodyRating: 2,
      soreSpots: ["head", "shins", "nope"],
    });
    expect(saved.sessionRating).toBe(4);
    expect(saved.bodyRating).toBe(2);
    expect(saved.soreSpots).toEqual(["head", "shins"]);
    expect(sparringNeedsEase(saved)).toBe(true);

    const checkIn = await writeRecoveryCheckIn(user.id, saved);
    expect(checkIn?.message).toMatch(/^Maya:/);
    expect(checkIn?.message).toMatch(/head/i);
    expect(checkIn?.coachName).toBe("Maya");

    const trend = await sparringTrend(user.id);
    expect(trend).toHaveLength(1);
    expect(trend[0]?.bodyRating).toBe(2);

    const sunday = zonedCivilToUtc(2026, 10, 18, APP_TIMEZONE);
    const eased = await easePlanForUser(user.id, sunday, APP_TIMEZONE, heavyDay());
    expect(eased.plan.summary).toBe("Mobility");
    expect(eased.plan.sessions.map((session) => session.kind)).toEqual(["mobility", "conditioning"]);
    expect(eased.plan.easeNote).toMatch(/body rating 2/);
    expect(eased.plan.easeNote).toMatch(/head marked sore/);
    expect(eased.checkIn?.message).toMatch(/Maya:/);
    expect(eased.plan.sessions.every((session) => !session.programSlug)).toBe(true);
  });

  it("leaves the next day alone when the body is fine and the head is clear", async () => {
    const user = await makeUser("fine@example.com");
    const saved = await saveSparringLog(user.id, {
      dateKey: "2026-10-17",
      weekday: "Saturday",
      rounds: 4,
      minutesPerRound: 3,
      sessionRating: 5,
      bodyRating: 4,
      soreSpots: ["hands"],
    });
    expect(sparringNeedsEase(saved)).toBe(false);
    expect(await writeRecoveryCheckIn(user.id, saved)).toBeNull();
    const sunday = zonedCivilToUtc(2026, 10, 18, APP_TIMEZONE);
    const eased = await easePlanForUser(user.id, sunday, APP_TIMEZONE, heavyDay());
    expect(eased.plan.summary).toBe("Lift");
    expect(eased.checkIn).toBeNull();
  });

  it("eases on a low body rating even without a sore head", () => {
    const reason = recoveryEaseReason({ bodyRating: 1, soreSpots: [] });
    const eased = easeDayPlan(heavyDay(), reason);
    expect(eased.easedTo).toBe("mobility");
    expect(eased.plan.easeNote).toMatch(/body rating 1/);
  });

  it("eases when the head is tapped even if the body feels fine", () => {
    const reason = recoveryEaseReason({ bodyRating: 5, soreSpots: ["head"] });
    const eased = easeDayPlan(heavyDay(), reason);
    expect(eased.easedTo).toBe("mobility");
    expect(reason).toMatch(/head marked sore/);
  });
});
