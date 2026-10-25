import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildDaySummaryFacts,
  chooseSpokenScript,
  daySummaryPrompts,
  getTodayCoachSummary,
  summaryWordCount,
  templateDaySummary,
  type DaySummaryFacts,
} from "@/lib/coach/day-summary";
import { prisma } from "@/lib/prisma";
import type { DayPlan, ResolvedPlanSession } from "@/lib/week-plan";
import { makeUser, resetDatabase } from "./helpers";

function plan(partial: Partial<DayPlan>): DayPlan {
  return {
    weekday: "Friday",
    active: true,
    optionalDay: false,
    summary: "Bag+Lift",
    sessions: [],
    deload: false,
    testingWeek: false,
    mesoBlock: "A",
    mesoLabel: "Block A",
    outside: null,
    ...partial,
  };
}

function session(partial: Partial<ResolvedPlanSession> & Pick<ResolvedPlanSession, "kind" | "title">): ResolvedPlanSession {
  return {
    slot: "A",
    label: partial.title,
    subtitle: "",
    optional: false,
    ...partial,
  };
}

function factsFor(partial: Partial<Parameters<typeof buildDaySummaryFacts>[0]> = {}): DaySummaryFacts {
  return buildDaySummaryFacts({
    coachId: "ricky",
    coachingStyle: "tough",
    plan: plan({ weekday: "Monday", summary: "Bag+Lift" }),
    sessions: [
      session({
        kind: "skill",
        title: "Bag — intelligent jab",
        label: "Bag — intelligent jab",
        sourceWeekday: "Monday",
        heavy: true,
      }),
      session({
        slot: "B",
        kind: "strength",
        title: "Strength — lower (squat / hinge)",
        label: "Strength — lower (squat / hinge)",
        dayNumber: 1,
        heavy: true,
      }),
    ],
    exercisesByDayNumber: new Map([
      [1, [{ name: "Back squat", loadText: "0-2 RIR · heavy" }]],
    ]),
    experienceLevel: "intermediate",
    weekIndex: 0,
    ...partial,
  });
}

describe("today's coach summary script", () => {
  it("covers a training day in Ricky's voice with bag and lift cues", () => {
    const facts = factsFor();
    const script = templateDaySummary(facts);
    const words = summaryWordCount(script);
    expect(script).toMatch(/^Ricky here/);
    expect(script).toMatch(/intelligent jab/i);
    expect(script).toMatch(/reps in reserve/);
    expect(script).toMatch(/four sets/);
    expect(script).toMatch(/Back squat/);
    expect(script).not.toMatch(/Coach Savage/);
    expect(script).not.toMatch(/\bRIR\b/);
    expect(words).toBeGreaterThanOrEqual(60);
    expect(words).toBeLessThanOrEqual(160);

    const prompts = daySummaryPrompts(facts);
    expect(prompts.system).toMatch(/Ricky/);
    expect(prompts.system).toMatch(/80 to 140 words/);
    expect(prompts.user).toMatch(/intelligent jab/);
    expect(prompts.user).toMatch(/reps in reserve/);
  });

  it("keeps rest and sparring short and on the day", () => {
    const rest = templateDaySummary(
      factsFor({
        plan: plan({
          weekday: "Sunday",
          active: false,
          summary: "Off",
          skipReason: "Rest or light mobility. Core plan — not a fight camp.",
        }),
        sessions: [
          session({ kind: "rest", title: "Rest day", subtitle: "Off" }),
        ],
      }),
    );
    expect(rest).toMatch(/rest day/i);
    expect(rest).toMatch(/Nothing to log/);
    expect(rest).not.toMatch(/Back squat/);
    expect(summaryWordCount(rest)).toBeLessThan(90);

    const sparring = templateDaySummary(
      factsFor({
        plan: plan({
          weekday: "Saturday",
          summary: "Sparring",
          outside: { kind: "sparring", label: "Sparring" },
          dayNote: "No app workout — log rounds after you spar.",
        }),
        sessions: [],
      }),
    );
    expect(sparring).toMatch(/sparring/i);
    expect(sparring).toMatch(/no app workout/i);
    expect(sparring).toMatch(/head gets rung/i);
    expect(sparring).not.toMatch(/Back squat/);
    expect(summaryWordCount(sparring)).toBeLessThan(110);
  });

  it("drops a model reply that is too short and keeps a spoken one", () => {
    const fallback = "Ricky here. Friday. You have bag work. Show up.";
    expect(chooseSpokenScript("Too short.", fallback, "train")).toBe(fallback);
    const spoken = Array.from({ length: 90 }, () => "work").join(" ");
    expect(chooseSpokenScript(spoken, fallback, "train")).toBe(spoken);
    expect(chooseSpokenScript("I'm sorry, I cannot help with that request today at all.", fallback, "train")).toBe(
      fallback,
    );
  });
});

describe("a bike moved onto Friday", () => {
  it("says the ride dose once", () => {
    const facts = buildDaySummaryFacts({
      plan: plan({ weekday: "Friday", summary: "Conditioning+Cardio" }),
      sessions: [
        session({
          kind: "conditioning",
          title: "Cardio — bike",
          label: "Cardio — bike",
          dayNumber: 5,
          sourceWeekday: "Wednesday",
        }),
      ],
      weekIndex: 0,
      experienceLevel: "intermediate",
    });
    const lines = facts.sessions.flatMap((row) => row.lines);
    const dose = lines.filter((line) => /10 seconds all-out/.test(line) || /50 seconds easy/.test(line));
    expect(dose).toHaveLength(1);
    expect(lines.join(" ")).not.toMatch(/pedaling/i);
    expect(lines.join(" ")).not.toMatch(/10 seconds all-out[\s\S]*10 seconds all-out/);
  });
});

describe("today's coach summary cache", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores one briefing per member per day and reuses it", async () => {
    const user = await makeUser("summary@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { aiCoachId: "ricky", coachingStyle: "tough" },
    });
    let calls = 0;
    const synthesize = async () => {
      calls += 1;
      return {
        audio: Buffer.alloc(64, 7),
        mime: "audio/mpeg",
        voice: "onyx",
      };
    };
    const now = new Date("2026-10-16T18:00:00Z");
    const first = await getTodayCoachSummary(user.id, {
      now,
      complete: async () => null,
      synthesize,
    });
    const second = await getTodayCoachSummary(user.id, {
      now,
      complete: async () => {
        throw new Error("should not regenerate");
      },
      synthesize: async () => {
        throw new Error("should not resynthesize");
      },
    });
    expect(first.cached).toBe(false);
    expect(first.coachId).toBe("ricky");
    expect(first.voice).toBe("onyx");
    expect(first.source).toBe("template");
    expect(first.script.length).toBeGreaterThan(40);
    expect(first.audio?.byteLength).toBe(64);
    expect(calls).toBe(1);
    expect(second.cached).toBe(true);
    expect(second.script).toBe(first.script);
    expect(second.audio?.byteLength).toBe(64);
    const rows = await prisma.coachDaySummary.count({ where: { userId: user.id } });
    expect(rows).toBe(1);
  });
});
