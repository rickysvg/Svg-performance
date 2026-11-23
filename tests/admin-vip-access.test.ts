import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { isDashboardAdminAccount, reminderEmailKey } from "@/lib/admin-emails";
import { canUseMemberTools } from "@/lib/access";
import { canUseFeature, getEffectivePlanId } from "@/lib/entitlements";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import { setMailSenderForTests } from "@/lib/mail";
import { runMemberProReminderCron } from "@/lib/member-pro-reminders";
import { runNonmemberTrialReminderCron } from "@/lib/nonmember-trial-reminders";
import { addTrialDays, ensureMemberProMonth } from "@/lib/trial";
import { makeUser, resetDatabase } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const originalAdminEmails = process.env.ADMIN_EMAILS;
const originalSmtpHost = process.env.SMTP_HOST;

function restoreEnv(name: "ADMIN_EMAILS" | "SMTP_HOST", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function endTrial(userId: string) {
  const ended = addTrialDays(new Date(), -1);
  await prisma.profile.update({
    where: { userId },
    data: {
      trialStartedAt: addTrialDays(ended, -7),
      trialEndsAt: ended,
      gymMembershipVerified: false,
      memberProStartedAt: null,
    },
  });
}

describe("admin VIP access and reminder silence", () => {
  beforeEach(async () => {
    await resetDatabase();
    process.env.ADMIN_EMAILS = "Owner@SVG.example";
    restoreEnv("SMTP_HOST", originalSmtpHost);
    setMailSenderForTests(null);
  });

  afterEach(() => {
    restoreEnv("ADMIN_EMAILS", originalAdminEmails);
    restoreEnv("SMTP_HOST", originalSmtpHost);
    setMailSenderForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps plus-aliases off the admin list", () => {
    expect(reminderEmailKey("Owner+QA@SVG.example")).toBe("owner@svg.example");
    expect(isDashboardAdminAccount({ role: "member", email: "owner+qa@svg.example" })).toBe(false);
    expect(isDashboardAdminAccount({ role: "member", email: "owner@svg.example" })).toBe(true);
    expect(isDashboardAdminAccount({ role: "admin", email: "other@example.com" })).toBe(true);
    expect(isFormCheckReviewer({ role: "member", email: "owner+qa@svg.example" })).toBe(false);
  });

  it("gives role admins and ADMIN_EMAILS VIP Coaching after the trial, and leaves aliases on the normal plan", async () => {
    const admin = await makeUser("desk-admin@example.com", false, "admin");
    const owner = await makeUser("Owner@SVG.example");
    const ownerAlias = await makeUser("Owner+QA@SVG.example");
    const adminAlias = await makeUser("desk-admin+qa@example.com");
    const coach = await makeUser("coach-locked@example.com", false, "coach");
    for (const user of [admin, owner, ownerAlias, adminAlias, coach]) {
      await endTrial(user.id);
    }

    expect(await getEffectivePlanId(admin.id)).toBe("coaching");
    expect(await getEffectivePlanId(owner.id)).toBe("coaching");
    expect(await canUseFeature(admin.id, "form_check")).toBe(true);
    expect(await canUseFeature(owner.id, "coaching")).toBe(true);
    expect((await canUseMemberTools(admin.id)).allowed).toBe(true);
    expect((await canUseMemberTools(owner.id)).reason).toBe("subscribed");

    expect(await getEffectivePlanId(ownerAlias.id)).toBe("member_access");
    expect(await getEffectivePlanId(adminAlias.id)).toBe("member_access");
    expect(await getEffectivePlanId(coach.id)).toBe("member_access");
    expect((await canUseMemberTools(ownerAlias.id))).toEqual({ allowed: false, reason: "paywall" });
    expect(await canUseFeature(ownerAlias.id, "training")).toBe(false);

    await prisma.subscription.create({
      data: {
        userId: admin.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: addTrialDays(new Date(), 20),
      },
    });
    await prisma.subscription.create({
      data: {
        userId: ownerAlias.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: addTrialDays(new Date(), 20),
      },
    });
    expect(await getEffectivePlanId(admin.id)).toBe("coaching");
    expect(await getEffectivePlanId(ownerAlias.id)).toBe("performance");
    expect((await canUseMemberTools(ownerAlias.id)).allowed).toBe(true);
  });

  it("skips trial emails for admins and their plus-aliases, and still mails a normal nonmember", async () => {
    const now = new Date("2026-11-10T18:00:00.000Z");
    const guest = await makeUser("trial-guest@example.com");
    const admin = await makeUser("Desk-Admin@Example.com", false, "admin");
    const adminAlias = await makeUser("Desk-Admin+QA@Example.com");
    const owner = await makeUser("Owner@SVG.example");
    const ownerAlias = await makeUser("Owner+QA@SVG.example");
    const trialEndsAt = new Date(now.getTime() + DAY);
    for (const user of [guest, admin, adminAlias, owner, ownerAlias]) {
      await prisma.profile.update({
        where: { userId: user.id },
        data: {
          gymMembershipVerified: false,
          memberProStartedAt: null,
          trialStartedAt: new Date(now.getTime() - 6 * DAY),
          trialEndsAt,
          timeZone: "America/Denver",
        },
      });
    }

    const sent: string[] = [];
    process.env.SMTP_HOST = "smtp.test.local";
    setMailSenderForTests(async (input) => {
      sent.push(input.to);
      return { sent: true, reason: "sent" };
    });

    const result = await runNonmemberTrialReminderCron(now);
    expect(result.email).toBe("attempted");
    expect(result.checked).toBe(5);
    expect(result.sent).toBe(1);
    expect(sent).toEqual([guest.email]);

    const logs = await prisma.memberProReminderLog.findMany();
    expect(logs.map((row) => row.userId)).toEqual([guest.id]);
    expect(logs[0]?.stage).toBe("nonmember_1d");
    expect(logs[0]?.channel).toBe("email");
  });

  it("skips member Pro pushes for admins and their plus-aliases", async () => {
    const start = new Date("2026-10-01T15:00:00.000Z");
    const fiveLeft = new Date(start.getTime() + 8 * DAY + 3600_000);
    const member = await makeUser("member-remind@example.com");
    const admin = await makeUser("Desk-Admin@Example.com", false, "admin");
    const adminAlias = await makeUser("Desk-Admin+QA@Example.com");
    const owner = await makeUser("Owner@SVG.example");
    const ownerAlias = await makeUser("Owner+QA@SVG.example");
    for (const user of [member, admin, adminAlias, owner, ownerAlias]) {
      await prisma.profile.update({
        where: { userId: user.id },
        data: { gymMembershipVerified: true },
      });
      await ensureMemberProMonth(user.id, start);
    }

    const result = await runMemberProReminderCron(fiveLeft);
    expect(result.checked).toBe(5);
    expect(result.sent).toBe(1);

    const logs = await prisma.memberProReminderLog.findMany();
    expect(logs.map((row) => row.userId)).toEqual([member.id]);
    expect(logs[0]?.stage).toBe("day25");
    expect(logs[0]?.channel).toBe("push");
  });
});
