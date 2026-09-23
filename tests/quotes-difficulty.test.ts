import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { AppError } from "@/lib/errors";
import { canUseFeature } from "@/lib/entitlements";
import { assignPlanForPilot } from "@/lib/billing";
import {
  DAILY_QUOTES,
  getDailyQuoteCard,
  quoteForLocalDate,
  quoteSourceCounts,
  teaserFromQuote,
} from "@/lib/quotes";
import {
  parseDifficultyRating,
  recentDifficultyAverage,
  tooEasyCoachNote,
  tooEasyStreak,
} from "@/lib/difficulty";
import {
  rateWorkoutSessionForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { getDemoProgram } from "@/lib/programs";
import { getDueReminders, saveReminderPrefs } from "@/lib/reminders";
import { listMemberTrendsForStaff } from "@/lib/reports";

function turnStripeOn() {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
  process.env.STRIPE_PRICE_STANDALONE = "price_standalone";
}

function turnStripeOff() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PRICE_STANDALONE;
}

async function completeSession(
  userId: string,
  rating?: string,
  performedAt = new Date(),
) {
  const program = await getDemoProgram();
  const session = await startWorkoutFromDay({
    userId,
    programDayId: program.days[0].id,
    preferredUnits: "lb",
  });
  const saved = await updateWorkoutSessionForUser({
    userId,
    workoutId: session.id,
    title: session.title,
    performedAt,
    notes: "",
    status: "complete",
    sets: [
      {
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: 8,
        loadValue: 40,
        loadUnit: "lb",
        completed: true,
      },
    ],
  });
  if (rating) {
    return rateWorkoutSessionForUser({
      userId,
      workoutId: saved.id,
      difficultyRating: rating,
    });
  }
  return saved;
}

describe("daily quotes and difficulty ratings", () => {
  beforeEach(async () => {
    await resetDatabase();
    turnStripeOff();
  });

  afterAll(async () => {
    turnStripeOff();
    await prisma.$disconnect();
  });

  it("gives Performance+ / preview users the full daily quote", async () => {
    const user = await makeUser("quote-open@example.com");
    expect(await canUseFeature(user.id, "daily_quote")).toBe(true);
    const card = await getDailyQuoteCard(user.id, new Date("2026-09-22T12:00:00"));
    expect(card.unlocked).toBe(true);
    expect(card.quote.text).toBe(quoteForLocalDate(new Date("2026-09-22T12:00:00")).text);
    expect(card.quote.text.length).toBeGreaterThan(20);
    expect(card.quote.text.toLowerCase()).not.toMatch(/lazy|worthless|pathetic/);
    expect(card.quote.attribution.length).toBeGreaterThan(3);
    expect(card.quote.attribution).not.toBe("SVG Performance");
  });

  it("keeps an even mix of UFC, achiever, and scripture quotes", () => {
    const counts = quoteSourceCounts();
    expect(DAILY_QUOTES.length).toBeGreaterThanOrEqual(30);
    expect(counts.ufc).toBe(counts.achiever);
    expect(counts.achiever).toBe(counts.scripture);
    expect(counts.ufc).toBeGreaterThanOrEqual(10);
    const ids = new Set(DAILY_QUOTES.map((quote) => quote.id));
    expect(ids.size).toBe(DAILY_QUOTES.length);
    for (const quote of DAILY_QUOTES) {
      expect(quote.text.length).toBeGreaterThan(12);
      expect(quote.attribution.length).toBeGreaterThan(3);
      expect(quote.attribution).not.toMatch(/SVG Performance/i);
      expect(quote.text.toLowerCase()).not.toMatch(/\b(lazy|worthless|pathetic|stupid)\b/);
    }
    expect(DAILY_QUOTES.some((quote) => /UFC/i.test(quote.attribution))).toBe(true);
    expect(DAILY_QUOTES.some((quote) => /:\d/.test(quote.attribution))).toBe(true);
    const first = quoteForLocalDate(new Date("2026-01-01T12:00:00"));
    const later = quoteForLocalDate(new Date("2026-06-15T12:00:00"));
    expect(first.id).not.toBe(later.id);
  });

  it("locks the full quote for Member Access when Stripe TEST is on", async () => {
    turnStripeOn();
    const user = await makeUser("quote-locked@example.com");
    expect(await canUseFeature(user.id, "daily_quote")).toBe(false);
    const card = await getDailyQuoteCard(user.id);
    expect(card.unlocked).toBe(false);
    expect(card.teaser).toBe(teaserFromQuote(card.quote));
    expect(card.teaser.endsWith("…")).toBe(true);

    await assignPlanForPilot({
      adminUserId: (await makeUser("quote-admin@example.com", false, "admin")).id,
      targetUserId: user.id,
      plan: "performance",
    });
    expect(await canUseFeature(user.id, "daily_quote")).toBe(true);
    expect((await getDailyQuoteCard(user.id)).unlocked).toBe(true);
  });

  it("reminds entitled members of today’s quote after the preferred hour", async () => {
    const user = await makeUser("quote-remind@example.com");
    await saveReminderPrefs(user.id, {
      workoutEnabled: false,
      foodEnabled: false,
      quoteEnabled: true,
      preferredHour: 8,
      timezoneOffsetMinutes: 0,
    });
    const now = new Date("2026-09-22T15:00:00.000Z");
    const due = await getDueReminders(user.id, now);
    expect(due.map((row) => row.kind)).toEqual(["quote"]);
    expect(due[0]?.message).toMatch(/Today’s quote/);
  });

  it("persists a post-workout difficulty rating and averages it", async () => {
    const user = await makeUser("rate@example.com");
    const first = await completeSession(user.id);
    expect(first.difficultyRating).toBe("");
    await expect(
      rateWorkoutSessionForUser({
        userId: user.id,
        workoutId: first.id,
        difficultyRating: "impossible",
      }),
    ).rejects.toBeInstanceOf(AppError);

    const rated = await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId: first.id,
      difficultyRating: "just_right",
    });
    expect(rated.difficultyRating).toBe("just_right");
    expect(parseDifficultyRating("hard")).toBe("hard");

    await completeSession(user.id, "hard", new Date("2026-09-21T12:00:00Z"));
    const rows = await prisma.workoutSession.findMany({ where: { userId: user.id } });
    const avg = recentDifficultyAverage(rows);
    expect(avg.count).toBe(2);
    expect(avg.average).toBeGreaterThan(1);
    expect(avg.label).toMatch(/Just right|Hard/);
  });

  it("flags a too-easy streak for coaches without shame copy", async () => {
    const admin = await makeUser("diff-admin@example.com", false, "admin");
    const member = await makeUser("too-easy@example.com");
    await completeSession(member.id, "too_easy", new Date("2026-09-20T12:00:00Z"));
    await completeSession(member.id, "too_easy", new Date("2026-09-21T12:00:00Z"));
    await completeSession(member.id, "too_easy", new Date("2026-09-22T12:00:00Z"));
    const rows = await prisma.workoutSession.findMany({ where: { userId: member.id } });
    expect(tooEasyStreak(rows)).toBe(3);
    expect(tooEasyCoachNote(3)).toMatch(/load check/i);
    expect(tooEasyCoachNote(3)).not.toMatch(/lazy|fail|shame/i);

    const trends = await listMemberTrendsForStaff({
      staffUserId: admin.id,
      staffRole: "admin",
    });
    const row = trends.find((item) => item.userId === member.id);
    expect(row?.tooEasyStreak).toBe(3);
    expect(row?.tooEasyNote).toMatch(/too easy/i);
    expect(row?.recentDifficultyLabel).toBe("Too easy");
  });
});
