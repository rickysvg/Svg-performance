import { describe, expect, it } from "vitest";
import {
  commitShorthand,
  commitStructure,
  formatIntervalShorthand,
  formatSessionSummary,
  parseIntervalShorthand,
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
    expect(parseIntervalShorthand("2x8 @ 15/15m")).toMatchObject({
      ok: true,
      value: { restSeconds: 900 },
    });
    expect(parseIntervalShorthand("8x20/10 r1m")).toMatchObject({
      ok: true,
      value: { setRestSeconds: 60 },
    });
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

  it("steps by 5 under a minute and lands on 60", () => {
    expect(stepSeconds(55, 1, 5, 3600)).toBe(60);
    expect(stepSeconds(60, -1, 5, 3600)).toBe(55);
    expect(stepSeconds(60, 1, 5, 3600)).toBe(75);
    expect(stepSeconds(15, -1, 5, 3600)).toBe(10);
  });
});
