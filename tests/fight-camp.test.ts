import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { canUseFeature } from "@/lib/entitlements";
import { startTrialForUser } from "@/lib/trial";
import { dayKey } from "@/lib/timezone";
import type { DayPlan } from "@/lib/week-plan";
import {
  buildCampSnapshot,
  campTemplateText,
  cancelFightCampForUser,
  cleanWeightClass,
  daysBetweenKeys,
  getActiveCampSnapshot,
  saveFightCampForUser,
  selectTemplateWeeks,
  shapeDayPlan,
} from "@/lib/fight-camp";
import { normalizeWeightClassLabel } from "@/lib/units";

const ZONE = "America/Denver";
const NOW = new Date("2026-09-27T18:00:00.000Z");

describe("fight camp week math", () => {
  it("normalizes kg weight-class copy to whole pounds", () => {
    expect(normalizeWeightClassLabel("77 kg class")).toBe("170 lb class");
    expect(cleanWeightClass("77kg")).toBe("170 lb");
    expect(
      buildCampSnapshot({
        fightDateKey: "2026-10-15",
        templateWeeks: 6,
        todayKey: "2026-09-27",
        weightClass: "77 kg class",
        discipline: "mma",
      }).weightClass,
    ).toBe("170 lb class");
  });

  it("picks 12, 8, and 6 week camps from weeks left", () => {
    expect(selectTemplateWeeks(0)).toBe(6);
    expect(selectTemplateWeeks(18)).toBe(6);
    expect(selectTemplateWeeks(34)).toBe(6);
    expect(selectTemplateWeeks(35)).toBe(8);
    expect(selectTemplateWeeks(55)).toBe(8);
    expect(selectTemplateWeeks(56)).toBe(12);
    expect(selectTemplateWeeks(83)).toBe(12);
    expect(selectTemplateWeeks(100)).toBe(12);
  });

  it("keeps the fight date fixed and changes the week across time zones", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    const fightDateKey = "2026-10-14";
    const aucklandToday = dayKey(now, "Pacific/Auckland");
    const honoluluToday = dayKey(now, "Pacific/Honolulu");
    expect(aucklandToday).toBe("2026-10-08");
    expect(honoluluToday).toBe("2026-10-07");

    const auckland = buildCampSnapshot({
      fightDateKey,
      templateWeeks: 6,
      todayKey: aucklandToday,
      discipline: "mma",
      weightClass: "",
    });
    const honolulu = buildCampSnapshot({
      fightDateKey,
      templateWeeks: 6,
      todayKey: honoluluToday,
      discipline: "mma",
      weightClass: "",
    });

    expect(auckland.fightDateKey).toBe(fightDateKey);
    expect(honolulu.fightDateKey).toBe(fightDateKey);
    expect(auckland.daysToFight).toBe(6);
    expect(honolulu.daysToFight).toBe(7);
    expect(auckland.weekNumber).toBe(6);
    expect(honolulu.weekNumber).toBe(5);
    expect(auckland.phase).toBe("taper");
    expect(honolulu.phase).toBe("peak");
  });

  it("anchors weeks to the fight date, including pre-camp and a frozen longer camp", () => {
    const pre = buildCampSnapshot({
      fightDateKey: "2026-12-27",
      templateWeeks: 12,
      todayKey: "2026-09-27",
      discipline: "mma",
      weightClass: "",
    });
    expect(pre.daysToFight).toBe(daysBetweenKeys("2026-09-27", "2026-12-27"));
    expect(pre.phase).toBe("pre-camp");
    expect(pre.weekNumber).toBeNull();
    expect(pre.daysUntilCamp).toBeGreaterThan(0);

    const frozen = buildCampSnapshot({
      fightDateKey: "2026-10-27",
      templateWeeks: 12,
      todayKey: "2026-09-27",
      discipline: "boxing",
      weightClass: "",
    });
    expect(frozen.templateWeeks).toBe(12);
    expect(frozen.daysToFight).toBe(30);
    expect(frozen.weekNumber).toBe(8);
    expect(frozen.phase).toBe("build");

    const fightDay = buildCampSnapshot({
      fightDateKey: "2026-10-14",
      templateWeeks: 6,
      todayKey: "2026-10-14",
      discipline: "",
      weightClass: "",
    });
    expect(fightDay.daysToFight).toBe(0);
    expect(fightDay.phase).toBe("taper");
    expect(fightDay.weekNumber).toBe(6);

    const done = buildCampSnapshot({
      fightDateKey: "2026-10-14",
      templateWeeks: 6,
      todayKey: "2026-10-15",
      discipline: "",
      weightClass: "",
    });
    expect(done.phase).toBe("complete");
  });

  it("keeps fight week general and free of calorie or water amounts", () => {
    const text = campTemplateText();
    const withoutDenial = text
      .toLowerCase()
      .replaceAll("does not set a water cut or calorie targets", "");
    expect(text.toLowerCase()).not.toContain("kcal");
    expect(withoutDenial).not.toContain("calorie");
    expect(withoutDenial).not.toContain("water cut");
    expect(text).not.toMatch(/\bbout\b/i);
    expect(text.toLowerCase()).not.toContain("sauna");
    expect(text).not.toMatch(/\d+\s*(oz|ml|liter|litre)/i);
    const taper = buildCampSnapshot({
      fightDateKey: "2026-10-14",
      templateWeeks: 6,
      todayKey: "2026-10-14",
      discipline: "muay-thai",
      weightClass: "",
    });
    expect(taper.guidance.general).toMatch(/coach/i);
    expect(taper.guidance.general).toMatch(/doctor/i);
    expect(taper.todayFocus).toMatch(/20%/);
    expect(taper.todayFocus.toLowerCase().replaceAll("calorie targets", "")).not.toContain("calorie");
  });

  it("shapes today's training for the camp phase", () => {
    const day: DayPlan = {
      weekday: "Monday",
      active: true,
      optionalDay: false,
      deload: false,
      testingWeek: false,
      summary: "Bag and strength",
      mesoBlock: "A",
      mesoLabel: "Block A · Jab IQ and range",
      sessions: [
        { kind: "skill", label: "Bag / striking" },
        { kind: "strength", label: "Strength — push / upper" },
        { kind: "conditioning", label: "Assault Bike" },
        { kind: "skill", label: "Optional sparring", optional: true },
      ],
    };
    const taper = shapeDayPlan(day, "taper");
    expect(taper.summary).toMatch(/less volume/i);
    expect(taper.sessions.map((session) => session.label)).toEqual([
      "Sharp pad rounds",
      "Light strength · speed",
      "Easy conditioning",
    ]);
    expect(JSON.stringify(taper).toLowerCase()).not.toContain("bout");
    const base = shapeDayPlan(day, "base");
    expect(base.summary.startsWith("Base")).toBe(true);
    expect(base.sessions).toHaveLength(4);
  });
});

describe("fight camp access", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("locks the free plan and opens the camp for an active trial", async () => {
    const free = await makeUser("camp-free@example.com");
    expect(await canUseFeature(free.id, "fight_camp")).toBe(false);
    await expect(
      saveFightCampForUser(
        free.id,
        { fightDate: "2026-10-15", weightClass: "", discipline: "mma" },
        NOW,
        ZONE,
      ),
    ).rejects.toMatchObject({ code: "PLAN", message: expect.stringMatching(/Paid plans coming soon/) });

    const trial = await makeUser("camp-trial@example.com");
    await startTrialForUser(trial.id, NOW);
    expect(await canUseFeature(trial.id, "fight_camp", NOW)).toBe(true);
    await saveFightCampForUser(
      trial.id,
      { fightDate: "2026-12-27", weightClass: "170 lb class", discipline: "mma" },
      NOW,
      ZONE,
    );
    const early = await getActiveCampSnapshot(trial.id, NOW, ZONE);
    expect(early?.templateWeeks).toBe(12);
    expect(early?.phase).toBe("pre-camp");

    await saveFightCampForUser(
      trial.id,
      { fightDate: "2026-10-15", weightClass: "", discipline: "boxing" },
      NOW,
      ZONE,
    );
    const built = await getActiveCampSnapshot(trial.id, NOW, ZONE);
    expect(built?.templateWeeks).toBe(6);
    expect(built?.daysToFight).toBe(18);
    expect(built?.weekNumber).toBe(4);
    expect(built?.phase).toBe("build");
    expect(built?.disciplineLabel).toBe("Boxing");

    await cancelFightCampForUser(trial.id, NOW);
    expect(await getActiveCampSnapshot(trial.id, NOW, ZONE)).toBeNull();
  });

  it("drops access when the trial ends and rejects a past date or a calorie class", async () => {
    const user = await makeUser("camp-ended@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { trialEndsAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    expect(await canUseFeature(user.id, "fight_camp", NOW)).toBe(false);
    await expect(
      saveFightCampForUser(
        user.id,
        { fightDate: "2026-10-15", weightClass: "", discipline: "" },
        NOW,
        ZONE,
      ),
    ).rejects.toBeInstanceOf(AppError);

    const trial = await makeUser("camp-rules@example.com");
    await startTrialForUser(trial.id, NOW);
    await expect(
      saveFightCampForUser(
        trial.id,
        { fightDate: "2026-09-01", weightClass: "", discipline: "" },
        NOW,
        ZONE,
      ),
    ).rejects.toMatchObject({ code: "CAMP" });
    await expect(
      saveFightCampForUser(
        trial.id,
        { fightDate: "2026-10-15", weightClass: "2200 kcal", discipline: "" },
        NOW,
        ZONE,
      ),
    ).rejects.toMatchObject({ code: "CAMP" });
  });

  it("lets a Performance subscription build a camp", async () => {
    const user = await makeUser("camp-pro@example.com");
    const periodEnd = new Date("2026-12-01T00:00:00.000Z");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: periodEnd,
        source: "admin",
      },
    });
    expect(await canUseFeature(user.id, "fight_camp", NOW)).toBe(true);
    await saveFightCampForUser(
      user.id,
      { fightDate: "2026-10-15", weightClass: "Lightweight", discipline: "kickboxing" },
      NOW,
      ZONE,
    );
    const camp = await getActiveCampSnapshot(user.id, NOW, ZONE);
    expect(camp?.weightClass).toBe("Lightweight");
    expect(camp?.phase).toBe("build");
  });
});
