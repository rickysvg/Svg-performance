import { describe, expect, it } from "vitest";
import {
  clampIntervalStructure,
  commitShorthand,
  commitStructure,
  draftCount,
  formatIntervalClock,
  formatIntervalShorthand,
  formatSessionSummary,
  intervalDurationCapMessage,
  intervalWorkMax,
  parseIntervalShorthand,
  shorthandLineState,
  stepSeconds,
} from "@/lib/interval-shorthand";

const base = { sets: 1, rounds: 8, workSeconds: 20, restSeconds: 10, setRestSeconds: 60 };

describe("interval shorthand", () => {
  it("parses sets, a single block, tabata, and emom", () => {
    expect(parseIntervalShorthand("2x8 @ 15/15 r60")).toEqual({
      ok: true,
      value: { sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 },
    });
    expect(parseIntervalShorthand("8x20/10")).toEqual({
      ok: true,
      value: { sets: 1, rounds: 8, workSeconds: 20, restSeconds: 10, setRestSeconds: null },
    });
    expect(parseIntervalShorthand("tabata").ok).toBe(true);
    expect(parseIntervalShorthand("emom 10")).toEqual({
      ok: true,
      value: { sets: 1, rounds: 10, workSeconds: 60, restSeconds: 0, setRestSeconds: null },
    });
    expect(parseIntervalShorthand("2x8 @ 3:00/1:00 r1:00")).toMatchObject({
      ok: true,
      value: { sets: 2, rounds: 8, workSeconds: 180, restSeconds: 60, setRestSeconds: 60 },
    });
  });

  it("rejects a one-digit clock and a stray m, and reads 15m as minutes", () => {
    expect(parseIntervalShorthand("8x1:5/10").ok).toBe(false);
    expect(parseIntervalShorthand("2x8 @ 15/15 m").ok).toBe(false);
    expect(parseIntervalShorthand("8x15m/15")).toMatchObject({
      ok: true,
      value: { sets: 1, rounds: 8, workSeconds: 900, restSeconds: 15 },
    });
    expect(parseIntervalShorthand("8x20/10 r1m")).toMatchObject({
      ok: true,
      value: { setRestSeconds: 60 },
    });
  });

  it("rejects live-timer limits and a block longer than 4 hours", () => {
    expect(parseIntervalShorthand("10x50 @ 5/60:00 r600").ok).toBe(false);
    expect(parseIntervalShorthand("2x8 @ 15/15m").ok).toBe(false);
    expect(parseIntervalShorthand("10x30 @ 15:00/10:00 r600")).toMatchObject({
      ok: false,
      error: expect.stringContaining("Max 4:00:00"),
    });
    expect(parseIntervalShorthand("2x8 @ 15m/15").ok).toBe(false);
    const kept = commitShorthand("2x8 @ 14:50/10", { ...base, setRestSeconds: 600 });
    expect(kept.error).toBe("That workout is 4:09:40. Max 4:00:00.");
    expect(kept.error).not.toBe("Try 2x8 @ 15/15");
    expect(kept.structure).toEqual({ ...base, setRestSeconds: 600 });
  });

  it("writes an hour or more as H:MM:SS", () => {
    expect(formatIntervalClock(540)).toBe("9:00");
    expect(formatIntervalClock(14400)).toBe("4:00:00");
    expect(formatIntervalClock(14400)).not.toBe("240:00");
    expect(intervalDurationCapMessage(14980)).toBe("That workout is 4:09:40. Max 4:00:00.");
  });

  it("keeps the steppers when the line is not a structure", () => {
    expect(parseIntervalShorthand("heavy bag")).toEqual({ ok: false, error: "Try 2x8 @ 15/15" });
    expect(commitShorthand("nope", base)).toEqual({ structure: base, error: "Try 2x8 @ 15/15" });
    const kept = commitShorthand("8x15/15", base);
    expect(kept.error).toBe("");
    expect(kept.structure.setRestSeconds).toBe(60);
  });

  it("formats the field and the save label", () => {
    expect(
      formatIntervalShorthand({ sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 }),
    ).toBe("2x8 @ 15/15 r60");
    expect(formatIntervalShorthand({ sets: 1, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 })).toBe(
      "8x15/15",
    );
    expect(formatSessionSummary({ sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15 })).toBe("2×8 @ 15/15");
    expect(commitStructure({ sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 }).shorthand).toBe(
      "2x8 @ 15/15 r60",
    );
  });

  it("accepts one continuous round up to 4 hours and keeps 15:00 for more rounds", () => {
    expect(parseIntervalShorthand("1x22:00/0")).toMatchObject({
      ok: true,
      value: { sets: 1, rounds: 1, workSeconds: 22 * 60, restSeconds: 0 },
    });
    expect(parseIntervalShorthand("1x240:00/0")).toMatchObject({
      ok: true,
      value: { workSeconds: 4 * 60 * 60, restSeconds: 0 },
    });
    expect(parseIntervalShorthand("1x240:01/0")).toMatchObject({
      ok: false,
      error: "That workout is 4:00:01. Max 4:00:00.",
    });
    expect(parseIntervalShorthand("2x1 @ 22:00/0").ok).toBe(false);
    expect(parseIntervalShorthand("1x22:00/10").ok).toBe(false);
    expect(intervalWorkMax({ sets: 1, rounds: 1, restSeconds: 0 })).toBe(4 * 60 * 60);
    expect(intervalWorkMax({ sets: 2, rounds: 1, restSeconds: 0 })).toBe(15 * 60);
    expect(
      clampIntervalStructure({ sets: 1, rounds: 1, workSeconds: 22 * 60, restSeconds: 0, setRestSeconds: 0 }).workSeconds,
    ).toBe(22 * 60);
    expect(
      clampIntervalStructure({ sets: 1, rounds: 2, workSeconds: 22 * 60, restSeconds: 0, setRestSeconds: 0 }).workSeconds,
    ).toBe(15 * 60);
  });

  it("uses the bike total, including rest after the last sprint, for the line cap", () => {
    expect(parseIntervalShorthand("10x1 @ 15:00/10:00 r600", "round").ok).toBe(true);
    expect(parseIntervalShorthand("10x1 @ 15:00/10:00 r600", "bike")).toEqual({
      ok: false,
      error: "That workout is 5:40:00. Max 4:00:00.",
    });
    const current = { sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 };
    const kept = commitShorthand("10x1 @ 15:00/10:00 r600", current, "bike");
    expect(kept.structure).toEqual(current);
    expect(kept.error).toBe("That workout is 5:40:00. Max 4:00:00.");
    const blocked = shorthandLineState("10x30 @ 60/60 r120", current, "bike");
    expect(blocked.blocked).toBe(true);
    expect(blocked.matches).toBe(false);
    expect(blocked.error).toContain("Max 4:00:00");
    const same = shorthandLineState("2x8 @ 15/15 r60", current);
    expect(same).toEqual({ error: "", matches: true, blocked: false });
  });

  it("reads a typed Done of 0 before the field blurs", () => {
    expect(draftCount("0")).toBe(0);
    expect(draftCount("")).toBe(0);
    expect(draftCount("12")).toBe(12);
    expect(draftCount("1a")).toBeNull();
  });

  it("steps by 5 under a minute and lands on 60", () => {
    expect(stepSeconds(55, 1, 5, 3600)).toBe(60);
    expect(stepSeconds(60, -1, 5, 3600)).toBe(55);
    expect(stepSeconds(60, 1, 5, 3600)).toBe(75);
    expect(stepSeconds(15, -1, 5, 3600)).toBe(10);
  });
});
