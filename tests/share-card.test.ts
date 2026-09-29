import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyShareWorkout,
  formatShareVolume,
  selectShareStats,
  SHARE_CARD_APP_LINK,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type ShareSessionLike,
} from "@/lib/share-card";

function session(partial: Partial<ShareSessionLike> & Pick<ShareSessionLike, "title" | "sets">): ShareSessionLike {
  return {
    performedAt: new Date("2026-09-27T16:00:00.000Z"),
    updatedAt: new Date("2026-09-27T17:05:00.000Z"),
    status: "complete",
    ...partial,
  };
}

describe("shareable workout card stats", () => {
  it("picks volume, sets, and time for lift days and defaults to lbs", () => {
    const lift = session({
      title: "Lower body + power",
      sets: [
        {
          exerciseName: "Back squat",
          reps: 5,
          loadValue: 225,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
        {
          exerciseName: "Back squat",
          reps: 5,
          loadValue: 225,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
        {
          exerciseName: "Romanian deadlift",
          reps: 8,
          loadValue: 185,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
      ],
    });
    expect(classifyShareWorkout(lift)).toBe("lift");
    expect(formatShareVolume(3905)).toBe("3,905");
    const stats = selectShareStats({ session: lift, streakDays: 4 });
    expect(stats.map((row) => row.key)).toEqual(["volume", "sets", "time", "streak"]);
    expect(stats[0]?.value).toBe("3,730");
    expect(stats[0]?.unit).toBe("lbs");
    expect(stats[0]?.unit).not.toBe("kg");
    expect(stats[1]?.value).toBe("3");
    expect(stats[2]?.value).toBe("65:00");
    expect(stats[3]?.value).toBe("4 days");
  });

  it("converts stored kg sets into lbs for the share card", () => {
    const lift = session({
      title: "Upper body",
      sets: [
        {
          exerciseName: "Bench press",
          reps: 5,
          loadValue: 100,
          loadUnit: "kg",
          logMode: "load_reps",
          completed: true,
        },
      ],
    });
    const stats = selectShareStats({ session: lift, displayUnit: "lb", streakDays: 0 });
    expect(stats.find((row) => row.key === "volume")?.value).toBe("1,102");
    expect(stats.find((row) => row.key === "volume")?.unit).toBe("lbs");
    expect(stats.find((row) => row.key === "volume")?.unit).not.toBe("kg");
    expect(stats.find((row) => row.key === "streak")).toBeUndefined();
  });

  it("picks rounds and time for bike or bag days", () => {
    const rounds = session({
      title: "Daru strong + bike rounds",
      sets: Array.from({ length: 12 }, () => ({
        exerciseName: "Assault bike intervals",
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "timed_round",
        durationSeconds: 180,
        completed: true,
      })),
    });
    expect(classifyShareWorkout(rounds)).toBe("rounds");
    const stats = selectShareStats({ session: rounds, streakDays: 9 });
    expect(stats.map((row) => row.key)).toEqual(["rounds", "time", "streak"]);
    expect(stats[0]).toEqual({ key: "rounds", label: "Rounds", value: "12" });
    expect(stats.find((row) => row.key === "volume")).toBeUndefined();
  });

  it("mixes rounds and volume when a session has both", () => {
    const mixed = session({
      title: "Strength + bag",
      sets: [
        {
          exerciseName: "Back squat",
          reps: 5,
          loadValue: 200,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
        {
          exerciseName: "Heavy bag",
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "timed_round",
          durationSeconds: 180,
          completed: true,
        },
      ],
    });
    expect(classifyShareWorkout(mixed)).toBe("mixed");
    const stats = selectShareStats({ session: mixed, streakDays: 1 });
    expect(stats.map((row) => row.key)).toEqual(["rounds", "volume", "time", "streak"]);
    expect(stats.find((row) => row.key === "streak")?.value).toBe("1 day");
  });

  it("omits empty stats and never invents numbers", () => {
    const empty = session({
      title: "Empty draft leftover",
      updatedAt: new Date("2026-09-27T16:01:00.000Z"),
      sets: [
        {
          exerciseName: "Back squat",
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: false,
        },
      ],
    });
    expect(selectShareStats({ session: empty, streakDays: 0 })).toEqual([]);
  });

  it("keeps the story card size, app link, and worldwide copy", () => {
    expect(SHARE_CARD_WIDTH).toBe(1080);
    expect(SHARE_CARD_HEIGHT).toBe(1920);
    expect(SHARE_CARD_APP_LINK).toBe("svg-performance.vercel.app");
    const files = [
      "src/lib/share-card.ts",
      "src/lib/share-card-render.ts",
      "src/components/share/WorkoutDoneCard.tsx",
      "src/app/(member)/training/log/[sessionId]/done/page.tsx",
    ];
    for (const rel of files) {
      const text = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(text.toLowerCase()).not.toContain("bout");
      expect(text).not.toMatch(/athlete name|displayName|firstName/i);
    }
    const render = fs.readFileSync(path.join(process.cwd(), "src/lib/share-card-render.ts"), "utf8");
    expect(render).toContain("400 ");
    expect(render).toContain("drawStatValue");
    expect(render).not.toContain("font-weight: 700");
    expect(render).toContain("SHARE_CARD_APP_LINK");
    const card = fs.readFileSync(
      path.join(process.cwd(), "src/components/share/WorkoutDoneCard.tsx"),
      "utf8",
    );
    expect(card).toContain("whitespace-nowrap");
    expect(card).toContain("font-sans");
    expect(card).toContain("border-transparent");
    const save = fs.readFileSync(path.join(process.cwd(), "src/app/actions/workouts.ts"), "utf8");
    expect(save).toContain("/done?celebrate=");
  });
});
