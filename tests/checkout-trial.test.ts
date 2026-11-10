import { describe, expect, it } from "vitest";
import {
  accountTrialAlreadyUsed,
  checkoutTrialPeriodDays,
  checkoutTrialSpec,
  nonmemberTrialReminderStage,
} from "@/lib/checkout-trial";

describe("one trial per person", () => {
  it("gives a new member 7 days and an academy member 14 at checkout", () => {
    expect(
      checkoutTrialPeriodDays({ plan: "performance_monthly", verified: false, trialAlreadyUsed: false }),
    ).toBe(7);
    expect(
      checkoutTrialPeriodDays({ plan: "performance_year", verified: true, trialAlreadyUsed: false }),
    ).toBe(14);
  });

  it("bills VIP and anyone who already started a trial", () => {
    expect(
      checkoutTrialPeriodDays({ plan: "coaching_monthly", verified: false, trialAlreadyUsed: false }),
    ).toBeUndefined();
    expect(
      checkoutTrialPeriodDays({ plan: "performance_monthly", verified: false, trialAlreadyUsed: true }),
    ).toBeUndefined();
    expect(
      checkoutTrialPeriodDays({ plan: "performance_year", verified: true, trialAlreadyUsed: true }),
    ).toBeUndefined();
  });

  it("treats any started clock, including after cancel, as used", () => {
    expect(accountTrialAlreadyUsed({})).toBe(false);
    expect(accountTrialAlreadyUsed({ trialStartedAt: new Date() })).toBe(true);
    expect(accountTrialAlreadyUsed({ trialEndsAt: new Date(0) })).toBe(true);
    expect(accountTrialAlreadyUsed({ memberProStartedAt: new Date() })).toBe(true);
    expect(accountTrialAlreadyUsed({ proTrialUsedAt: new Date() })).toBe(true);
    expect(accountTrialAlreadyUsed({ stripeTrialSeen: true })).toBe(true);
  });

  it("carries an active in-app trial that is more than 48 hours out", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const ends = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const spec = checkoutTrialSpec({
      plan: "performance_monthly",
      verified: false,
      trialAlreadyUsed: true,
      trialEndsAt: ends,
      now,
    });
    expect(spec).toEqual({ kind: "end", trialEnd: ends });
  });

  it("bills now when fewer than 48 hours remain, and never trials VIP", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const soon = new Date(now.getTime() + 30 * 60 * 60 * 1000);
    expect(
      checkoutTrialSpec({
        plan: "performance_monthly",
        verified: false,
        trialAlreadyUsed: true,
        trialEndsAt: soon,
        now,
      }),
    ).toEqual({ kind: "none" });
    expect(
      checkoutTrialSpec({
        plan: "performance_year",
        verified: false,
        trialAlreadyUsed: true,
        trialEndsAt: new Date(now.getTime() - 1000),
        now,
      }),
    ).toEqual({ kind: "none" });
    expect(
      checkoutTrialSpec({
        plan: "coaching_monthly",
        verified: false,
        trialAlreadyUsed: false,
        trialEndsAt: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        now,
      }),
    ).toEqual({ kind: "none" });
  });

  it("reminds a nonmember 2 days and 1 day before the no-card trial ends", () => {
    expect(nonmemberTrialReminderStage(3)).toBeNull();
    expect(nonmemberTrialReminderStage(2)).toBe("2d");
    expect(nonmemberTrialReminderStage(1)).toBe("1d");
    expect(nonmemberTrialReminderStage(0)).toBeNull();
  });
});
