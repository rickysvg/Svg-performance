import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AiCapError, consumeAiUse, getAiAllowance } from "@/lib/ai-usage";
import { getAppTier, getEffectivePlanId } from "@/lib/entitlements";
import { canUseCoachChat, freeCoachChatLabel, getCoachChatAccess } from "@/lib/coach-access";
import { coachStreamForTest } from "@/app/api/coach/stream/route";
import { coachStreamResponse } from "@/lib/coach/stream";
import { PLAN_CATALOG } from "@/lib/plans";
import { ensureMemberProMonth, getTrialState, memberProDay, startTrialForUser } from "@/lib/trial";
import { memberProCopy, memberProStage, runMemberProReminderCron } from "@/lib/member-pro-reminders";
import { isOpenWhenLocked } from "@/lib/locked-paths";
import {
  ACADEMY_AI_MESSAGES_PER_WEEK,
  PERFORMANCE_ANNUAL,
  PERFORMANCE_MONTHLY,
  PRO_AI_MESSAGES_PER_DAY,
} from "@/lib/pricing";
import { makeUser, resetDatabase } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

async function verify(userId: string) {
  await prisma.profile.update({ where: { userId }, data: { gymMembershipVerified: true } });
}

describe("Pro tiers, member Pro month, and AI caps", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses the approved prices", () => {
    expect(PERFORMANCE_MONTHLY).toBe(9.99);
    expect(PERFORMANCE_ANNUAL).toBe(72.99);
  });

  it("gives nonmembers a 7-day Pro trial, then locks them (no free tier)", async () => {
    const guest = await makeUser("guest-tier@example.com");
    expect(await getAppTier(guest.id)).toBe("locked");
    const now = new Date();
    const trial = await startTrialForUser(guest.id, now);
    expect(trial.days).toBe(7);
    expect(await getAppTier(guest.id, now)).toBe("pro");
    expect(await getAppTier(guest.id, new Date(now.getTime() + 8 * DAY))).toBe("locked");
    expect(isOpenWhenLocked("/progress")).toBe(true);
    expect(isOpenWhenLocked("/profile")).toBe(true);
    expect(isOpenWhenLocked("/vip/apply")).toBe(true);
    expect(isOpenWhenLocked("/vip/checkout")).toBe(true);
    expect(isOpenWhenLocked("/home")).toBe(false);
    expect(isOpenWhenLocked("/training")).toBe(false);
    expect(isOpenWhenLocked("/coach")).toBe(true);
  });

  it("gives verified members Pro for 14 days, then the included academy tier", async () => {
    const member = await makeUser("member-tier@example.com");
    await verify(member.id);
    const start = new Date("2026-10-01T15:00:00.000Z");
    await ensureMemberProMonth(member.id, start);
    await ensureMemberProMonth(member.id, new Date(start.getTime() + DAY)); // no restart
    const profile = await prisma.profile.findUnique({ where: { userId: member.id } });
    expect(profile?.memberProStartedAt?.toISOString()).toBe(start.toISOString());
    expect(profile?.memberProDays).toBe(14);
    expect(await getEffectivePlanId(member.id, new Date(start.getTime() + 13 * DAY))).toBe("performance");
    expect(await getEffectivePlanId(member.id, new Date(start.getTime() + 14 * DAY + 1000))).toBe("academy");
    expect(memberProDay(start, new Date(start.getTime() + 8 * DAY))).toBe(9);
    expect(memberProStage(9, 14)).toBe("day25");
    expect(memberProStage(13, 14)).toBe("day29");
    expect(memberProStage(15, 14)).toBe("day31");
    expect(memberProStage(8, 14)).toBeNull();
    expect(memberProStage(25)).toBe("day25");
    expect(memberProStage(29)).toBe("day29");
    expect(memberProStage(31)).toBe("day31");
    expect(memberProStage(10)).toBeNull();
    const recap = { workouts: 6, checkIns: 2, aiMessages: 9 };
    expect(memberProCopy("day25", recap).body).toMatch(/6 workouts/);
    expect(memberProCopy("day29", recap).title).toMatch(/Last day/);
    expect(memberProCopy("day31", recap).cta).toMatch(/Upgrade to Pro/);
    expect(memberProCopy("day31", recap).body).toMatch(/30 days of history/);
    expect(memberProCopy("day31", recap).body).toMatch(/AI coach chat stays on Pro/);
    expect(memberProCopy("day31", recap).body).not.toMatch(/AI messages a week/);
    expect(memberProCopy("day31", recap).body).not.toMatch(/auto-bill/i);
  });

  it("leaves an already-started 30-day member Pro period on the old length", async () => {
    const member = await makeUser("legacy-pro@example.com");
    await verify(member.id);
    const start = new Date("2026-10-01T15:00:00.000Z");
    await prisma.profile.update({
      where: { userId: member.id },
      data: {
        memberProStartedAt: start,
        memberProDays: null,
        trialStartedAt: start,
        trialEndsAt: new Date(start.getTime() + 30 * DAY),
      },
    });
    await ensureMemberProMonth(member.id, new Date(start.getTime() + 20 * DAY));
    const profile = await prisma.profile.findUnique({ where: { userId: member.id } });
    expect(profile?.memberProDays).toBeNull();
    expect(profile?.memberProStartedAt?.toISOString()).toBe(start.toISOString());
    expect(profile?.trialEndsAt?.toISOString()).toBe(new Date(start.getTime() + 30 * DAY).toISOString());
    const during = await getTrialState(member.id, new Date(start.getTime() + 10 * DAY));
    expect(during.trialLengthDays).toBe(30);
    expect(during.trialActive).toBe(true);
    expect(await getEffectivePlanId(member.id, new Date(start.getTime() + 29 * DAY))).toBe("performance");
    expect(await getEffectivePlanId(member.id, new Date(start.getTime() + 30 * DAY + 1000))).toBe("academy");
    expect((await runMemberProReminderCron(new Date(start.getTime() + 8 * DAY))).sent).toBe(0);
    expect((await runMemberProReminderCron(new Date(start.getTime() + 24 * DAY + 3600_000))).sent).toBe(1);
  });

  it("sends each member Pro reminder once", async () => {
    const member = await makeUser("member-remind@example.com");
    await verify(member.id);
    const start = new Date("2026-10-01T15:00:00.000Z");
    await ensureMemberProMonth(member.id, start);
    const fiveLeft = new Date(start.getTime() + 8 * DAY + 3600_000);
    const first = await runMemberProReminderCron(fiveLeft);
    const again = await runMemberProReminderCron(fiveLeft);
    expect(first.sent).toBe(1);
    expect(again.sent).toBe(0);
    const day31 = new Date(start.getTime() + 14 * DAY + 3600_000);
    expect((await runMemberProReminderCron(day31)).sent).toBe(1);
    const logs = await prisma.memberProReminderLog.findMany({ where: { userId: member.id } });
    expect(logs.map((row) => row.stage).sort()).toEqual(["day25", "day31"]);
  });

  it("blocks academy coach chat and caps logger notes at 3 a week", async () => {
    const member = await makeUser("cap-member@example.com");
    await verify(member.id);
    // Month already used up: academy tier.
    await prisma.profile.update({
      where: { userId: member.id },
      data: { memberProStartedAt: new Date(Date.now() - 40 * DAY), trialEndsAt: new Date(Date.now() - 10 * DAY) },
    });
    await prisma.user.update({
      where: { id: member.id },
      data: { createdAt: new Date(Date.now() - 40 * DAY) },
    });
    expect(await getAppTier(member.id)).toBe("academy");
    expect(PLAN_CATALOG.academy.features).not.toContain("ai");
    expect(PLAN_CATALOG.academy.includes.join(" ")).not.toMatch(/AI coach/i);
    await expect(
      consumeAiUse({ userId: member.id, kind: "message", surface: "chat" }),
    ).rejects.toMatchObject({ reason: "locked", status: 402 });
    for (let i = 0; i < ACADEMY_AI_MESSAGES_PER_WEEK; i += 1) {
      await consumeAiUse({ userId: member.id, kind: "message", surface: "note" });
    }
    await expect(
      consumeAiUse({ userId: member.id, kind: "message", surface: "note" }),
    ).rejects.toMatchObject({ reason: "ai_limit", status: 402 });
    await expect(
      consumeAiUse({ userId: member.id, kind: "voice", surface: "speak", units: 10 }),
    ).rejects.toMatchObject({ reason: "voice" });
    await expect(
      consumeAiUse({ userId: member.id, kind: "read_aloud", surface: "today_summary" }),
    ).rejects.toMatchObject({ reason: "read_aloud" });
  });

  it("blocks the logger note AI reply over the cap but still saves the note", async () => {
    const member = await makeUser("note-cap@example.com");
    await verify(member.id);
    await prisma.profile.update({
      where: { userId: member.id },
      data: { memberProStartedAt: new Date(Date.now() - 40 * DAY), trialEndsAt: new Date(Date.now() - 10 * DAY) },
    });
    for (let i = 0; i < ACADEMY_AI_MESSAGES_PER_WEEK; i += 1) {
      await consumeAiUse({ userId: member.id, kind: "message", surface: "note" });
    }
    const user = { id: member.id, email: member.email, role: "member" as const };
    const result = (await coachStreamForTest(user, {
      kind: "note",
      message: "Elbow feels tight on the last set",
      exerciseName: "Bench press",
    })) as { status: number; paywall?: string };
    expect(result.status).toBe(402);
    expect(result.paywall).toBe("ai_limit");
    const notes = await prisma.exerciseNote.findMany({ where: { userId: member.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.aiReply ?? "").toBe("");
  });

  it("locks the note path for a nonmember after the trial", async () => {
    const guest = await makeUser("note-locked@example.com");
    const user = { id: guest.id, email: guest.email, role: "member" as const };
    const result = (await coachStreamForTest(user, {
      kind: "note",
      message: "How deep should I squat?",
      exerciseName: "Back squat",
    })) as { status: number; paywall?: string };
    expect(result.status).toBe(402);
    expect(result.paywall).toBe("locked");
  });

  it("gives Pro 30 AI messages, 20 voice minutes, and 1 read-aloud a day", async () => {
    const pro = await makeUser("pro-cap@example.com");
    await startTrialForUser(pro.id);
    const allowance = await getAiAllowance(pro.id);
    expect(allowance.tier).toBe("pro");
    expect(allowance.messagesLeft).toBe(PRO_AI_MESSAGES_PER_DAY);
    expect(allowance.voiceSecondsLeft).toBe(20 * 60);
    expect(allowance.readAloudsLeft).toBe(1);
    await consumeAiUse({ userId: pro.id, kind: "read_aloud", surface: "today_summary" });
    await expect(
      consumeAiUse({ userId: pro.id, kind: "read_aloud", surface: "today_summary" }),
    ).rejects.toBeInstanceOf(AiCapError);
    await consumeAiUse({ userId: pro.id, kind: "voice", surface: "speak", units: 20 * 60 });
    await expect(
      consumeAiUse({ userId: pro.id, kind: "voice", surface: "speak", units: 5 }),
    ).rejects.toMatchObject({ reason: "ai_daily_cap" });
  });

  it("returns 402 for academy and free coach chat, and lets Pro, VIP, and admins through", async () => {
    const academy = await makeUser("chat-academy@example.com");
    await verify(academy.id);
    await prisma.profile.update({
      where: { userId: academy.id },
      data: { memberProStartedAt: new Date(Date.now() - 40 * DAY), trialEndsAt: new Date(Date.now() - DAY) },
    });
    await prisma.user.update({
      where: { id: academy.id },
      data: { createdAt: new Date(Date.now() - 20 * DAY) },
    });
    const academyUser = { id: academy.id, email: academy.email, role: "member" as const };
    expect(await canUseCoachChat(academyUser)).toBe(false);
    const denied = await coachStreamForTest(academyUser, { kind: "chat", message: "How is my jab?" });
    expect(denied).toMatchObject({ status: 402, paywall: "locked" });
    const httpDenied = await coachStreamResponse(academyUser, { kind: "chat", message: "How is my jab?" });
    expect(httpDenied.status).toBe(402);
    expect(await httpDenied.json()).toMatchObject({ paywall: "locked" });
    expect(await prisma.chatMessage.count()).toBe(0);

    const free = await makeUser("chat-free@example.com");
    await prisma.user.update({
      where: { id: free.id },
      data: { createdAt: new Date(Date.now() - 20 * DAY) },
    });
    const freeUser = { id: free.id, email: free.email, role: "member" as const };
    expect(await canUseCoachChat(freeUser)).toBe(false);
    const freeDenied = await coachStreamResponse(freeUser, { kind: "chat", message: "Hello" });
    expect(freeDenied.status).toBe(402);

    const trial = await makeUser("chat-trial@example.com");
    await startTrialForUser(trial.id);
    const trialUser = { id: trial.id, email: trial.email, role: "member" as const };
    expect(await canUseCoachChat(trialUser)).toBe(true);
    expect(await coachStreamForTest(trialUser, { kind: "chat", message: "Hello" })).toMatchObject({
      status: 200,
    });

    const vip = await makeUser("chat-vip@example.com");
    await prisma.subscription.create({
      data: {
        userId: vip.id,
        plan: "coaching",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * DAY),
      },
    });
    const vipUser = { id: vip.id, email: vip.email, role: "member" as const };
    expect(await canUseCoachChat(vipUser)).toBe(true);
    expect(await coachStreamForTest(vipUser, { kind: "chat", message: "Hello coach" })).toMatchObject({
      status: 200,
    });

    const admin = await makeUser("chat-admin@example.com", false, "admin");
    const adminUser = { id: admin.id, email: admin.email, role: "admin" as const };
    expect(await canUseCoachChat(adminUser)).toBe(true);
    expect(await coachStreamForTest(adminUser, { kind: "chat", message: "Hello from admin" })).toMatchObject({
      status: 200,
    });
    await consumeAiUse({ userId: admin.id, kind: "message", surface: "chat" });
  });

  it("gives every new account a week of coach chat, then locks it", async () => {
    const fresh = await makeUser("week-fresh@example.com");
    const freshAccess = await getCoachChatAccess({
      id: fresh.id,
      email: fresh.email,
      role: "member",
    });
    expect(freshAccess.allowed).toBe(true);
    expect(freshAccess.freeDaysLeft).toBe(7);
    expect(freeCoachChatLabel(freshAccess.freeDaysLeft ?? 0)).toBe("7 days of free coach chat left");
    await consumeAiUse({ userId: fresh.id, kind: "message", surface: "chat" });

    const one = await makeUser("week-one@example.com");
    await prisma.user.update({
      where: { id: one.id },
      data: { createdAt: new Date(Date.now() - 6 * DAY - 60 * 60 * 1000) },
    });
    const oneAccess = await getCoachChatAccess({ id: one.id, email: one.email, role: "member" });
    expect(oneAccess.freeDaysLeft).toBe(1);
    expect(freeCoachChatLabel(1)).toBe("1 day of free coach chat left");

    const academy = await makeUser("week-academy@example.com");
    await verify(academy.id);
    const started = new Date(Date.now() - 8 * DAY);
    await prisma.user.update({ where: { id: academy.id }, data: { createdAt: started } });
    await prisma.profile.update({
      where: { userId: academy.id },
      data: {
        memberProStartedAt: started,
        memberProDays: 14,
        trialStartedAt: started,
        trialEndsAt: new Date(Date.now() + 6 * DAY),
      },
    });
    expect(await getAppTier(academy.id)).toBe("pro");
    expect(
      await canUseCoachChat({ id: academy.id, email: academy.email, role: "member" }),
    ).toBe(false);

    const early = await makeUser("week-early-academy@example.com");
    await verify(early.id);
    await prisma.profile.update({
      where: { userId: early.id },
      data: {
        memberProStartedAt: new Date(),
        memberProDays: 14,
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * DAY),
      },
    });
    const earlyAccess = await getCoachChatAccess({
      id: early.id,
      email: early.email,
      role: "member",
    });
    expect(earlyAccess.allowed).toBe(true);
    expect(earlyAccess.freeDaysLeft).toBe(7);
  });
});
