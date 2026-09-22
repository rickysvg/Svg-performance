import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { createPilotInvite, listPilotInvites } from "@/lib/invites";
import { registerAccount } from "@/lib/auth";
import {
  addClipTimestampNote,
  assertCanUploadClip,
  createTrainingClipForUser,
  getTrainingClipForActor,
  parseTimestamp,
} from "@/lib/clips";
import { assignMemberToCoach } from "@/lib/reports";
import { assignPlanForPilot } from "@/lib/billing";
import {
  countActiveDaysInRange,
  createOrUpdateChallenge,
  enrollInChallenge,
  getChallengeProgressForUser,
  monthKeyFrom,
  monthRange,
} from "@/lib/challenges";
import {
  allergyHits,
  applySwaps,
  generateGroceryListForUser,
  mergeGroceryItems,
  parseIngredientsJson,
  SIMPLE_SWAPS,
} from "@/lib/meal-prep";
import { getFocusVideoForMember, upsertFocusVideo } from "@/lib/focus-videos";
import { getPilotDashboardCounts } from "@/lib/pilot";

function tinyMp4() {
  const bytes = new Uint8Array(64);
  bytes[4] = 0x66;
  bytes[5] = 0x74;
  bytes[6] = 0x79;
  bytes[7] = 0x70;
  return bytes;
}

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

describe("pilot launch pack", () => {
  beforeEach(async () => {
    await resetDatabase();
    turnStripeOff();
  });

  afterAll(async () => {
    turnStripeOff();
    await prisma.$disconnect();
  });

  it("marks an invited email as joined when they create an account", async () => {
    const admin = await makeUser("pilot-admin@example.com", false, "admin");
    await createPilotInvite({ adminUserId: admin.id, email: "new-athlete@example.com" });
    const before = await listPilotInvites();
    expect(before[0]?.status).toBe("invited");
    await registerAccount({
      email: "new-athlete@example.com",
      password: "password12",
      displayName: "New",
      isAdultConfirmed: true,
      claimsGymMembership: false,
    });
    const after = await listPilotInvites();
    expect(after[0]?.status).toBe("joined");
    expect(after[0]?.joinedAt).toBeTruthy();
  });

  it("keeps training clips private and locked below Fighter Development when Stripe is on", async () => {
    turnStripeOn();
    const member = await makeUser("clip-a@example.com");
    const other = await makeUser("clip-b@example.com");
    await expect(assertCanUploadClip(member.id)).rejects.toBeInstanceOf(AppError);

    const admin = await makeUser("clip-admin@example.com", false, "admin");
    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: member.id,
      plan: "fighter_development",
    });
    const clip = await createTrainingClipForUser({
      userId: member.id,
      title: "Jab",
      memberNote: "Watch the rear hand",
      bytes: tinyMp4(),
      claimedType: "video/mp4",
    });
    await expect(getTrainingClipForActor(clip.id, other)).rejects.toBeInstanceOf(ForbiddenError);

    const coach = await makeUser("clip-coach@example.com", false, "coach");
    await expect(
      addClipTimestampNote({
        staffUserId: coach.id,
        staffRole: "coach",
        clipId: clip.id,
        timestamp: "0:12",
        correction: "Keep the chin tucked.",
        drill: "100 jabs on the bag",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await assignMemberToCoach({
      adminUserId: admin.id,
      coachUserId: coach.id,
      memberUserId: member.id,
    });
    const note = await addClipTimestampNote({
      staffUserId: coach.id,
      staffRole: "coach",
      clipId: clip.id,
      timestamp: "0:12",
      correction: "Keep the chin tucked.",
      drill: "100 jabs on the bag",
    });
    expect(note.seconds).toBe(12);
    expect(parseTimestamp("1:05")).toBe(65);
  });

  it("scores the monthly challenge on days active, not heaviest lift", async () => {
    const admin = await makeUser("chal-admin@example.com", false, "admin");
    const member = await makeUser("chal-member@example.com");
    const monthKey = monthKeyFrom();
    await createOrUpdateChallenge({
      adminUserId: admin.id,
      title: "Show up",
      monthKey,
      summary: "Days only",
      beginnerGoalDays: 2,
      advancedGoalDays: 4,
      active: true,
    });
    await enrollInChallenge(member.id, "beginner");
    const { start, end } = monthRange(monthKey);
    expect(await countActiveDaysInRange(member.id, start, end)).toBe(0);
    await prisma.workoutSession.create({
      data: {
        userId: member.id,
        title: "Day 1",
        status: "complete",
        performedAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      },
    });
    await prisma.nutritionEntry.create({
      data: {
        userId: member.id,
        name: "Meal",
        mealType: "lunch",
        servings: 1,
        servingLabel: "serving",
        calories: 400,
        proteinG: 30,
        carbsG: 40,
        fatG: 10,
        source: "manual_estimate",
        eatenAt: new Date(start.getTime() + 3 * 60 * 60 * 1000),
      },
    });
    expect(await countActiveDaysInRange(member.id, start, end)).toBe(1);
    const progress = await getChallengeProgressForUser(member.id);
    expect(progress?.daysActive).toBe(1);
    expect(progress?.complete).toBe(false);
  });

  it("builds a grocery list with swaps and an allergy reminder", async () => {
    const user = await makeUser("prep@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { allergies: "peanuts, chicken" },
    });
    const merged = mergeGroceryItems(
      applySwaps(
        [
          { name: "chicken breast", quantity: 4, unit: "oz" },
          { name: "chicken breast", quantity: 4, unit: "oz" },
        ],
        { "chicken breast": SIMPLE_SWAPS["chicken breast"] },
      ),
    );
    expect(merged[0]?.name).toBe("turkey breast");
    expect(merged[0]?.quantity).toBe(8);
    const list = await generateGroceryListForUser({
      userId: user.id,
      title: "Week",
      lines: [
        {
          mealName: "Bowl",
          servings: 2,
          ingredients: [{ name: "chicken breast", quantity: 4, unit: "oz" }],
        },
      ],
      swaps: {},
    });
    const items = parseIngredientsJson(list.itemsJson);
    expect(allergyHits(items, "chicken")).toHaveLength(1);
    expect(list.notes).toMatch(/Verify ingredients/i);
  });

  it("hides draft focus videos and locks Member Access when Stripe is on", async () => {
    turnStripeOn();
    const admin = await makeUser("focus-admin@example.com", false, "admin");
    const member = await makeUser("focus-member@example.com");
    const nextMonday = new Date();
    await upsertFocusVideo({
      adminUserId: admin.id,
      title: "Hidden draft",
      weekStart: nextMonday.toISOString().slice(0, 10),
      videoUrl: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
      scriptNotes: "",
      status: "draft",
      isDemo: true,
    });
    const locked = await getFocusVideoForMember(member.id);
    expect(locked.unlocked).toBe(false);
    expect(locked.video).toBeNull();

    await assignPlanForPilot({
      adminUserId: admin.id,
      targetUserId: member.id,
      plan: "performance",
    });
    await upsertFocusVideo({
      adminUserId: admin.id,
      title: "Published focus",
      weekStart: nextMonday.toISOString().slice(0, 10),
      videoUrl: "https://www.youtube.com/watch?v=Z0a_XVJDV-g",
      scriptNotes: "DEMO",
      status: "published",
      isDemo: true,
    });
    const open = await getFocusVideoForMember(member.id);
    expect(open.unlocked).toBe(true);
    expect(open.video?.title).toBe("Published focus");
    expect(open.video?.status).toBe("published");
  });

  it("exposes signup and invite counts without private payloads", async () => {
    await makeUser("count-a@example.com");
    const counts = await getPilotDashboardCounts();
    expect(counts.signups).toBeGreaterThanOrEqual(1);
    expect(counts).not.toHaveProperty("emails");
  });
});
