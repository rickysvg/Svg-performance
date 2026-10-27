import { describe, expect, it } from "vitest";
import { EXERCISE_CATEGORIES, EXERCISE_LIBRARY } from "@/lib/exercise-library";
import { fighterExercises } from "@/lib/fighter-library";
import { DEMO_FORM_VIDEOS, FORM_VIDEO_SHORT_MAX_SECONDS, isYoutubeFormUrl, youtubeVideoId } from "@/lib/form-videos";
import { fallbackLogMode, modeColumnLabel, prescriptionIsRepCount } from "@/lib/exercise-log-mode";

describe("fighter exercise library", () => {
  it("adds hundreds of new exercises with a short form clip and a matching log column", () => {
    const rows = fighterExercises();
    expect(rows.length).toBeGreaterThanOrEqual(250);

    const libraryNames = new Set(EXERCISE_LIBRARY.map((exercise) => exercise.name.toLowerCase()));
    const counts = Object.fromEntries(EXERCISE_CATEGORIES.map((category) => [category, 0])) as Record<
      (typeof EXERCISE_CATEGORIES)[number],
      number
    >;
    const ids = new Map<string, string>();

    for (const row of rows) {
      expect(libraryNames.has(row.name.toLowerCase()), row.name).toBe(true);
      expect(row.region, row.name).toBeTruthy();
      expect(row.pattern, row.name).toBeTruthy();
      expect(row.gear, row.name).toBeTruthy();
      expect(row.restSeconds, row.name).toBeLessThanOrEqual(90);
      expect(row.restSeconds, row.name).toBeGreaterThanOrEqual(0);
      counts[row.category] += 1;

      const clip = DEMO_FORM_VIDEOS[row.name];
      expect(clip?.pending, row.name).not.toBe(true);
      expect(clip?.url, row.name).toBeTruthy();
      expect(isYoutubeFormUrl(clip?.url ?? ""), row.name).toBe(true);
      expect(clip?.seconds, row.name).toBeGreaterThan(0);
      expect(clip?.seconds, row.name).toBeLessThanOrEqual(FORM_VIDEO_SHORT_MAX_SECONDS);
      const id = youtubeVideoId(clip?.url ?? "");
      expect(id, row.name).toBeTruthy();
      expect(ids.has(id!), `${row.name} reuses ${ids.get(id!)}`).toBe(false);
      ids.set(id!, row.name);

      const mode = fallbackLogMode(row.name, row.reps);
      expect(mode, row.name).toBe(row.logMode);
      const column = modeColumnLabel(mode);
      if (prescriptionIsRepCount(row.reps)) expect(column, row.name).toBe("Reps");
      else expect(column, row.name).toBe("Sec");
    }

    for (const category of EXERCISE_CATEGORIES) {
      expect(counts[category], category).toBeGreaterThan(0);
    }
  });
});
