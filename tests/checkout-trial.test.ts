import { describe, expect, it } from "vitest";
import {
  accountTrialAlreadyUsed,
  checkoutTrialPeriodDays,
  checkoutTrialSpec,
  nonmemberTrialReminderStage,
  STRIPE_MIN_TRIAL_END_MS,
  stripeWholeTrialDays,
} from "@/lib/checkout-trial";

const DAY = 24 * 60 * 60 * 1000;

function carriedDays(input: {
  plan?: "performance_monthly" | "performance_year" | "coaching_monthly";
  verified?: boolean;
  ends: Date;
  now: Date;
}) {
  return checkoutTrialSpec({
    plan: input.plan ?? "performance_monthly",
    verified: input.verified ?? false,
    trialAlreadyUsed: true,
    trialEndsAt: input.ends,
    now: input.now,
  });
}

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

  it("carries an active in-app trial that is more than 48 hours out as whole days", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const ends = new Date(now.getTime() + 5 * DAY);
    expect(carriedDays({ ends, now })).toEqual({ kind: "days", days: 5 });
  });

  it("shows 7 days for a fresh trial and 14 for a fresh academy trial", () => {
    const started = new Date("2026-11-15T16:02:00.000Z");
    const now = new Date(started.getTime() + 4 * 60 * 1000);
    const seven = carriedDays({ ends: new Date(started.getTime() + 7 * DAY), now });
    const fourteen = carriedDays({
      verified: true,
      ends: new Date(started.getTime() + 14 * DAY),
      now: new Date(started.getTime() + 6 * 60 * 1000),
    });
    expect(seven).toEqual({ kind: "days", days: 7 });
    expect(fourteen).toEqual({ kind: "days", days: 14 });
    expect(stripeWholeTrialDays(7 * DAY - 4 * 60 * 1000)).toBe(7);
    expect(stripeWholeTrialDays(14 * DAY - 6 * 60 * 1000)).toBe(14);
  });

  it("rounds 3.5 days up to 4 without adding a full extra day", () => {
    const now = new Date("2026-11-15T12:00:00.000Z");
    const ends = new Date(now.getTime() + 3.5 * DAY);
    const spec = carriedDays({ plan: "performance_year", ends, now });
    expect(spec).toEqual({ kind: "days", days: 4 });
    if (spec.kind !== "days") return;
    const stripeEnd = now.getTime() + spec.days * DAY;
    expect(stripeEnd).toBeGreaterThanOrEqual(ends.getTime());
    expect(stripeEnd - ends.getTime()).toBeLessThan(DAY);
  });

  it("rounds just over 48 hours up to 3 days, still under one extra day", () => {
    const now = new Date("2026-11-15T12:00:00.000Z");
    const ends = new Date(now.getTime() + STRIPE_MIN_TRIAL_END_MS + 60 * 1000);
    const spec = carriedDays({ ends, now });
    expect(spec).toEqual({ kind: "days", days: 3 });
    if (spec.kind !== "days") return;
    expect(now.getTime() + spec.days * DAY - ends.getTime()).toBeLessThan(DAY);
  });

  it("bills now at 48 hours or less, and never trials VIP", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const soon = new Date(now.getTime() + 30 * 60 * 60 * 1000);
    const atMinimum = new Date(now.getTime() + STRIPE_MIN_TRIAL_END_MS);
    expect(carriedDays({ ends: soon, now })).toEqual({ kind: "none" });
    expect(carriedDays({ ends: atMinimum, now })).toEqual({ kind: "none" });
    expect(stripeWholeTrialDays(STRIPE_MIN_TRIAL_END_MS)).toBeNull();
    expect(stripeWholeTrialDays(47 * 60 * 60 * 1000)).toBeNull();
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
