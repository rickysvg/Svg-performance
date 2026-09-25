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

  it("tucks the + into the account bar so it cannot cover cards", () => {
    const fab = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/QuickAddFab.tsx"),
      "utf8",
    );
    const frame = fs.readFileSync(
      path.join(process.cwd(), "src/components/MemberFrame.tsx"),
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
    expect(fab).toContain("data-quick-add-fab");
    expect(fab).toContain("absolute bottom-0 left-14");
    expect(fab).toContain("h-10 w-10");
    expect(frame).toContain("<QuickAddFab />");
    expect(frame).toContain('placement="bottom"');
    expect(strip).not.toContain("pr-16");
    expect(day).toContain("data-start-bar");
    expect(day).toContain("sticky bottom-0");
    expect(day).not.toContain("pr-20");
  });
});
