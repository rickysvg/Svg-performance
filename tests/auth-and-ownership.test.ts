import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  authenticate,
  changePassword,
  registerAccount,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/auth";
import { AppError, AuthError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getProfileForUser, updateProfileForUser } from "@/lib/profile";
import { getDemoProgram } from "@/lib/programs";
import {
  deleteWorkoutSessionForUser,
  getOwnWorkoutSessionOrNull,
  getWorkoutSessionForUser,
  startWorkoutFromDay,
  tryReadWorkoutByIdForUser,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { convertLoad } from "@/lib/units";
import { makeUser, resetDatabase } from "./helpers";

describe("auth", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects registration without adult confirmation", async () => {
    await expect(
      registerAccount({
        email: "kid@example.com",
        password: "password12",
        displayName: "Kid",
        isAdultConfirmed: false,
        claimsGymMembership: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("registers, logs in, and rejects a bad password", async () => {
    const user = await makeUser("a@example.com");
    expect(user.email).toBe("a@example.com");
    const loggedIn = await authenticate("a@example.com", "password12");
    expect(loggedIn.id).toBe(user.id);
    await expect(authenticate("a@example.com", "wrong-pass")).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("does not let a gym-member checkbox verify membership", async () => {
    const user = await makeUser("member@example.com", true);
    const profile = await getProfileForUser(user.id);
    expect(profile?.claimsGymMembership).toBe(true);
    expect(profile?.gymMembershipVerified).toBe(false);

    const updated = await updateProfileForUser(user.id, {
      displayName: "Member",
      goals: "Get stronger",
      experienceLevel: "beginner",
      equipment: ["Dumbbells"],
      weeklyAvailability: ["Monday"],
      hoursPerWeek: 4,
      preferredUnits: "lb",
      claimsGymMembership: true,
      foodPreferences: "",
      allergies: "",
    });
    expect(updated.gymMembershipVerified).toBe(false);
  });

  it("resets a password with a preview token and blocks the old password", async () => {
    await makeUser("reset@example.com");
    const requested = await requestPasswordReset("reset@example.com");
    expect(requested.resetUrl).toBeTruthy();
    const token = new URL(requested.resetUrl as string).searchParams.get("token");
    expect(token).toBeTruthy();
    await resetPasswordWithToken(token as string, "newpass123");
    await expect(authenticate("reset@example.com", "password12")).rejects.toBeInstanceOf(
      AuthError,
    );
    const again = await authenticate("reset@example.com", "newpass123");
    expect(again.email).toBe("reset@example.com");
  });

  it("changes password only when the current password is correct", async () => {
    const user = await makeUser("change@example.com");
    await expect(
      changePassword(user.id, "nope-nope", "newpass123"),
    ).rejects.toBeInstanceOf(AuthError);
    await changePassword(user.id, "password12", "newpass123");
    await expect(authenticate("change@example.com", "password12")).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});

describe("ownership isolation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks user B from reading, editing, or deleting user A's workout", async () => {
    const userA = await makeUser("owner@example.com");
    const userB = await makeUser("other@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];

    const workout = await startWorkoutFromDay({
      userId: userA.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });

    const owned = await getWorkoutSessionForUser(workout.id, userA.id);
    expect(owned.id).toBe(workout.id);
    expect(owned.userId).toBe(userA.id);

    await expect(
      getWorkoutSessionForUser(workout.id, userB.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const leaked = await tryReadWorkoutByIdForUser(workout.id, userB.id);
    expect(leaked).toBeNull();
    expect(await getOwnWorkoutSessionOrNull(workout.id, userB.id)).toBeNull();
    expect(await getOwnWorkoutSessionOrNull(workout.id, userA.id)).toMatchObject({
      id: workout.id,
      userId: userA.id,
    });

    await expect(
      updateWorkoutSessionForUser({
        userId: userB.id,
        workoutId: workout.id,
        title: "Hacked",
        performedAt: new Date(),
        notes: "should fail",
        status: "complete",
        sets: [
          {
            exerciseName: "Goblet squat",
            setNumber: 1,
            reps: 8,
            loadValue: 999,
            loadUnit: "lb",
            completed: true,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      deleteWorkoutSessionForUser(workout.id, userB.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const stillThere = await prisma.workoutSession.findUnique({
      where: { id: workout.id },
    });
    expect(stillThere?.title).not.toBe("Hacked");
    expect(stillThere?.userId).toBe(userA.id);
  });

  it("returns not found when the workout id does not exist", async () => {
    const user = await makeUser("lonely@example.com");
    await expect(
      getWorkoutSessionForUser("missing-id", user.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets the owner correct a mistaken load", async () => {
    const user = await makeUser("fix@example.com");
    const program = await getDemoProgram();
    const workout = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });

    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: workout.id,
      title: workout.title,
      performedAt: new Date("2026-09-20T12:00:00Z"),
      notes: "first pass",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 50,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });

    const corrected = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: workout.id,
      title: workout.title,
      performedAt: new Date("2026-09-20T12:00:00Z"),
      notes: "fixed the load",
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

    expect(corrected.notes).toBe("fixed the load");
    expect(corrected.sets[0]?.loadValue).toBe(40);
  });
});

describe("units", () => {
  it("converts pounds and kilos both ways", () => {
    expect(Math.round(convertLoad(220, "lb", "kg"))).toBe(100);
    expect(Math.round(convertLoad(100, "kg", "lb"))).toBe(220);
  });
});
