import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { billingSuccessPlan } from "@/lib/billing-success";
import { assertLoggingOpen } from "@/lib/log-access";
import { PLAN_CATALOG } from "@/lib/plans";
import { nonmemberTrialReminderStage } from "@/lib/checkout-trial";
import { trialDaysRemaining } from "@/lib/subscription-copy";
import { HomeToday } from "@/components/home/HomeToday";
import {
  currentPlanLine,
  isTrialActive,
  startTrialForUser,
  trialDaysLeft,
  trialEndedSummary,
} from "@/lib/trial";

const DENVER = "America/Denver";
/** Nov 14, 11pm Denver (MST). */
const END = new Date("2026-11-15T06:00:00.000Z");
/** Nov 14, 9am Denver. Same local day, trial still running. */
const MORNING = new Date("2026-11-14T16:00:00.000Z");
/** Nov 15, 12:30am Denver. The end instant has passed. */
const AFTER = new Date("2026-11-15T07:30:00.000Z");

describe("billing success plan line", () => {
  it("uses the real plan and never labels an incomplete VIP checkout as the plan", () => {
    const incomplete = { plan: "coaching", status: "incomplete" as const, currentPeriodEnd: null };
    expect(
      billingSuccessPlan({
        sessionId: "",
        synced: false,
        trialActive: false,
        trialDaysLeft: 0,
        trialLengthDays: 7,
        planLabel: "Trial ended",
        subscription: incomplete,
      }),
    ).toEqual({ planLine: "Trial ended", confirming: false });

    const fresh = billingSuccessPlan({
      sessionId: "cs_live",
      synced: true,
      trialActive: false,
      trialDaysLeft: 0,
      planLabel: "Trial ended",
      subscription: incomplete,
    });
    expect(fresh.confirming).toBe(true);
    expect(fresh.planLine).toBe("Trial ended");
    expect(fresh.planLine).not.toMatch(/VIP|Incomplete/i);

    const active = billingSuccessPlan({
      sessionId: "cs_live",
      synced: true,
      trialActive: false,
      trialDaysLeft: 0,
      planLabel: "Trial ended",
      subscription: {
        plan: "performance",
        status: "active",
        currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      },
    });
    expect(active.confirming).toBe(false);
    expect(active.planLine).toContain("SVG Pro");
  });

  it("does not hard-code a waiting label on the success page", () => {
    const page = readFileSync("src/app/billing/success/page.tsx", "utf8");
    expect(page).toContain("billingSuccessPlan");
    expect(page).toContain("getEffectivePlanId");
    expect(page).toContain("PLAN_CATALOG");
    expect(page).not.toContain("waiting on Stripe");
    expect(page).toContain("BillingPlanStatus");
  });
});

describe("trial days and trial ended", () => {
  it("does not say 1 day left on the local day the trial ends", () => {
    expect(isTrialActive(END, MORNING)).toBe(true);
    expect(trialDaysLeft(END, MORNING)).toBe(1);
    expect(trialDaysRemaining(END, MORNING, DENVER)).toBe(0);
    expect(nonmemberTrialReminderStage(trialDaysRemaining(END, MORNING, DENVER))).toBeNull();
    expect(
      currentPlanLine({
        trialActive: true,
        trialDaysLeft: trialDaysRemaining(END, MORNING, DENVER),
        trialLengthDays: 7,
        planLabel: "Trial ended",
        timeZone: DENVER,
      }),
    ).toBe("7-day Pro trial, ends today");

    expect(isTrialActive(END, AFTER)).toBe(false);
    expect(trialDaysRemaining(END, AFTER, DENVER)).toBe(0);
    expect(
      currentPlanLine({
        trialActive: false,
        trialDaysLeft: 0,
        trialLengthDays: 7,
        planLabel: "Trial ended",
      }),
    ).toBe("Trial ended");
  });

  it("still counts a full day when the end date is tomorrow", () => {
    const dayBefore = new Date("2026-11-14T06:00:00.000Z");
    expect(trialDaysRemaining(END, dayBefore, DENVER)).toBe(1);
    expect(nonmemberTrialReminderStage(1)).toBe("1d");
  });
});

describe("expired trial copy and home logging", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("matches the paywall: history stays visible and downloads stay off", () => {
    expect(PLAN_CATALOG.member_access.summary).toMatch(/Downloads stay off/);
    expect(PLAN_CATALOG.member_access.summary).not.toMatch(/export/i);
    expect(PLAN_CATALOG.member_access.includes.join(" ")).not.toMatch(/export/i);
    const summary = trialEndedSummary({
      trialLengthDays: 7,
      trialEndsAt: END,
      timeZone: DENVER,
    });
    expect(summary).toContain("Your 7-day Pro trial ended Nov 14");
    expect(summary).toContain("History and progress stay visible");
    expect(summary).toContain("Downloads stay off");
    expect(summary).not.toMatch(/export/i);
  });

  it("rejects log writes for a locked member and allows a trial or staff", async () => {
    const locked = await makeUser("locked-log@example.com");
    await expect(assertLoggingOpen(locked)).rejects.toMatchObject({ code: "PAYWALL" });
    const trialUser = await makeUser("trial-log@example.com");
    await startTrialForUser(trialUser.id);
    await expect(assertLoggingOpen(trialUser)).resolves.toBeUndefined();
    const admin = await makeUser("admin-log@example.com", false, "admin");
    await expect(assertLoggingOpen(admin)).resolves.toBeUndefined();
    const action = readFileSync("src/app/actions/outside-log.ts", "utf8");
    expect(action).toContain("assertLoggingOpen");
    const home = readFileSync("src/app/(member)/home/page.tsx", "utf8");
    expect(home).toContain("trialEnded ? null");
    expect(home).toContain("LogPastWorkoutButton");
    expect(home).toContain("SparringLogForm");
  });

  it("hides resume and log links on a locked rest day", () => {
    const html = renderToStaticMarkup(
      createElement(HomeToday, {
        locked: true,
        guide: {
          today: {
            plannedSessions: [],
            nextSession: null,
            nextSessionWeekday: "",
            completedDayIds: [],
            resumeByDay: { custom: { id: "custom-1", partial: false } },
          },
        },
      } as never),
    );
    expect(html).toContain("Rest day");
    expect(html).toContain("Subscribe");
    expect(html).not.toContain("Resume");
    expect(html).not.toContain("Log a workout");
    expect(html).not.toContain("/training/log");
  });
});
