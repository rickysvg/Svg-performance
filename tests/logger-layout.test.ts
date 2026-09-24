import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Logger layout", () => {
  it("keeps the workout title below the sticky rest bar and spaces Same as last from Watch form", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"),
      "utf8",
    );
    expect(source.indexOf("sticky")).toBeGreaterThan(-1);
    expect(source.indexOf("sticky")).toBeLessThan(source.indexOf('name="title"'));
    expect(source).toContain("overflow-hidden");
    expect(source).toContain("flex flex-wrap items-center gap-x-3");
    expect(source).toContain("Same as last");
    expect(source).toContain("WatchFormInline");
  });
});
