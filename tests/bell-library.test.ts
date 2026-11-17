import { describe, expect, it } from "vitest";
import { filterExerciseLibrary, libraryExercise, type LibraryExercise } from "@/lib/exercise-library";
import { lookupFormVideo } from "@/lib/form-videos";
import { prescriptionLogsTimeAndDistance, resolveLogMode } from "@/lib/exercise-log-mode";

const ADDED = [
  "Standing dumbbell shoulder press",
  "Dumbbell upright row",
  "Dumbbell split squat",
  "Dumbbell sumo squat",
  "Dumbbell calf raise",
  "Dumbbell clean",
  "Kettlebell clean and press",
  "Kettlebell around the world",
  "Kettlebell high pull",
  "Kettlebell single-arm row",
  "Kettlebell single-leg deadlift",
  "Kettlebell front rack squat",
  "Overhead kettlebell carry",
  "Kettlebell figure-8",
  "Kettlebell Russian twist",
] as const;

function found(query: string) {
  return filterExerciseLibrary({ equipment: "none", category: "mobility", query }).map((row) => row.name);
}

describe("dumbbell and kettlebell library", () => {
  it("adds the missing bell variations once, at every level, with no invented clip", () => {
    expect(ADDED).toHaveLength(15);
    for (const name of ADDED) {
      const exercise = libraryExercise(name);
      expect(exercise, name).toBeTruthy();
      expect(exercise?.memberHidden, name).toBeFalsy();
      expect(exercise?.equipment, name).toBe("gym");
      expect(exercise?.notes, name).toMatch(/Any level/);
      expect(exercise?.notes, name).toMatch(/Muscles:/);
      expect(exercise?.region, name).toBeTruthy();
      const mode = resolveLogMode(exercise as LibraryExercise);
      expect(["load_reps", "load_timed"], name).toContain(mode);
      const video = lookupFormVideo(name);
      expect(video.omit, name).toBe(true);
      expect(video.url, name).toBe("");
      expect(video.pending, name).toBe(false);
      for (const equipment of ["gym", "none", "all"] as const) {
        expect(
          filterExerciseLibrary({ equipment, category: "lower", query: name }).some((row) => row.name === name),
          `${equipment} ${name}`,
        ).toBe(true);
      }
    }
    expect(resolveLogMode(libraryExercise("Overhead kettlebell carry")!)).toBe("load_timed");
    expect(prescriptionLogsTimeAndDistance(libraryExercise("Overhead kettlebell carry")?.reps)).toBe(true);
  });

  it("finds front raises, side raises, and the rest of the bell list by the words a member types", () => {
    const expectHit = (query: string, name: string) => {
      expect(found(query), query).toContain(name);
    };
    expectHit("front raise", "Dumbbell front raise");
    expectHit("front raises", "Dumbbell front raise");
    expect(found("side raise")[0]).toBe("Dumbbell lateral raise");
    expectHit("side raises", "Dumbbell lateral raise");
    expectHit("shoulder raise", "Dumbbell lateral raise");
    expectHit("lateral raise", "Dumbbell lateral raise");
    expectHit("rear-delt fly", "Bent-over dumbbell reverse fly");
    expectHit("rear delt", "Bent-over dumbbell reverse fly");
    expectHit("arnold", "Arnold press");
    expectHit("seated shoulder press", "Seated dumbbell shoulder press");
    expectHit("standing shoulder press", "Standing dumbbell shoulder press");
    expectHit("single-arm shoulder press", "Single-arm overhead press");
    expectHit("upright row", "Dumbbell upright row");
    expectHit("shrug", "Dumbbell shrug");
    expectHit("hammer curl", "Hammer curl");
    expectHit("incline curl", "Incline dumbbell curl");
    expectHit("concentration curl", "Concentration curl");
    expectHit("overhead triceps extension", "Dumbbell overhead triceps extension");
    expectHit("skull crusher", "Dumbbell skull crusher");
    expectHit("kickback", "Dumbbell triceps kickback");
    expectHit("chest fly", "Dumbbell chest fly");
    expectHit("incline press", "Incline dumbbell press");
    expectHit("decline press", "Decline dumbbell press");
    expectHit("floor press", "Floor press");
    expectHit("dumbbell floor press", "Floor press");
    expectHit("pullover", "Dumbbell pullover");
    expectHit("single-arm row", "One-arm row");
    expectHit("renegade row", "Renegade row");
    expectHit("chest-supported row", "Chest-supported dumbbell row");
    expectHit("goblet squat", "Goblet squat");
    expectHit("kettlebell goblet squat", "Goblet squat");
    expectHit("split squat", "Dumbbell split squat");
    expectHit("bulgarian split squat", "Dumbbell Bulgarian split squat");
    expectHit("reverse lunge", "Reverse lunge");
    expectHit("walking lunge", "Walking lunge");
    expectHit("step-up", "Dumbbell step-up");
    expectHit("rdl", "Dumbbell Romanian deadlift");
    expectHit("single-leg rdl", "Single-leg RDL");
    expectHit("sumo squat", "Dumbbell sumo squat");
    expectHit("calf raise", "Dumbbell calf raise");
    expectHit("farmer carry", "Farmer carry");
    expectHit("suitcase carry", "Suitcase carry");
    expectHit("dumbbell snatch", "Dumbbell snatch");
    expectHit("dumbbell clean", "Dumbbell clean");
    expectHit("thruster", "Dumbbell thruster");
    expectHit("woodchop", "Dumbbell woodchop");
    expectHit("two-hand swing", "Kettlebell swing");
    expectHit("one-hand swing", "Single-arm kettlebell swing");
    expectHit("kettlebell swing", "Kettlebell swing");
    expectHit("kb clean", "Kettlebell clean");
    expectHit("clean and press", "Kettlebell clean and press");
    expectHit("kettlebell snatch", "Kettlebell snatch");
    expectHit("push press", "Kettlebell push press");
    expectHit("turkish get-up", "Turkish get-up");
    expectHit("halo", "Kettlebell halo");
    expectHit("around the world", "Kettlebell around the world");
    expectHit("windmill", "Kettlebell windmill");
    expectHit("high pull", "Kettlebell high pull");
    expectHit("kettlebell row", "Kettlebell single-arm row");
    expectHit("gorilla row", "Gorilla row");
    expectHit("kettlebell deadlift", "Kettlebell deadlift");
    expectHit("single-leg deadlift", "Kettlebell single-leg deadlift");
    expectHit("front rack squat", "Kettlebell front rack squat");
    expectHit("front rack carry", "Front-rack kettlebell carry");
    expectHit("overhead carry", "Overhead kettlebell carry");
    expectHit("bottoms-up press", "Bottoms-up kettlebell press");
    expectHit("figure-8", "Kettlebell figure-8");
    expectHit("figure 8", "Kettlebell figure-8");
    expectHit("russian twist", "Kettlebell Russian twist");
  });
});
