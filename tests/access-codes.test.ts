import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { registerAccount } from "@/lib/auth";
import { getLatestSubscription } from "@/lib/access";
import { applyStripeEvent } from "@/lib/billing";
import { canUseFeature, getEffectivePlanId } from "@/lib/entitlements";
import { revenueSnapshot } from "@/lib/admin-dashboard";
import { ensureMemberProMonth, startTrialForUser } from "@/lib/trial";
import {
  createProAccessCode,
  listProAccessCodes,
  redeemProAccessCode,
  revokeProAccessCode,
} from "@/lib/access-codes";

const CODE_SHAPE = /^SVG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

async function trialFields(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
    select: { trialStartedAt: true, trialEndsAt: true, memberProStartedAt: true },
  });
}

describe("Pro access codes", () => {
  const previousAdmins = process.env.ADMIN_EMAILS;

  beforeEach(async () => {
    await resetDatabase();
    delete process.env.ADMIN_EMAILS;
  });

  afterAll(async () => {
    if (previousAdmins === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousAdmins;
    await prisma.$disconnect();
  });

  it("lets role admins and ADMIN_EMAILS create a one-time code", async () => {
    const member = await makeUser("fan@example.com");
    await expect(
      createProAccessCode({ actor: member, durationDays: 30 }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    process.env.ADMIN_EMAILS = "Ricky@SVG.example";
    const ricky = await makeUser("ricky@svg.example");
    const created = await createProAccessCode({
      actor: ricky,
      label: "Alex Rivera",
      emailLock: "Alex@SVG.example",
      durationDays: 90,
    });
    expect(created.code).toMatch(CODE_SHAPE);
    expect(created.emailLock).toBe("alex@svg.example");
    const [listed] = await listProAccessCodes();
    expect(listed).toMatchObject({
      code: created.code,
      label: "Alex Rivera",
      status: "unused",
      durationDays: 90,
    });

    const other = await makeUser("other@example.com");
    await expect(
      redeemProAccessCode({ userId: other.id, email: other.email, code: created.code, skipRateLimit: true }),
    ).rejects.toMatchObject({ message: "That code can only be used by the email it was created for." });
    expect((await prisma.proAccessCode.findUnique({ where: { id: created.id } }))?.redeemedAt).toBeNull();

    const fighter = await makeUser("alex@svg.example");
    await redeemProAccessCode({
      userId: fighter.id,
      email: "Alex@SVG.example",
      code: `  ${created.code.toLowerCase()}  `,
      skipRateLimit: true,
    });
    await expect(
      redeemProAccessCode({ userId: other.id, email: other.email, code: created.code, skipRateLimit: true }),
    ).rejects.toMatchObject({ message: "That code is not valid." });

    const sub = await getLatestSubscription(fighter.id);
    expect(sub?.source).toBe("access_code");
    expect(sub?.status).toBe("active");
    expect(await getEffectivePlanId(fighter.id)).toBe("performance");
    const daysLeft = (sub!.currentPeriodEnd!.getTime() - Date.now()) / 86_400_000;
    expect(daysLeft).toBeGreaterThan(89);
    expect(daysLeft).toBeLessThan(91);
    expect(await trialFields(fighter.id)).toMatchObject({
      trialStartedAt: null,
      trialEndsAt: null,
      memberProStartedAt: null,
    });
    expect((await listProAccessCodes())[0]).toMatchObject({
      status: "redeemed",
      redeemedByEmail: "alex@svg.example",
    });
  });

  it("grants Pro with no end date and keeps it off paid revenue", async () => {
    const admin = await makeUser("owner@example.com", false, "admin");
    const fighter = await makeUser("open@example.com");
    const created = await createProAccessCode({ actor: admin, durationDays: null, label: "Camp" });
    await redeemProAccessCode({
      userId: fighter.id,
      email: fighter.email,
      code: created.code,
      skipRateLimit: true,
    });
    const sub = await getLatestSubscription(fighter.id);
    expect(sub?.currentPeriodEnd).toBeNull();
    expect(await getEffectivePlanId(fighter.id, new Date("2035-01-01T00:00:00.000Z"))).toBe("performance");
    expect(
      revenueSnapshot({
        subscriptions: [
          {
            userId: fighter.id,
            plan: sub!.plan,
            status: sub!.status,
            currentPeriodEnd: sub!.currentPeriodEnd,
            source: sub!.source,
          },
        ],
        profiles: [{ userId: fighter.id, trialEndsAt: null, trialStartedAt: null }],
      }).activePro,
    ).toBe(0);
  });

  it("does not start the trial, and expiry falls back to academy or view-only", async () => {
    const admin = await makeUser("grant-admin@example.com", false, "admin");
    const member = await makeUser("academy-fighter@example.com", true);
    await prisma.profile.update({
      where: { userId: member.id },
      data: { gymMembershipVerified: true },
    });
    const created = await createProAccessCode({ actor: admin, durationDays: 30 });
    await redeemProAccessCode({
      userId: member.id,
      email: member.email,
      code: created.code,
      skipRateLimit: true,
    });
    await expect(startTrialForUser(member.id)).rejects.toMatchObject({ code: "ACCESS_CODE" });
    expect(await trialFields(member.id)).toMatchObject({
      trialStartedAt: null,
      trialEndsAt: null,
      memberProStartedAt: null,
    });

    const past = new Date(Date.now() - 60_000);
    await prisma.subscription.updateMany({
      where: { userId: member.id, source: "access_code" },
      data: { currentPeriodEnd: past },
    });
    await prisma.proAccessCode.update({ where: { id: created.id }, data: { expiresAt: past } });
    expect(await getEffectivePlanId(member.id)).toBe("academy");
    expect(await canUseFeature(member.id, "training")).toBe(true);
    expect(await canUseFeature(member.id, "ai")).toBe(false);
    await ensureMemberProMonth(member.id);
    expect(await trialFields(member.id)).toMatchObject({
      trialStartedAt: null,
      trialEndsAt: null,
      memberProStartedAt: null,
    });

    const guest = await makeUser("guest-fighter@example.com");
    const guestCode = await createProAccessCode({ actor: admin, durationDays: 180 });
    await redeemProAccessCode({
      userId: guest.id,
      email: guest.email,
      code: guestCode.code,
      skipRateLimit: true,
    });
    await prisma.subscription.updateMany({
      where: { userId: guest.id },
      data: { currentPeriodEnd: past },
    });
    await prisma.proAccessCode.update({ where: { id: guestCode.id }, data: { expiresAt: past } });
    expect(await getEffectivePlanId(guest.id)).toBe("member_access");
    expect(await canUseFeature(guest.id, "training")).toBe(false);
    expect(await canUseFeature(guest.id, "progress")).toBe(true);
    await startTrialForUser(guest.id);
    expect((await trialFields(guest.id))?.trialEndsAt).toBeTruthy();
    expect(await getEffectivePlanId(guest.id)).toBe("performance");
  });

  it("removes Pro at once when a redeemed code is revoked", async () => {
    const admin = await makeUser("revoke-admin@example.com", false, "admin");
    const fighter = await makeUser("revoke-fighter@example.com");
    const created = await createProAccessCode({ actor: admin, durationDays: 30 });
    await redeemProAccessCode({
      userId: fighter.id,
      email: fighter.email,
      code: created.code,
      skipRateLimit: true,
    });
    await revokeProAccessCode({ actor: admin, codeId: created.id });
    expect(await getEffectivePlanId(fighter.id)).toBe("member_access");
    expect((await getLatestSubscription(fighter.id))?.status).toBe("canceled");
    expect((await listProAccessCodes())[0]?.status).toBe("revoked");
    expect(await trialFields(fighter.id)).toMatchObject({ trialStartedAt: null, trialEndsAt: null });
  });

  it("lets a later paid subscription take over without using a second grant", async () => {
    const admin = await makeUser("paid-admin@example.com", false, "admin");
    const fighter = await makeUser("paid-fighter@example.com");
    await applyStripeEvent({
      id: "evt_already_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_already",
          metadata: { userId: fighter.id, plan: "performance_monthly" },
          subscription: "sub_already",
          current_period_end: Math.floor(Date.now() / 1000) + 20 * 86_400,
        },
      },
    });
    const blocked = await createProAccessCode({ actor: admin, durationDays: 30 });
    await expect(
      redeemProAccessCode({
        userId: fighter.id,
        email: fighter.email,
        code: blocked.code,
        skipRateLimit: true,
      }),
    ).rejects.toMatchObject({ message: "This account already has Pro. The code was not used." });
    expect((await prisma.proAccessCode.findUnique({ where: { id: blocked.id } }))?.redeemedAt).toBeNull();
    expect((await getLatestSubscription(fighter.id))?.stripeSubscriptionId).toBe("sub_already");

    const buyer = await makeUser("buyer@example.com");
    const code = await createProAccessCode({ actor: admin, durationDays: 30 });
    await redeemProAccessCode({
      userId: buyer.id,
      email: buyer.email,
      code: code.code,
      skipRateLimit: true,
    });
    await applyStripeEvent({
      id: "evt_code_takeover",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_takeover",
          metadata: { userId: buyer.id, plan: "performance_monthly" },
          subscription: "sub_takeover",
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400,
        },
      },
    });
    const latest = await getLatestSubscription(buyer.id);
    expect(latest?.source).toBe("webhook");
    expect(latest?.stripeSubscriptionId).toBe("sub_takeover");
    expect(await getEffectivePlanId(buyer.id)).toBe("performance");
    expect(await prisma.subscription.count({ where: { userId: buyer.id } })).toBe(2);

    await revokeProAccessCode({ actor: admin, codeId: code.id });
    expect((await getLatestSubscription(buyer.id))?.stripeSubscriptionId).toBe("sub_takeover");
    expect(await getEffectivePlanId(buyer.id)).toBe("performance");
    const rows = await prisma.subscription.findMany({ where: { userId: buyer.id } });
    expect(revenueSnapshot({
      subscriptions: rows.map((row) => ({
        userId: row.userId,
        plan: row.plan,
        status: row.status,
        currentPeriodEnd: row.currentPeriodEnd,
        source: row.source,
      })),
      profiles: [],
    }).activePro).toBe(1);
  });

  it("redeems at signup without starting a trial, and rejects a bad code before the account exists", async () => {
    const admin = await makeUser("signup-admin@example.com", false, "admin");
    const created = await createProAccessCode({
      actor: admin,
      durationDays: 30,
      emailLock: "new-fighter@example.com",
    });
    await expect(
      registerAccount({
        email: "new-fighter@example.com",
        password: "password12",
        displayName: "New",
        isAdultConfirmed: true,
        claimsGymMembership: false,
        accessCode: "SVG-AAAA-AAAA",
      }),
    ).rejects.toMatchObject({ message: "That code is not valid." });
    expect(await prisma.user.findUnique({ where: { email: "new-fighter@example.com" } })).toBeNull();

    const user = await registerAccount({
      email: "new-fighter@example.com",
      password: "password12",
      displayName: "New",
      isAdultConfirmed: true,
      claimsGymMembership: false,
      accessCode: created.code,
    });
    expect(await getEffectivePlanId(user.id)).toBe("performance");
    expect((await getLatestSubscription(user.id))?.source).toBe("access_code");
    expect(await trialFields(user.id)).toMatchObject({
      trialStartedAt: null,
      trialEndsAt: null,
      memberProStartedAt: null,
    });
  });

  it("rate-limits redeem attempts", async () => {
    const fighter = await makeUser("limit@example.com");
    for (let i = 0; i < 8; i += 1) {
      await expect(
        redeemProAccessCode({ userId: fighter.id, email: fighter.email, code: "nope" }),
      ).rejects.toMatchObject({ code: "ACCESS_CODE" });
    }
    await expect(
      redeemProAccessCode({ userId: fighter.id, email: fighter.email, code: "nope" }),
    ).rejects.toMatchObject({ code: "RATE" });
  });
});
