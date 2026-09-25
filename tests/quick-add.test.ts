import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shouldHideQuickAdd } from "@/lib/quick-add";

describe("quick-add floating button", () => {
  it("hides on Coach and active exercise screens", () => {
    expect(shouldHideQuickAdd("/coach")).toBe(true);
    expect(shouldHideQuickAdd("/coach?topic=mental")).toBe(true);
    expect(shouldHideQuickAdd("/training/cmug54xj00001jsgs1t9bjl0p")).toBe(true);
    expect(shouldHideQuickAdd("/training/log/abc123")).toBe(true);
    expect(shouldHideQuickAdd("/training")).toBe(false);
    expect(shouldHideQuickAdd("/home")).toBe(false);
    expect(shouldHideQuickAdd("/nutrition")).toBe(false);
    expect(shouldHideQuickAdd("/learn")).toBe(false);
    expect(shouldHideQuickAdd("/progress")).toBe(false);
  });

  it("leaves Sunday chips and bottom bars clear of the +", () => {
    const fab = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/QuickAddFab.tsx"),
      "utf8",
    );
    const strip = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WeekStrip.tsx"),
      "utf8",
    );
    const day = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/training/[dayId]/page.tsx"),
      "utf8",
    );
    expect(fab).toContain("bottom-[6.75rem]");
    expect(strip).toContain("pr-16");
    expect(day).toContain("data-start-bar");
    expect(day).toContain("sticky bottom-0");
    expect(day).not.toContain("pr-20");
  });
});
