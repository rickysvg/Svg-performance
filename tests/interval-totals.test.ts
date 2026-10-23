import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntervalStructureFields } from "@/components/training/IntervalStructureFields";
import { intervalDurationCapMessage } from "@/lib/interval-shorthand";
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

  it("shows the 4 hour cap instead of a multi-hour clock", () => {
    const html = renderToStaticMarkup(
      createElement(IntervalStructureFields, {
        shorthand: "10x30 @ 15:00/10:00 r600",
        structure: { sets: 10, rounds: 30, workSeconds: 900, restSeconds: 600, setRestSeconds: 600 },
        done: 1,
        totalType: "bag",
        presets: [],
        onShorthandCommit: () => undefined,
        onStructure: () => undefined,
        onDone: () => undefined,
      }),
    );
    const configured = intervalTotals(
      "bag",
      { sets: 10, rounds: 30, workSeconds: 900, restSeconds: 600, setRestSeconds: 600 },
      300,
    );
    expect(html).toContain("Max 4:00:00");
    expect(html).toContain(intervalDurationCapMessage(configured.totalSeconds));
    expect(html).toContain(`data-testid="interval-total-time">Max 4:00:00`);
    expect(html).not.toContain("240:00");
    expect(html).not.toContain("7490:00");
  });

  it("shows exactly 4 hours as 4:00:00", () => {
    const html = renderToStaticMarkup(
      createElement(IntervalStructureFields, {
        shorthand: "10x1 @ 15:00/0 r600",
        structure: { sets: 10, rounds: 1, workSeconds: 900, restSeconds: 0, setRestSeconds: 600 },
        done: 10,
        totalType: "bag",
        presets: [],
        onShorthandCommit: () => undefined,
        onStructure: () => undefined,
        onDone: () => undefined,
      }),
    );
    expect(html).toContain('data-testid="interval-total-time">4:00:00');
    expect(html).not.toContain("240:00");
    expect(html).not.toContain("Max 4:00:00");
  });
});
