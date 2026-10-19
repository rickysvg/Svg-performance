import { describe, expect, it } from "vitest";
import { mergeReplacementSets } from "@/lib/exercise-swap-store";
import { visibleExerciseNote } from "@/lib/exercise-log-mode";
import { homeSubtitle } from "@/lib/member-copy";
import { omitSwapFirstMarks } from "@/lib/personal-bests";
import { limitCardFooter } from "@/lib/pricing";
import { sameDaySparringEaseNote } from "@/lib/recovery-ease";
import { pickLatestSparringRatings, sparringDateError, sparringWeekTotals } from "@/lib/outside-log";
import { sparringTileHint } from "@/lib/sparring-tile";
import { sessionDurationSeconds } from "@/lib/share-card";
import { APP_TIMEZONE } from "@/lib/timezone";
import { formatHistoryWhen, sameDaySessionOrdinal } from "@/lib/workout-complete";
import { summaryReadAction } from "@/lib/coach/browser-speech";

const DENVER = APP_TIMEZONE;

describe("swap does not delete a logged set", () => {
  it("merges into an exercise already in the workout and keeps both logs", () => {
    const merged = mergeReplacementSets(
      [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb" as const,
          logMode: "load_reps" as const,
          completed: true,
          rir: "2-3 RIR",
        },
        {
          exerciseName: "Reverse lunge",
          setNumber: 1,
          reps: 6,
          loadValue: 20,
          loadUnit: "lb" as const,
          logMode: "load_reps" as const,
          completed: true,
          rir: "2-4 RIR",
        },
      ],
      ["Goblet squat"],
      {
        name: "Reverse lunge",
        sets: 3,
        reps: "8 / leg",
        loadText: "2-4 RIR",
        logMode: "load_reps",
      },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    );
    expect(merged.some((set) => set.exerciseName === "Goblet squat")).toBe(false);
    expect(merged.some((set) => set.loadValue === 40 && set.reps === 8)).toBe(true);
    expect(merged.some((set) => set.loadValue === 20 && set.reps === 6)).toBe(true);
    expect(new Set(merged.map((set) => set.exerciseName))).toEqual(new Set(["Reverse lunge"]));
    expect(merged.map((set) => set.exerciseName).join(" ")).not.toMatch(/\(2\)/);
  });

  it("keeps a logged set when the log type changes and drops a (2) suffix", () => {
    const merged = mergeReplacementSets(
      [
        {
          exerciseName: "Trap-bar deadlift",
          setNumber: 1,
          reps: 5,
          loadValue: 95,
          loadUnit: "lb" as const,
          logMode: "load_reps" as const,
          completed: true,
        },
      ],
      ["Trap-bar deadlift"],
      {
        name: "Romanian deadlift (2)",
        sets: 4,
        reps: "5",
        loadText: "0-2 RIR · flat back",
        logMode: "load_reps",
      },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    );
    expect(merged[0]?.exerciseName).toBe("Romanian deadlift");
    expect(merged.map((set) => set.exerciseName).join(" ")).not.toMatch(/\(2\)/);
    expect(merged[0]?.reps).toBe(5);
    expect(merged[0]?.loadValue).toBe(95);
    expect(merged[0]?.completed).toBe(true);
    expect(merged.every((set) => set.rir === "0-2 RIR")).toBe(true);
    expect(merged).toHaveLength(4);
  });
});

describe("finish screen matches the logger clock and the day's session", () => {
  it("does not show 0:00 when the clock has been running for hours", () => {
    const start = new Date("2026-10-19T10:00:00.000Z");
    const seconds = sessionDurationSeconds({
      title: "Lower body",
      status: "complete",
      performedAt: start,
      createdAt: start,
      updatedAt: new Date(start.getTime() + 477 * 60 * 1000),
      sets: [
        {
          exerciseName: "Goblet squat",
          reps: 8,
          loadValue: 25,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    expect(seconds).toBe(477 * 60);
  });

  it("numbers the second workout of the local day as session 2", () => {
    const morning = new Date("2026-10-19T15:00:00.000Z");
    const afternoon = new Date("2026-10-19T22:00:00.000Z");
    const sessions = [
      { id: "earlier-day", performedAt: new Date("2026-10-18T18:00:00.000Z"), updatedAt: morning },
      { id: "first", performedAt: morning, updatedAt: morning },
      { id: "second", performedAt: afternoon, updatedAt: afternoon },
    ];
    expect(sameDaySessionOrdinal("second", sessions, DENVER)).toBe(2);
    expect(sameDaySessionOrdinal("first", sessions, DENVER)).toBe(1);
  });
});

describe("a swap does not invent a first-mark PR", () => {
  it("drops a first mark on the replacement and keeps a real improvement", () => {
    const kept = omitSwapFirstMarks(
      [
        {
          exerciseName: "Romanian deadlift",
          previousValue: null,
          detail: "Romanian deadlift · first mark",
        },
        {
          exerciseName: "Goblet squat",
          previousValue: 40,
          detail: "Goblet squat · +10 lb on your last best",
        },
      ],
      ["Romanian deadlift"],
    );
    expect(kept.map((row) => row.exerciseName)).toEqual(["Goblet squat"]);
  });
});

describe("retest copy", () => {
  it("names the sparring rating on the tile", () => {
    expect(sparringTileHint({ bodyRating: 4 })).toBe("Body 4/5");
    expect(sparringTileHint({ sessionRating: 4 })).toBe("Session 4/5");
  });

  it("shows an error for a future sparring day and skips future totals", () => {
    const now = new Date("2026-10-19T18:00:00.000Z");
    expect(sparringDateError("2026-10-20", now, DENVER)).toMatch(/Future days stay closed/);
    expect(sparringDateError("2026-10-19", now, DENVER)).toBeNull();
    const totals = sparringWeekTotals(
      [
        { dateKey: "2026-10-19", rounds: 3, minutesPerRound: 3 },
        { dateKey: "2026-10-20", rounds: 7, minutesPerRound: 5 },
      ],
      "2026-10-19",
    );
    expect(totals.rounds).toBe(3);
    expect(totals.minutes).toBe(9);
    expect(totals.logs).toHaveLength(1);
    expect(
      pickLatestSparringRatings(
        [
          { dateKey: "2026-10-19", bodyRating: 4, sessionRating: 3 },
          { dateKey: "2026-10-20", bodyRating: 5, sessionRating: 5 },
        ],
        "2026-10-19",
      ),
    ).toEqual({ bodyRating: 4, sessionRating: 3 });
  });

  it("does not call today's sparring yesterday", () => {
    const note = sameDaySparringEaseNote({ bodyRating: 2, soreSpots: [] });
    expect(note).toMatch(/Tomorrow eases/);
    expect(note).not.toMatch(/yesterday/i);
  });

  it("matches pricing on the limit card and uses the local clock", () => {
    expect(limitCardFooter()).toMatch(/\$9\.99\/mo/);
    expect(limitCardFooter()).toMatch(/Paid checkout opens Nov 16/);
    expect(limitCardFooter()).not.toMatch(/coming soon/i);
    const formatted = formatHistoryWhen(new Date("2026-10-19T19:27:00.000Z"), DENVER);
    expect(formatted).toMatch(/1:27/);
    expect(formatted).toMatch(/PM/);
  });

  it("hides a repeated home subtitle and a repeated shadowbox round 2 line", () => {
    expect(homeSubtitle("SVG Performance", "Alex")).toBe("");
    expect(homeSubtitle("Get stronger — Get stronger", "Alex")).toBe("Get stronger");
    expect(homeSubtitle("Fight shape", "Alex")).toBe("Fight shape");
    const note = visibleExerciseNote(
      "Shadowbox round 2 — hand weights",
      "Round 2, same jab ideas with light hand weights. Log the clock and the lbs. Log seconds and lbs.",
    );
    expect(note.toLowerCase()).not.toMatch(/round 2/);
    expect(note.toLowerCase()).not.toMatch(/log seconds/);
    expect(note).toMatch(/jab ideas/);
  });

  it("blocks read-aloud before playback when none remain", () => {
    expect(summaryReadAction({ phase: "idle", readAloudsLeft: 0 })).toBe("blocked");
    expect(summaryReadAction({ phase: "idle", readAloudsLeft: 1 })).toBe("play");
  });
});
