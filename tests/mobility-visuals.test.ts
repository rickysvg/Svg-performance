import { describe, expect, it } from "vitest";
import { IG_DRILLS } from "@/lib/ig-drills";
import { MOBILITY_ROUTINES } from "@/lib/mobility";
import { figureForBlock, figureForDrill, missingMobilityFigures } from "@/lib/mobility-poses";

describe("mobility position demos", () => {
  it("gives every routine stretch and every drill card a position figure", () => {
    expect(missingMobilityFigures()).toEqual([]);
    const keys = new Set<string>();
    for (const routine of MOBILITY_ROUTINES) {
      for (const block of routine.blocks) {
        keys.add(block.key);
        const spec = figureForBlock(block.key);
        expect(spec?.caption, block.name).toMatch(/\s/);
        expect(spec?.head).toBeTruthy();
      }
    }
    expect(keys.size).toBeGreaterThanOrEqual(30);
    for (const drill of IG_DRILLS) {
      expect(figureForDrill(drill.id)?.caption, drill.title).toMatch(/\s/);
    }
  });
});
