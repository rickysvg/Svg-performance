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
    expect(source).toContain("data-workout-title");
    expect(source).toContain("textarea");
    expect(source).toContain("break-words");
    expect(source).toContain("whitespace-normal");
    expect(source).toContain("min-h-[3.4rem]");
    expect(source).toContain("<DemoBadge />");
  });

  it("shows 15s/15s interval chrome and Set rows for assault bike", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"),
      "utf8",
    );
    const timer = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/BikeSetTimer.tsx"),
      "utf8",
    );
    expect(source).toContain("isBikeIntervalName");
    expect(source).toContain("Rest between sets");
    expect(source).toContain("bikeIntervalCompletionEffects");
    expect(timer).toContain("data-bike-intervals");
    expect(timer).toContain("text-[#CBF805]");
    expect(timer).toContain("Start set");
    expect(timer).toContain("data-bike-pause");
    expect(timer).toContain("data-bike-stop");
  });
});
