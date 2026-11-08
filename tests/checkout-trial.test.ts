import { describe, expect, it } from "vitest";
import {
  accountTrialAlreadyUsed,
  checkoutTrialPeriodDays,
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

  it("reminds a nonmember 2 days and 1 day before the no-card trial ends", () => {
    expect(nonmemberTrialReminderStage(3)).toBeNull();
    expect(nonmemberTrialReminderStage(2)).toBe("2d");
    expect(nonmemberTrialReminderStage(1)).toBe("1d");
    expect(nonmemberTrialReminderStage(0)).toBeNull();
  });
});
