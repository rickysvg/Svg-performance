import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { anchorPopover } from "@/lib/popover-anchor";

describe("exercise menu anchor", () => {
  it("keeps a left-side logger menu inside a 390px phone", () => {
    const trigger = { left: 100, top: 420, right: 144, bottom: 452, width: 44, height: 32 };
    const menu = { width: 176, height: 96 };
    const viewport = { width: 390, height: 844 };
    const oldLeft = trigger.right - menu.width;
    expect(oldLeft).toBeLessThan(0);
    const placed = anchorPopover(trigger, menu, viewport);
    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.left + menu.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(placed.top).toBeGreaterThanOrEqual(8);
    expect(placed.top + menu.height).toBeLessThanOrEqual(viewport.height - 8);
    expect(placed.left).toBe(100);
  });

  it("flips a right-edge trigger back into the viewport", () => {
    const trigger = { left: 330, top: 700, right: 374, bottom: 732, width: 44, height: 32 };
    const menu = { width: 176, height: 120 };
    const viewport = { width: 390, height: 844 };
    const placed = anchorPopover(trigger, menu, viewport);
    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.left + menu.width).toBeLessThanOrEqual(382);
    expect(placed.top + menu.height).toBeLessThanOrEqual(836);
    expect(placed.top).toBeLessThan(trigger.top);
  });

  it("ports the logger menu instead of anchoring it to the right edge", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/ExerciseCardMenu.tsx"),
      "utf8",
    );
    expect(source).toContain("anchorPopover");
    expect(source).toContain("createPortal");
    expect(source).toContain("data-exercise-menu-panel");
    expect(source).not.toContain("absolute right-0");
  });
});
