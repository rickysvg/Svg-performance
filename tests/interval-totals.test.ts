import { describe, expect, it } from "vitest";
import { intervalTotals } from "@/lib/interval-totals";

describe("interval totals", () => {
  it("counts bike rest after the last sprint, including set rest", () => {
    const full = intervalTotals(
      "bike",
      { sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 },
      16,
    );
    expect(full.totalRounds).toBe(16);
    expect(full.workSeconds).toBe(240);
    expect(full.totalSeconds).toBe(540);
    const partial = intervalTotals(
      "bike",
      { sets: 2, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 },
      10,
    );
    expect(partial.totalSeconds).toBe(338);
    expect(partial.workSeconds).toBe(150);
  });

  it("stops bag and shadow on the last work interval", () => {
    const bag = intervalTotals(
      "bag",
      { sets: 1, rounds: 5, workSeconds: 180, restSeconds: 60, setRestSeconds: 0 },
      5,
    );
    expect(bag.totalSeconds).toBe(1140);
    const shadow = intervalTotals(
      "shadow",
      {
        sets: 1,
        rounds: 2,
        workSeconds: 180,
        restSeconds: 60,
        setRestSeconds: 0,
        shadowRounds: [
          { workSeconds: 180, restSeconds: 60 },
          { workSeconds: 120, restSeconds: 30 },
        ],
      },
      2,
    );
    expect(shadow.totalSeconds).toBe(360);
    expect(shadow.workSeconds).toBe(300);
  });
});
