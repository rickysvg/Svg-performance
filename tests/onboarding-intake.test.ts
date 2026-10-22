import { describe, expect, it } from "vitest";
import { earlierIntakeGap, intakeStepForProfile } from "@/lib/onboarding-intake";

describe("onboarding intake step", () => {
  it("starts a new account on step 1 even when this browser stored step 2", () => {
    expect(
      intakeStepForProfile({ athleteImagery: "", weeklyAvailability: [] }, "2"),
    ).toBe(1);
    expect(intakeStepForProfile({ athleteImagery: "male", weeklyAvailability: [] }, "2")).toBe(1);
    expect(
      intakeStepForProfile({ athleteImagery: "", weeklyAvailability: ["Monday"] }, "2"),
    ).toBe(1);
  });

  it("resumes step 2 only after imagery and days are already saved", () => {
    expect(
      intakeStepForProfile(
        { athleteImagery: "female", weeklyAvailability: ["Tuesday"] },
        "2",
      ),
    ).toBe(2);
    expect(
      intakeStepForProfile(
        { athleteImagery: "female", weeklyAvailability: ["Tuesday"] },
        null,
      ),
    ).toBe(1);
  });

  it("names the missing step 1 answers instead of leaving Save silent", () => {
    expect(
      earlierIntakeGap({ athleteImagery: "", dayCount: 0, displayName: "Alex" }),
    ).toMatch(/Step 1 is still open/);
    expect(
      earlierIntakeGap({ athleteImagery: "", dayCount: 0, displayName: "Alex" }),
    ).toMatch(/athlete imagery/);
    expect(
      earlierIntakeGap({ athleteImagery: "", dayCount: 0, displayName: "Alex" }),
    ).toMatch(/day you can train/);
    expect(
      earlierIntakeGap({ athleteImagery: "male", dayCount: 3, displayName: "Alex" }),
    ).toBeNull();
  });
});
