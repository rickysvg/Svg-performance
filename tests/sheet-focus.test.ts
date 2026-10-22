import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cycleFocusIndex, isSheetBackdropTarget } from "@/lib/sheet-focus";

describe("sheet focus", () => {
  it("cycles Tab and Shift+Tab inside a sheet", () => {
    expect(cycleFocusIndex(-1, 3, false)).toBe(0);
    expect(cycleFocusIndex(-1, 3, true)).toBe(2);
    expect(cycleFocusIndex(0, 3, true)).toBe(2);
    expect(cycleFocusIndex(2, 3, false)).toBe(0);
    expect(cycleFocusIndex(1, 3, false)).toBe(2);
    expect(cycleFocusIndex(0, 0, false)).toBe(-1);
  });

  it("treats only the backdrop itself as a dismiss target", () => {
    const backdrop = {};
    const child = {};
    expect(isSheetBackdropTarget(backdrop, backdrop)).toBe(true);
    expect(isSheetBackdropTarget(child, backdrop)).toBe(false);
    expect(isSheetBackdropTarget(null, backdrop)).toBe(false);
  });

  it("shares Escape, backdrop, and focus return on the training sheets", () => {
    const hook = readFileSync("src/components/useSheetBehavior.ts", "utf8");
    expect(hook).toContain('event.key === "Escape"');
    expect(hook).toContain("previously.focus()");
    for (const file of [
      "src/components/training/WorkoutMove.tsx",
      "src/components/training/ExerciseLibrarySheet.tsx",
      "src/components/training/SaveWorkoutButton.tsx",
      "src/components/home/HomeBodyWeight.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("useSheetBehavior");
      expect(source).toContain("onSheetBackdropMouseDown");
    }
    const fight = readFileSync("src/components/training/FightCampOptIn.tsx", "utf8");
    expect(fight).toContain("<label");
    expect(fight).toContain("I have a fight coming up");
  });
});
