import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toggleFightCampRow } from "@/components/training/FightCampOptIn";

describe("fight camp row", () => {
  it("turns the row off and cancels when camp is already showing", () => {
    expect(toggleFightCampRow({ nextChecked: false, shown: true })).toEqual({
      open: false,
      cancel: true,
    });
  });

  it("opens the fight form when the row is off", () => {
    expect(toggleFightCampRow({ nextChecked: true, shown: false })).toEqual({
      open: true,
      cancel: false,
    });
  });

  it("keeps the label and the switch on one control", () => {
    const source = readFileSync("src/components/training/FightCampOptIn.tsx", "utf8");
    const start = source.indexOf("data-fight-camp-row");
    const end = source.indexOf("</label>", start);
    const row = source.slice(start, end);
    expect(row).toContain("I have a fight coming up");
    expect(row).toContain('data-testid="training-fight-camp"');
    expect(row).toContain("data-fight-camp-switch");
    expect(row).toContain("Turn this on, then save the fight");
    expect(row).toContain("preventDefault");
  });
});
