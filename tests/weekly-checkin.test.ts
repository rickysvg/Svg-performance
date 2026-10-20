import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { setMailSenderForTests, type MailInput } from "@/lib/mail";
import { AppError, ForbiddenError } from "@/lib/errors";
import {
  checkInWeekKey,
  decideCheckInReminder,
  detectCheckInFlags,
  fallbackCheckInDraft,
  isWeeklyCheckInDue,
  memberHasWeeklyCheckInAccess,
  planIsOneOnOneCoaching,
  reminderInstant,
  sortCheckInsFlaggedFirst,
  summaryLineCount,
} from "@/lib/weekly-checkin-shared";
import { generateCheckInDraft } from "@/lib/weekly-checkin-ai";
import {
  isWeeklyCheckInCoach,
  listCheckInsForCoach,
  markCheckInReviewed,
  saveCheckInReply,
  setWeeklyCheckInOverride,
  submitWeeklyCheckIn,
  weeklyCheckInAllowed,
} from "@/lib/weekly-checkin";
import { runWeeklyCheckInCron } from "@/lib/weekly-checkin-cron";

const NOW = new Date("2026-10-19T02:30:00.000Z");

function scores(overrides: Partial<Parameters<typeof detectCheckInFlags>[0]> = {}) {
  return {
    bodyweightLb: 175,
    previousWeightLb: 174,
    sleepQuality: 4,
    energy: 4,
    previousEnergy: 4,
    stress: 2,
    regions: [],
    sorenessNotes: "",
    sessionsCompleted: 4,
    sessionsPlanned: 4,
    sparringSummary: "",
    wins: "Jab landed cleaner.",
    struggles: "",
    ...overrides,
  };
}

describe("weekly check-in rules", () => {
  it("gates on 1-on-1 coaching, including legacy coaching plans", () => {
    expect(planIsOneOnOneCoaching("coaching")).toBe(true);
    expect(planIsOneOnOneCoaching("coaching_monthly")).toBe(true);
    expect(planIsOneOnOneCoaching("fighter_development")).toBe(true);
    expect(planIsOneOnOneCoaching("development_gym")).toBe(true);
    expect(planIsOneOnOneCoaching("elite")).toBe(true);
    expect(planIsOneOnOneCoaching("elite_non")).toBe(true);
    expect(planIsOneOnOneCoaching("vip")).toBe(true);
    expect(planIsOneOnOneCoaching("platinum")).toBe(true);
    expect(planIsOneOnOneCoaching("performance")).toBe(false);
    expect(planIsOneOnOneCoaching("performance_yearly")).toBe(false);
    expect(planIsOneOnOneCoaching("fighter_conditioning")).toBe(false);
    expect(planIsOneOnOneCoaching("member_access")).toBe(false);
    expect(planIsOneOnOneCoaching(null)).toBe(false);

    expect(memberHasWeeklyCheckInAccess({ planId: "performance", override: "none" })).toBe(false);
    expect(memberHasWeeklyCheckInAccess({ planId: "member_access", override: "none" })).toBe(false);
    expect(memberHasWeeklyCheckInAccess({ planId: "coaching", override: "none" })).toBe(true);
    expect(memberHasWeeklyCheckInAccess({ planId: "fighter_development", override: "none" })).toBe(true);
    expect(memberHasWeeklyCheckInAccess({ planId: "elite", override: "none" })).toBe(true);
    expect(memberHasWeeklyCheckInAccess({ planId: "vip", override: "none" })).toBe(true);
    expect(memberHasWeeklyCheckInAccess({ planId: "platinum", override: "none" })).toBe(true);
    expect(memberHasWeeklyCheckInAccess({ planId: "performance", override: "force_on" })).toBe(true);
  });

  it("is due after Sunday 6 PM local and not after it is submitted", () => {
    const at = reminderInstant(NOW, "America/Denver");
    expect(at.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(
      isWeeklyCheckInDue({ now: NOW, timeZone: "America/Denver", submitted: false }),
    ).toBe(true);
    expect(
      isWeeklyCheckInDue({
        now: new Date("2026-10-18T23:00:00.000Z"),
        timeZone: "America/Denver",
        submitted: false,
      }),
    ).toBe(true);
    expect(
      reminderInstant(new Date("2026-10-18T23:00:00.000Z"), "America/Denver").toISOString(),
    ).toBe("2026-10-12T00:00:00.000Z");
    expect(
      isWeeklyCheckInDue({ now: NOW, timeZone: "America/Denver", submitted: true }),
    ).toBe(false);
    expect(checkInWeekKey(NOW, "America/Denver")).toBe("2026-10-18");
    expect(checkInWeekKey(new Date("2026-10-20T01:00:00.000Z"), "America/Denver")).toBe(
      "2026-10-18",
    );
  });

  it("sends the first reminder when due, then a follow-up after 24 hours", () => {
    expect(
      decideCheckInReminder({
        now: NOW,
        timeZone: "America/Denver",
        submitted: false,
        initialSentAt: null,
        followUpSent: false,
      }),
    ).toBe("initial");
    expect(
      decideCheckInReminder({
        now: new Date("2026-10-19T12:00:00.000Z"),
        timeZone: "America/Denver",
        submitted: false,
        initialSentAt: new Date("2026-10-19T00:05:00.000Z"),
        followUpSent: false,
      }),
    ).toBe("none");
    expect(
      decideCheckInReminder({
        now: new Date("2026-10-20T01:00:00.000Z"),
        timeZone: "America/Denver",
        submitted: false,
        initialSentAt: new Date("2026-10-19T00:05:00.000Z"),
        followUpSent: false,
      }),
    ).toBe("followup");
    expect(
      decideCheckInReminder({
        now: new Date("2026-10-20T01:00:00.000Z"),
        timeZone: "America/Denver",
        submitted: true,
        initialSentAt: new Date("2026-10-19T00:05:00.000Z"),
        followUpSent: false,
      }),
    ).toBe("none");
  });

  it("flags injury, head contact, weight, missed sessions, and a low-energy trend", () => {
    const flags = detectCheckInFlags(
      scores({
        bodyweightLb: 180,
        previousWeightLb: 170,
        energy: 2,
        previousEnergy: 1,
        regions: ["head", "knee_l"],
        sorenessNotes: "Knee sprain in sparring.",
        sessionsCompleted: 1,
        sessionsPlanned: 4,
        sparringSummary: "Wednesday: 5 x 3 min, hard (ate a head kick)",
        struggles: "Hard sparring.",
      }),
    );
    expect(flags.map((flag) => flag.code)).toEqual([
      "injury",
      "head_contact",
      "weight_change",
      "missed_sessions",
      "low_energy_trend",
    ]);
    expect(detectCheckInFlags(scores()).map((flag) => flag.code)).toEqual([]);
    expect(
      detectCheckInFlags(scores({ energy: 1, previousEnergy: null })).some(
        (flag) => flag.code === "low_energy_trend",
      ),
    ).toBe(false);
  });

  it("sorts flagged check-ins ahead of clean ones", () => {
    const sorted = sortCheckInsFlaggedFirst([
      { id: "clean", flagCount: 0, submittedAt: new Date("2026-10-19T00:00:00.000Z") },
      { id: "one", flagCount: 1, submittedAt: new Date("2026-10-18T00:00:00.000Z") },
      { id: "two", flagCount: 2, submittedAt: new Date("2026-10-17T00:00:00.000Z") },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["two", "one", "clean"]);
  });

  it("drafts three lines and a Ricky reply without a live key", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const draft = fallbackCheckInDraft({ ...scores(), displayName: "Ava Lopez" });
    expect(summaryLineCount(draft.summary)).toBe(3);
    expect(draft.reply).toContain("Ava");
    expect(draft.reply).toContain("No fluff.");
    expect(draft.source).toBe("fallback");
    const generated = await generateCheckInDraft({ ...scores(), displayName: "Ava Lopez" });
    expect(generated.source).toBe("fallback");
    if (previous) process.env.OPENAI_API_KEY = previous;
  });
});

describe("weekly check-in access, submit, and reminders", () => {
  const sent: MailInput[] = [];
  const previous = {
    openai: process.env.OPENAI_API_KEY,
    vapidPublic: process.env.VAPID_PUBLIC_KEY,
    vapidPrivate: process.env.VAPID_PRIVATE_KEY,
    cron: process.env.CRON_SECRET,
    smtp: process.env.SMTP_HOST,
  };

  function restoreEnv() {
    setMailSenderForTests(null);
    if (previous.openai === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous.openai;
    if (previous.vapidPublic === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = previous.vapidPublic;
    if (previous.vapidPrivate === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = previous.vapidPrivate;
    if (previous.cron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous.cron;
    if (previous.smtp === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previous.smtp;
  }

  beforeEach(async () => {
    await resetDatabase();
    sent.length = 0;
    delete process.env.OPENAI_API_KEY;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    process.env.CRON_SECRET = "cron-checkin-test";
    process.env.SMTP_HOST = "smtp.resend.com";
    setMailSenderForTests(async (input) => {
      sent.push(input);
      return { sent: true, reason: "sent" };
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  afterAll(async () => {
    restoreEnv();
    await prisma.$disconnect();
  });

  async function coachingUser(email: string) {
    const user = await makeUser(email);
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        timeZone: "America/Denver",
        displayName: "Ava Lopez",
        sessionsPerWeek: 4,
        weeklyAvailabilityJson: JSON.stringify(["Monday", "Tuesday", "Wednesday", "Thursday"]),
        onboardingCompletedAt: NOW,
        planChoiceAt: NOW,
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "elite",
        status: "active",
        currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    return user;
  }

  it("blocks a free member, allows coaching, and lets an admin force it on", async () => {
    const free = await makeUser("free-checkin@example.com");
    expect(await weeklyCheckInAllowed(free.id, NOW)).toBe(false);
    await expect(
      submitWeeklyCheckIn({
        userId: free.id,
        now: NOW,
        timeZone: "America/Denver",
        bodyweightLb: 170,
        sleepQuality: 3,
        energy: 3,
        stress: 2,
        regions: [],
        sorenessNotes: "",
        wins: "Showed up.",
        struggles: "",
      }),
    ).rejects.toBeInstanceOf(AppError);

    const admin = await makeUser("ricky@svg.example", false, "admin");
    const enabled = await setWeeklyCheckInOverride({
      actor: admin,
      email: free.email,
      enabled: true,
    });
    expect(enabled.enabled).toBe(true);
    expect(await weeklyCheckInAllowed(free.id, NOW)).toBe(true);
    await expect(
      setWeeklyCheckInOverride({ actor: free, email: free.email, enabled: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(isWeeklyCheckInCoach(admin)).toBe(true);
    expect(isWeeklyCheckInCoach(free)).toBe(false);

    const performance = await makeUser("perf-checkin@example.com");
    await prisma.subscription.create({
      data: {
        userId: performance.id,
        plan: "performance",
        status: "active",
        currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    // Pro gets the weekly check-in form (with AI feedback); Ricky only reviews coaching.
    expect(await weeklyCheckInAllowed(performance.id, NOW)).toBe(true);

    const coaching = await makeUser("new-coaching@example.com");
    await prisma.subscription.create({
      data: {
        userId: coaching.id,
        plan: "coaching_monthly",
        status: "active",
        currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    expect(await weeklyCheckInAllowed(coaching.id, NOW)).toBe(true);

    const legacy = await makeUser("legacy-checkin@example.com");
    await prisma.subscription.create({
      data: {
        userId: legacy.id,
        plan: "development_gym",
        status: "active",
        currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      },
    });
    expect(await weeklyCheckInAllowed(legacy.id, NOW)).toBe(true);

    const expired = await makeUser("expired-coaching@example.com");
    await prisma.subscription.create({
      data: {
        userId: expired.id,
        plan: "coaching",
        status: "active",
        currentPeriodEnd: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    expect(await weeklyCheckInAllowed(expired.id, NOW)).toBe(false);
  });

  it("saves a check-in with auto session counts and a fallback draft", async () => {
    const user = await coachingUser("ava@example.com");
    const monday = new Date("2026-10-13T18:00:00.000Z");
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lower",
        performedAt: monday,
        status: "complete",
        sets: { create: [{ exerciseName: "Squat", setNumber: 1, sortOrder: 0, reps: 5, loadValue: 185 }] },
      },
    });
    await prisma.outsideSessionLog.create({
      data: {
        userId: user.id,
        dateKey: "2026-10-15",
        weekday: "Thursday",
        rounds: 4,
        minutesPerRound: 3,
        intensity: "hard",
        notes: "ate a head kick",
      },
    });
    await prisma.bodyMetric.create({
      data: { userId: user.id, kind: "weight", value: 170, unit: "lb", recordedAt: new Date("2026-10-01T00:00:00.000Z") },
    });

    const row = await submitWeeklyCheckIn({
      userId: user.id,
      now: NOW,
      timeZone: "America/Denver",
      bodyweightLb: 176,
      sleepQuality: 2,
      energy: 2,
      stress: 4,
      regions: ["knee_l"],
      sorenessNotes: "Knee sprain on the shot.",
      wins: "Hands stayed up.",
      struggles: "Gas in round 3.",
    });
    expect(row.sessionsCompleted).toBe(1);
    expect(row.sessionsPlanned).toBe(7);
    expect(row.sparringSummary).toContain("head kick");
    expect(row.aiSource).toBe("fallback");
    expect(summaryLineCount(row.aiSummary)).toBe(3);
    expect(row.aiFlagsJson).toContain("head_contact");
    expect(row.aiFlagsJson).toContain("weight_change");
    expect(row.coachStatus).toBe("pending");

    await expect(
      submitWeeklyCheckIn({
        userId: user.id,
        now: NOW,
        timeZone: "America/Denver",
        bodyweightLb: 176,
        sleepQuality: 2,
        energy: 2,
        stress: 4,
        regions: [],
        sorenessNotes: "",
        wins: "",
        struggles: "",
      }),
    ).rejects.toMatchObject({ code: "CHECKIN" });
  });

  it("lists flagged clients first and sends the reply", async () => {
    const coach = await makeUser("coach-ricky@example.com", false, "admin");
    const calm = await coachingUser("calm@example.com");
    const hurt = await coachingUser("hurt@example.com");
    await prisma.profile.update({
      where: { userId: hurt.id },
      data: { displayName: "Hurt Athlete" },
    });
    await submitWeeklyCheckIn({
      userId: calm.id,
      now: NOW,
      timeZone: "America/Denver",
      bodyweightLb: 160,
      sleepQuality: 5,
      energy: 5,
      stress: 1,
      regions: [],
      sorenessNotes: "",
      wins: "Easy week.",
      struggles: "",
    });
    await prisma.profile.update({
      where: { userId: calm.id },
      data: { sessionsPerWeek: 0, weeklyAvailabilityJson: "[]" },
    });
    const flagged = await submitWeeklyCheckIn({
      userId: hurt.id,
      now: NOW,
      timeZone: "America/Denver",
      bodyweightLb: 180,
      sleepQuality: 2,
      energy: 2,
      stress: 4,
      regions: ["head"],
      sorenessNotes: "Headache after sparring.",
      wins: "",
      struggles: "Could not shake the headache.",
    });
    const queue = await listCheckInsForCoach();
    expect(queue[0]?.userId).toBe(hurt.id);
    expect(queue[0]?.flagCount).toBeGreaterThan(0);
    expect(queue.some((row) => row.userId === calm.id)).toBe(true);

    const member = { id: calm.id, role: "member", email: calm.email };
    await expect(
      saveCheckInReply({ actor: member, checkInId: flagged.id, reply: "Nope.", send: true }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const sentRow = await saveCheckInReply({
      actor: coach,
      checkInId: flagged.id,
      reply: "Head is a flag. Get checked if it is still there. No extra sparring. No fluff.",
      send: true,
      now: NOW,
    });
    expect(sentRow.coachStatus).toBe("sent");
    const reviewed = await markCheckInReviewed({
      actor: coach,
      checkInId: queue.find((row) => row.userId === calm.id)!.id,
      now: NOW,
    });
    expect(reviewed.coachStatus).toBe("reviewed");
    expect(reviewed.sentAt).toBeNull();
  });

  it("emails a deep link when push is off, follows up after a day, and skips a finished week", async () => {
    const user = await coachingUser("mail-checkin@example.com");
    const first = await runWeeklyCheckInCron(NOW);
    expect(first.initialEmail).toBe(1);
    expect(first.initialPush).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe("Weekly check-in is due");
    expect(sent[0]?.text).toContain("/checkin");
    expect(sent[0]?.html).toContain("Open check-in");

    const again = await runWeeklyCheckInCron(new Date("2026-10-19T03:30:00.000Z"));
    expect(again.initialEmail).toBe(0);
    expect(sent).toHaveLength(1);

    await submitWeeklyCheckIn({
      userId: user.id,
      now: NOW,
      timeZone: "America/Denver",
      bodyweightLb: 170,
      sleepQuality: 4,
      energy: 4,
      stress: 2,
      regions: [],
      sorenessNotes: "",
      wins: "Done.",
      struggles: "",
    });
    const quiet = await runWeeklyCheckInCron(new Date("2026-10-20T03:00:00.000Z"));
    expect(quiet.followUpEmail).toBe(0);
    expect(sent).toHaveLength(1);

    await coachingUser("still-open@example.com");
    const secondInitial = await runWeeklyCheckInCron(NOW);
    expect(secondInitial.initialEmail).toBe(1);
    const follow = await runWeeklyCheckInCron(new Date("2026-10-20T03:00:00.000Z"));
    expect(follow.followUpEmail).toBe(1);
    expect(sent.at(-1)?.subject).toBe("Your weekly check-in is still open");
    expect(sent.at(-1)?.html).toContain("/checkin");
  });
});
