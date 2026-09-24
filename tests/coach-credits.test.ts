import { describe, expect, it } from "vitest";
import { COACH_CREDIT_DISCLAIMER, creditForExercise, creditedExerciseNames } from "@/lib/coach-credits";
import { BIKE_SESSIONS } from "@/lib/bike-sessions";
import { DARU_EXERCISES } from "@/lib/daru-exercises";
import { isYoutubeFormUrl } from "@/lib/form-videos";

const ALLOWED_IDS = [
  "LhvPU8vhyq0",
  "7Jf_JutBJlo",
  "yxHlOKDwq4k",
  "la0tQgLlHV0",
  "4vLRsqNL4xc",
  "FgON_5YZ0NI",
  "FXaZo1ZObaM",
  "eNDyywpFl1k",
  "n8h-FheN2p4",
  "76vrRRCA3w8",
];

describe("coach credits", () => {
  it("credits every Daru and guest-coach item with a listed YouTube watch URL", () => {
    expect(COACH_CREDIT_DISCLAIMER).toMatch(/not an svg program/i);
    expect(creditForExercise("Assault bike intervals")).toBeNull();

    for (const session of BIKE_SESSIONS.filter((row) => row.id !== "intervals-15-15")) {
      const credit = creditForExercise(session.name);
      expect(credit, session.name).toBeTruthy();
      expect(credit?.svgScaling).toBe(true);
      expect(isYoutubeFormUrl(credit!.url)).toBe(true);
      expect(credit!.url).not.toMatch(/\/shorts\//);
      expect(ALLOWED_IDS.some((id) => credit!.url.includes(id))).toBe(true);
    }

    for (const exercise of DARU_EXERCISES) {
      const credit = creditForExercise(exercise.name);
      expect(credit, exercise.name).toBeTruthy();
      expect(credit?.line).toMatch(/Phil Daru \/ Daru Strong/);
      expect(isYoutubeFormUrl(credit!.url)).toBe(true);
      expect(ALLOWED_IDS.some((id) => credit!.url.includes(id))).toBe(true);
    }

    expect(creditedExerciseNames().length).toBeGreaterThanOrEqual(17);
  });
});
