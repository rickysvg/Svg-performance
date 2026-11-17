import { describe, expect, it } from "vitest";
import { plannedSetLine } from "@/lib/exercise-log-mode";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { DEMO_PROGRAM_SLUG } from "@/lib/programs";
import { planListForDeload } from "@/lib/training-cycle";
import { isOptionalPlanExercise, scaleProgramDay, type ScaleBand } from "@/lib/training-scale";

function liftDay(dayNumber: number) {
  const day = demoStrengthDays().find((row) => row.dayNumber === dayNumber);
  if (!day) throw new Error(`day ${dayNumber} missing`);
  return { ...day, exercises: day.exercises.create };
}

function scaleLift(dayNumber: number, band: ScaleBand, weightAccess: "gym" | "none" = "gym") {
  return scaleProgramDay(liftDay(dayNumber), {
    band,
    programSlug: DEMO_PROGRAM_SLUG,
    weightAccess,
  });
}

describe("owner workout content upgrades", () => {
  it("adds the advanced Lift 1 arm block, loads, optional back squat, and 4 x 3 squat jumps", () => {
    const day = scaleLift(12, "advanced");
    const byName = new Map(day.exercises.map((exercise) => [exercise.name, exercise]));
    for (const name of ["Cable curl", "Leg extension", "Cable triceps pressdown"]) {
      const row = byName.get(name);
      expect(row, name).toBeTruthy();
      expect(
        plannedSetLine({
          sets: row!.sets,
          reps: row!.reps,
          restSeconds: row!.restSeconds,
          name: row!.name,
          loadText: row!.loadText,
        }),
      ).toBe("3 sets × 10-12 @ 1-2 RIR, 60s rest between sets");
    }
    expect(byName.get("Zercher squat")?.loadText).toMatch(/Suggested working load 155 lb/);
    expect(byName.get("Zercher squat")?.notes).toMatch(/155 lb/);
    expect(byName.get("Trap-bar jump")?.loadText).toMatch(/Suggested working load 135 lb/);
    expect(byName.get("Lat pulldown")?.loadText).toMatch(/Suggested working load 115 lb/);
    expect(byName.get("Squat jump")).toMatchObject({ sets: 4, reps: "3" });
    const backSquat = byName.get("Back squat");
    expect(backSquat?.notes).toMatch(/Optional/);
    expect(isOptionalPlanExercise(backSquat ?? { notes: "" })).toBe(true);
    expect(byName.has("Zercher squat")).toBe(true);
  });

  it("keeps the back squat at every level and the suggested loads on advanced only", () => {
    for (const band of ["beginner", "intermediate", "advanced"] as const) {
      const day = scaleLift(12, band);
      expect(day.exercises.some((exercise) => exercise.name === "Back squat")).toBe(true);
    }
    const beginner = scaleLift(12, "beginner");
    const intermediate = scaleLift(12, "intermediate");
    expect(beginner.exercises.some((exercise) => exercise.name === "Cable curl")).toBe(false);
    expect(intermediate.exercises.some((exercise) => exercise.name === "Cable curl")).toBe(false);
    expect(beginner.exercises.find((exercise) => exercise.name === "Zercher squat")?.loadText ?? "").not.toMatch(
      /155 lb/,
    );
    expect(
      intermediate.exercises.find((exercise) => exercise.name === "Zercher squat")?.loadText ?? "",
    ).not.toMatch(/155 lb/);
    const noGym = scaleLift(12, "advanced", "none");
    expect(noGym.exercises.some((exercise) => exercise.name === "Cable curl")).toBe(false);
    expect(noGym.exercises.some((exercise) => /back squat/i.test(exercise.name))).toBe(true);
  });

  it("shows the full deload plan when only some sets were ticked", () => {
    const planned = [{ name: "Zercher squat" }, { name: "Back squat" }, { name: "Squat jump" }];
    const logged = [planned[0]!];
    expect(planListForDeload(planned, true, logged)).toBe(planned);
    expect([...planListForDeload(planned, true, logged)].map((row) => row.name)).toEqual([
      "Zercher squat",
      "Back squat",
      "Squat jump",
    ]);
    expect(planListForDeload(planned, false, logged)).toEqual(logged);
  });
});
