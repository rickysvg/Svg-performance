import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, AuthError } from "@/lib/errors";
import {
  accountExportFilename,
  assertAccountExportRateLimit,
  deleteAccountForUser,
  exportAccountData,
  exportAccountDataForUser,
  isDeleteConfirmation,
  requireSignedInAccount,
  resetAccountExportRateLimit,
} from "@/lib/account-data";
import { makeUser, resetDatabase } from "./helpers";

async function seedMemberData(userId: string, label: string) {
  await prisma.profile.update({
    where: { userId },
    data: {
      goals: `${label} goal`,
      claimsGymMembership: true,
      gymMembershipVerified: label === "own",
    },
  });
  const session = await prisma.workoutSession.create({
    data: {
      userId,
      title: `${label} squat day`,
      status: "complete",
      performedAt: new Date("2026-09-24T12:00:00Z"),
      notes: `${label} session notes`,
      sets: {
        create: [
          {
            exerciseName: "Goblet squat",
            setNumber: 1,
            sortOrder: 1,
            reps: 8,
            loadValue: label === "own" ? 70 : 999,
            loadUnit: "lb",
          },
        ],
      },
    },
  });
  await prisma.exerciseNote.create({
    data: {
      userId,
      exerciseName: "Goblet squat",
      body: `${label} notepad`,
    },
  });
  const thread = await prisma.chatThread.create({
    data: {
      userId,
      topic: "boxing",
      art: "boxing",
      messages: {
        create: [{ role: "user", content: `${label} coach question` }],
      },
    },
  });
  await prisma.subscription.create({
    data: {
      userId,
      plan: "performance",
      status: "active",
      stripeCustomerId: `cus_${label}_secret`,
      stripeSubscriptionId: `sub_${label}_secret`,
      stripePriceId: `price_${label}_secret`,
      source: "admin",
    },
  });
  await prisma.polarConnection.create({
    data: {
      userId,
      polarUserId: `${label}-polar`,
      accessToken: `${label}-polar-token`,
      tokenType: "Bearer",
    },
  });
  return { session, thread };
}

describe("account export and delete", () => {
  beforeEach(async () => {
    await resetDatabase();
    resetAccountExportRateLimit();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects unauthenticated export and delete", async () => {
    expect(() => requireSignedInAccount(null)).toThrow(AuthError);
    await expect(exportAccountDataForUser(null)).rejects.toBeInstanceOf(AuthError);
    await expect(deleteAccountForUser(null, "DELETE")).rejects.toBeInstanceOf(AuthError);
  });

  it("exports only the signed-in member and strips secrets", async () => {
    const owner = await makeUser("export-own@example.com");
    const other = await makeUser("export-other@example.com");
    await seedMemberData(owner.id, "own");
    await seedMemberData(other.id, "other");

    const payload = await exportAccountDataForUser(owner);
    const raw = JSON.stringify(payload);

    expect(payload.account.email).toBe("export-own@example.com");
    expect(payload.account).not.toHaveProperty("passwordHash");
    expect(payload.profile?.goals).toBe("own goal");
    expect(payload.gymMembership?.gymMembershipVerified).toBe(true);
    expect(payload.workoutSessions).toHaveLength(1);
    expect(payload.workoutSessions[0].title).toBe("own squat day");
    expect(payload.workoutSessions[0].sets[0].loadValue).toBe(70);
    expect(payload.exerciseNotes[0].body).toBe("own notepad");
    expect(payload.coachChat[0].messages[0].content).toBe("own coach question");
    expect(payload.subscriptions[0].plan).toBe("performance");
    expect(payload.subscriptions[0].status).toBe("active");
    expect(payload.polarConnection.connected).toBe(true);

    expect(raw).not.toContain("export-other@example.com");
    expect(raw).not.toContain("other squat day");
    expect(raw).not.toContain("other notepad");
    expect(raw).not.toContain("other coach question");
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain("own-polar-token");
    expect(raw).not.toContain("other-polar-token");
    expect(raw).not.toContain("cus_own_secret");
    expect(raw).not.toContain("sub_own_secret");
    expect(raw).not.toContain("price_own_secret");
    expect(raw).not.toContain("Bearer");
    expect(payload.subscriptions[0]).not.toHaveProperty("stripeCustomerId");
    expect(payload.subscriptions[0]).not.toHaveProperty("stripeSubscriptionId");
    expect(payload).not.toHaveProperty("sessions");
    expect(payload).not.toHaveProperty("passwordResetTokens");
  });

  it("deletes the member and related rows, leaving other accounts", async () => {
    const owner = await makeUser("delete-own@example.com");
    const other = await makeUser("delete-other@example.com");
    const own = await seedMemberData(owner.id, "own");
    const leftover = await seedMemberData(other.id, "other");

    await expect(deleteAccountForUser(owner, "nope")).rejects.toBeInstanceOf(AppError);

    const result = await deleteAccountForUser(owner, "DELETE");
    expect(result.deleted).toBe(true);

    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await prisma.profile.findUnique({ where: { userId: owner.id } })).toBeNull();
    expect(await prisma.workoutSession.findUnique({ where: { id: own.session.id } })).toBeNull();
    expect(await prisma.workoutSet.count({ where: { workoutSessionId: own.session.id } })).toBe(0);
    expect(await prisma.exerciseNote.count({ where: { userId: owner.id } })).toBe(0);
    expect(await prisma.chatThread.findUnique({ where: { id: own.thread.id } })).toBeNull();
    expect(await prisma.subscription.count({ where: { userId: owner.id } })).toBe(0);
    expect(await prisma.polarConnection.findUnique({ where: { userId: owner.id } })).toBeNull();

    expect(await prisma.user.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(await prisma.workoutSession.findUnique({ where: { id: leftover.session.id } })).not.toBeNull();
    expect(await prisma.chatThread.findUnique({ where: { id: leftover.thread.id } })).not.toBeNull();
    expect((await prisma.profile.findUnique({ where: { userId: other.id } }))?.goals).toBe(
      "other goal",
    );
  });

  it("accepts DELETE or the member email as confirmation", () => {
    expect(isDeleteConfirmation("DELETE", "a@example.com")).toBe(true);
    expect(isDeleteConfirmation("a@example.com", "a@example.com")).toBe(true);
    expect(isDeleteConfirmation("A@Example.com", "a@example.com")).toBe(true);
    expect(isDeleteConfirmation("delete", "a@example.com")).toBe(false);
    expect(isDeleteConfirmation("b@example.com", "a@example.com")).toBe(false);
    expect(accountExportFilename(new Date("2026-09-25T15:00:00Z"))).toBe(
      "svg-performance-data-2026-09-25.json",
    );
  });

  it("rate-limits repeat downloads", async () => {
    const owner = await makeUser("rate@example.com");
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      assertAccountExportRateLimit(owner.id, now + i);
    }
    expect(() => assertAccountExportRateLimit(owner.id, now + 6)).toThrow(AppError);
    await expect(exportAccountData(owner.id)).resolves.toMatchObject({
      account: { email: "rate@example.com" },
    });
  });
});
