import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import {
  formatOneDecimal,
  parseOneDecimal,
  recordWeightEntryForUser,
  getLatestBodyMetricsForUser,
} from "@/lib/body-metrics";
import {
  sessionCountsAsPlannedCompletion,
  tickedSetCount,
} from "@/lib/logged-work";
import { sessionSetCount } from "@/lib/share-card";
import { freeCoachChatDaysRemaining } from "@/lib/coach-access";
import { currentPlanLine } from "@/lib/trial";
import { memberProCopy } from "@/lib/member-pro-reminders";
import { getCalendarSchedule } from "@/lib/calendar";
import { formatDayParam } from "@/lib/home";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";

const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("one-decimal body weight", () => {
  it("parses and formats a single tenth", () => {
    expect(parseOneDecimal("181.2")).toBe(181.2);
    expect(parseOneDecimal("181.")).toBe(181);
    expect(parseOneDecimal("181,2")).toBe(181.2);
    expect(formatOneDecimal(181.2)).toBe("181.2");
    expect(formatOneDecimal(181)).toBe("181.0");
    expect(formatOneDecimal(181.24)).toBe("181.2");
  });

  it("stores weight as a float, not an integer column", () => {
    const bodyStart = schema.indexOf("model BodyMetric");
    const bodyEnd = schema.indexOf("\nmodel ", bodyStart + 10);
    expect(schema.slice(bodyStart, bodyEnd)).toMatch(/value\s+Float/);
    const checkStart = schema.indexOf("model WeeklyCheckIn {");
    const checkEnd = schema.indexOf("\nmodel ", checkStart + 10);
    expect(schema.slice(checkStart, checkEnd)).toMatch(/bodyweightLb\s+Float\?/);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves 181.2 and reads 181.2 back", async () => {
    const user = await makeUser("qa-weight@example.com");
    await recordWeightEntryForUser(user.id, {
      value: parseOneDecimal("181.2"),
      unit: "lb",
      recordedAt: new Date("2026-10-21T15:00:00.000Z"),
    });
    const latest = await getLatestBodyMetricsForUser(user.id);
    const weight = latest.get("weight");
    expect(weight?.value).toBe(181.2);
    expect(formatOneDecimal(weight?.value ?? 0)).toBe("181.2");
  });
});

describe("completion counts ticked sets on the planned session", () => {
  const bike = ["Assault bike"];
  const pushUp = {
    exerciseName: "Push-up",
    completed: true,
    reps: 10,
    loadValue: null,
    durationSeconds: null,
  };
  const bikeSet = {
    exerciseName: "Assault bike",
    completed: true,
    reps: null,
    loadValue: null,
    durationSeconds: 60,
  };
  const empty = {
    exerciseName: "Assault bike",
    completed: true,
    reps: null,
    loadValue: null,
    durationSeconds: null,
  };

  it("does not finish a bike day from a ticked push-up", () => {
    expect(
      sessionCountsAsPlannedCompletion(
        { status: "complete", sets: [pushUp, empty, empty, empty] },
        bike,
      ),
    ).toBe(false);
    expect(
      sessionCountsAsPlannedCompletion(
        { status: "draft", sets: [bikeSet] },
        bike,
      ),
    ).toBe(false);
    expect(
      sessionCountsAsPlannedCompletion(
        { status: "complete", sets: [bikeSet, empty, empty, empty] },
        bike,
      ),
    ).toBe(true);
  });

  it("counts ticked sets, not every planned row", () => {
    const sets = [bikeSet, { ...empty, completed: false }, empty, empty];
    expect(tickedSetCount(sets)).toBe(1);
    expect(sessionSetCount(sets)).toBe(1);
  });
});

describe("trial copy uses the real clocks", () => {
  it("counts the free coach week from signup, not from a later trial end", () => {
    const now = new Date("2026-10-21T00:00:00.000Z");
    const createdAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(
      freeCoachChatDaysRemaining({
        now,
        createdAt,
        trialEndsAt,
        memberProStartedAt: null,
      }),
    ).toBe(5);
  });

  it("names the 7-day trial and the member grant separately from days left", () => {
    expect(
      currentPlanLine({
        trialActive: true,
        trialDaysLeft: 5,
        trialLengthDays: 7,
        planLabel: "SVG Pro",
      }),
    ).toBe("7-day Pro trial, 5 days left");
    expect(
      currentPlanLine({
        trialActive: true,
        trialDaysLeft: 5,
        trialLengthDays: 14,
        verified: true,
        planLabel: "SVG Academy",
      }),
    ).toBe("14-day free Pro, 5 days left");
    expect(memberProCopy("day25", { workouts: 1, checkIns: 0, aiMessages: 0 }, 4).title).toBe(
      "4 days left of free Pro",
    );
  });
});

describe("clips, VIP date, draft notice, and coach clearance", () => {
  it("says VIP Coaching on /clips and never SVG Pro", () => {
    const page = readFileSync("src/app/(member)/clips/page.tsx", "utf8");
    expect(page).toContain("VIP Coaching");
    expect(page).not.toContain("SVG Pro");
    expect(page).not.toContain("PaywallNotice");
  });

  it("clears and disables the fight date when there is no fight", () => {
    const form = readFileSync("src/components/vip/VipApplyForm.tsx", "utf8");
    expect(form).toContain("disabled={noFight}");
    expect(form).toContain('value={noFight ? "" : fightDate}');
  });

  it("shows a dismissible draft notice and one rest number", () => {
    const form = readFileSync("src/components/training/WorkoutLogForm.tsx", "utf8");
    expect(form).toContain('data-draft-saved');
    expect(form).toContain("Draft saved");
    expect(form).toContain("exerciseRestSeconds(name)");
    expect(form).toContain("exerciseRestSeconds(cursor.exerciseName)");
  });

  it("lifts the coach button above the undo toast and pads train, bag, and calendar", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("bottom: calc(9.25rem + env(safe-area-inset-bottom, 0px));");
    expect(readFileSync("src/app/(member)/training/page.tsx", "utf8")).toContain("data-coach-page");
    expect(readFileSync("src/app/(member)/bagwork/page.tsx", "utf8")).toContain("data-coach-page");
    expect(readFileSync("src/app/(member)/training/calendar/page.tsx", "utf8")).toContain(
      "data-coach-page",
    );
    expect(readFileSync("src/components/training/RemoveToast.tsx", "utf8")).toContain(
      "data-remove-toast",
    );
  });
});

describe("a push-up does not complete a bike day on the calendar", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("leaves the bike session scheduled when the only ticked set is a push-up", async () => {
    const user = await makeUser("qa-bike-pushup@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        weeklyAvailabilityJson: JSON.stringify([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ]),
        timeZone: "UTC",
      },
    });
    const now = new Date("2026-10-21T16:00:00.000Z");
    const before = await getCalendarSchedule(user.id, now, now);
    const bike = before.days
      .flatMap((day) => day.activities.map((activity) => ({ day, activity })))
      .find((row) => row.activity.kind === "workout" && /bike/i.test(row.activity.title));
    expect(bike?.activity.programDayId).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: bike?.activity.programDayId ?? "",
      preferredUnits: "lb",
      timeZone: "UTC",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Push-up",
          setNumber: 1,
          reps: 10,
          loadValue: null,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const after = await getCalendarSchedule(user.id, now, now);
    const key = formatDayParam(bike!.day.date, "UTC");
    const card = after.days
      .find((day) => formatDayParam(day.date, "UTC") === key)
      ?.activities.find((item) => item.programDayId === bike?.activity.programDayId);
    expect(card?.status).toBe("scheduled");
  });
});
