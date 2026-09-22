import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  getDueReminders,
  processDueRemindersForUser,
  saveReminderPrefs,
} from "@/lib/reminders";
import { setMailSenderForTests } from "@/lib/mail";
import { createNutritionEntryForUser } from "@/lib/nutrition";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { getDemoProgram } from "@/lib/programs";

describe("reminder preferences", () => {
  beforeEach(async () => {
    await resetDatabase();
    delete process.env.SMTP_HOST;
    setMailSenderForTests(null);
  });

  afterAll(async () => {
    delete process.env.SMTP_HOST;
    setMailSenderForTests(null);
    await prisma.$disconnect();
  });

  it("shows a due workout reminder after the preferred hour if nothing was logged", async () => {
    const user = await makeUser("remind@example.com");
    await saveReminderPrefs(user.id, {
      workoutEnabled: true,
      foodEnabled: false,
      quoteEnabled: false,
      preferredHour: 18,
      timezoneOffsetMinutes: 0,
    });
    const now = new Date("2026-09-21T19:30:00.000Z");
    const due = await getDueReminders(user.id, now);
    expect(due.map((row) => row.kind)).toEqual(["workout"]);
  });

  it("does not spam after a reminder was already shown the same local day", async () => {
    const user = await makeUser("nospam@example.com");
    await saveReminderPrefs(user.id, {
      workoutEnabled: true,
      foodEnabled: true,
      quoteEnabled: false,
      preferredHour: 8,
      timezoneOffsetMinutes: 0,
    });
    const now = new Date("2026-09-21T15:00:00.000Z");
    const first = await processDueRemindersForUser(user.id, user.email, now);
    expect(first.due.length).toBeGreaterThan(0);
    const second = await getDueReminders(user.id, now);
    expect(second).toEqual([]);
  });

  it("stays quiet when the type is disabled or already logged", async () => {
    const user = await makeUser("quiet@example.com");
    await saveReminderPrefs(user.id, {
      workoutEnabled: false,
      foodEnabled: true,
      quoteEnabled: false,
      preferredHour: 6,
      timezoneOffsetMinutes: 0,
    });
    const now = new Date("2026-09-21T12:00:00.000Z");
    await createNutritionEntryForUser(user.id, {
      name: "Eggs",
      mealType: "breakfast",
      servings: 1,
      servingLabel: "plate",
      calories: 200,
      proteinG: 18,
      carbsG: 2,
      fatG: 12,
      eatenAt: now,
    });
    expect(await getDueReminders(user.id, now)).toEqual([]);
  });

  it("emails only when SMTP is configured, otherwise in-app only", async () => {
    const user = await makeUser("mail@example.com");
    await saveReminderPrefs(user.id, {
      workoutEnabled: true,
      foodEnabled: false,
      quoteEnabled: false,
      preferredHour: 1,
      timezoneOffsetMinutes: 0,
    });
    const now = new Date("2026-09-21T12:00:00.000Z");
    const off = await processDueRemindersForUser(user.id, user.email, now);
    expect(off.smtpConfigured).toBe(false);
    expect(off.emailed).toBe(false);

    const user2 = await makeUser("mail2@example.com");
    await saveReminderPrefs(user2.id, {
      workoutEnabled: true,
      foodEnabled: false,
      quoteEnabled: false,
      preferredHour: 1,
      timezoneOffsetMinutes: 0,
    });
    process.env.SMTP_HOST = "smtp.test.local";
    const sent: string[] = [];
    setMailSenderForTests(async (input) => {
      sent.push(input.to);
      return { sent: true, reason: "sent" };
    });
    const on = await processDueRemindersForUser(
      user2.id,
      user2.email,
      now,
    );
    expect(on.smtpConfigured).toBe(true);
    expect(on.emailed).toBe(true);
    expect(sent).toEqual([user2.email]);
  });

  it("does not remind a workout after the member already logged one today", async () => {
    const user = await makeUser("trained@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const now = new Date("2026-09-21T20:00:00.000Z");
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
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
    await saveReminderPrefs(user.id, {
      workoutEnabled: true,
      foodEnabled: false,
      quoteEnabled: false,
      preferredHour: 18,
      timezoneOffsetMinutes: 0,
    });
    expect(await getDueReminders(user.id, now)).toEqual([]);
  });
});
