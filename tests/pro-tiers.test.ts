import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AiCapError, consumeAiUse, getAiAllowance } from "@/lib/ai-usage";
import { getAppTier, getEffectivePlanId } from "@/lib/entitlements";
import { coachStreamForTest } from "@/app/api/coach/stream/route";
import { ensureMemberProMonth, memberProDay, startTrialForUser } from "@/lib/trial";
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
    expect(isOpenWhenLocked("/home")).toBe(false);
    expect(isOpenWhenLocked("/training")).toBe(false);
  });

  it("gives verified members Pro for 30 days, then the included academy tier", async () => {
    const member = await makeUser("member-tier@example.com");
    await verify(member.id);
    const start = new Date("2026-10-01T15:00:00.000Z");
    await ensureMemberProMonth(member.id, start);
    await ensureMemberProMonth(member.id, new Date(start.getTime() + DAY)); // no restart
    const profile = await prisma.profile.findUnique({ where: { userId: member.id } });
    expect(profile?.memberProStartedAt?.toISOString()).toBe(start.toISOString());
    expect(await getEffectivePlanId(member.id, new Date(start.getTime() + 29 * DAY))).toBe("performance");
    expect(await getEffectivePlanId(member.id, new Date(start.getTime() + 30 * DAY + 1000))).toBe("academy");
    expect(memberProDay(start, new Date(start.getTime() + 24 * DAY))).toBe(25);
    expect(memberProStage(25)).toBe("day25");
    expect(memberProStage(29)).toBe("day29");
    expect(memberProStage(31)).toBe("day31");
    expect(memberProStage(10)).toBeNull();
    const recap = { workouts: 6, checkIns: 2, aiMessages: 9 };
    expect(memberProCopy("day25", recap).body).toMatch(/6 workouts/);
    expect(memberProCopy("day29", recap).title).toMatch(/Last day/);
    expect(memberProCopy("day31", recap).cta).toMatch(/Upgrade to Pro/);
    expect(memberProCopy("day31", recap).body).not.toMatch(/auto-bill/i);
  });

  it("sends each member Pro reminder once", async () => {
    const member = await makeUser("member-remind@example.com");
    await verify(member.id);
    const start = new Date("2026-10-01T15:00:00.000Z");
    await ensureMemberProMonth(member.id, start);
    const day25 = new Date(start.getTime() + 24 * DAY + 3600_000);
    const first = await runMemberProReminderCron(day25);
    const again = await runMemberProReminderCron(day25);
    expect(first.sent).toBe(1);
    expect(again.sent).toBe(0);
    const day31 = new Date(start.getTime() + 30 * DAY + 3600_000);
    expect((await runMemberProReminderCron(day31)).sent).toBe(1);
    const logs = await prisma.memberProReminderLog.findMany({ where: { userId: member.id } });
    expect(logs.map((row) => row.stage).sort()).toEqual(["day25", "day31"]);
  });

  it("caps academy AI at 3 messages a week, shared by chat and the logger note path", async () => {
    const member = await makeUser("cap-member@example.com");
    await verify(member.id);
    // Month already used up: academy tier.
    await prisma.profile.update({
      where: { userId: member.id },
      data: { memberProStartedAt: new Date(Date.now() - 40 * DAY), trialEndsAt: new Date(Date.now() - 10 * DAY) },
    });
    expect(await getAppTier(member.id)).toBe("academy");
    for (let i = 0; i < ACADEMY_AI_MESSAGES_PER_WEEK; i += 1) {
      await consumeAiUse({ userId: member.id, kind: "message", surface: i === 0 ? "note" : "chat" });
    }
    await expect(
      consumeAiUse({ userId: member.id, kind: "message", surface: "chat" }),
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
      await consumeAiUse({ userId: member.id, kind: "message", surface: "chat" });
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
});
