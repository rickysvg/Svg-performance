import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cuesOnTransition,
  cuesToPrefetch,
  decideMotivationCue,
  formCueForExercise,
  motivationScript,
  MOTIVATION_GAP_MS,
  scriptForCue,
  type MotivationView,
} from "@/lib/coach/motivation";
import { resetCoachBeeps } from "@/lib/coach/motivation-clock";
import { COACH_WORKOUT_MOTIVATION_ENABLED } from "@/lib/coach/config";

function view(partial: Partial<MotivationView> & Pick<MotivationView, "groups">): MotivationView {
  return {
    restRemaining: null,
    restActive: false,
    restKey: "",
    ...partial,
  };
}

const squat = view({
  groups: [
    {
      name: "Back squat",
      logMode: "load_reps",
      previousLoad: 185,
      sets: [
        { id: "a", completed: false, loadValue: 195, rir: "2", previousLoad: 185 },
        { id: "b", completed: false, loadValue: null, rir: "", previousLoad: 185 },
      ],
    },
    {
      name: "Bag — intelligent jab",
      logMode: "timed_round",
      previousLoad: null,
      sets: [{ id: "c", completed: false, loadValue: null, rir: "", previousLoad: null }],
    },
  ],
});

describe("workout motivation cues", () => {
  it("speaks a short line in the coach's character and intensity", () => {
    const calm = motivationScript("start", "skye", "supportive", { exerciseName: "Back squat" });
    const hard = motivationScript("start", "ricky", "tough", { exerciseName: "Back squat" });
    expect(calm).toMatch(/^Skye\./);
    expect(calm).toMatch(/heels stay down/i);
    expect(hard).toMatch(/^Ricky here\./);
    expect(hard).not.toBe(calm);
    const rest = motivationScript("rest10", "mateo", "technical");
    expect(rest).toMatch(/Last 10 seconds/);
    expect(rest).toMatch(/Get set/);
    expect(rest.split(/\s+/).length).toBeLessThan(30);
    expect(formCueForExercise("Back squat")).toMatch(/heels/i);
    expect(scriptForCue(
      {
        id: "exercise:bag",
        moment: "bag-round",
        cueKey: "bag:intelligent-jab",
        dynamic: true,
        exerciseName: "Bag — intelligent jab",
        bagTheme: "intelligent jab",
      },
      "cole",
      "hype",
    )).toMatch(/intelligent jab/i);
  });

  it("fires start, a harder set, halfway, rest, and the bag round", () => {
    const start = cuesOnTransition(null, squat);
    expect(start.map((cue) => cue.moment)).toEqual(["start"]);
    expect(start[0]?.cueKey).toBe("start");

    const afterSet = cuesOnTransition(squat, {
      ...squat,
      groups: [
        {
          ...squat.groups[0],
          sets: [
            { ...squat.groups[0].sets[0], completed: true },
            squat.groups[0].sets[1],
          ],
        },
        squat.groups[1],
      ],
    });
    expect(afterSet.some((cue) => cue.moment === "pr")).toBe(true);

    const resting = cuesOnTransition(
      { ...squat, restActive: true, restRemaining: 12, restKey: "squat:1" },
      { ...squat, restActive: true, restRemaining: 10, restKey: "squat:1" },
    );
    expect(resting.map((cue) => cue.moment)).toContain("rest10");
    expect(resting.find((cue) => cue.moment === "rest10")?.cueKey).toBe("rest10");

    const halfway = cuesOnTransition(squat, {
      ...squat,
      groups: [
        {
          ...squat.groups[0],
          sets: squat.groups[0].sets.map((set) => ({ ...set, completed: true })),
        },
        squat.groups[1],
      ],
    });
    expect(halfway.some((cue) => cue.moment === "halfway" || cue.moment === "finish")).toBe(true);
  });

  it("keeps a gap, stays silent when off, and will not talk over the last beeps", () => {
    resetCoachBeeps();
    expect(MOTIVATION_GAP_MS).toBeGreaterThanOrEqual(45_000);
    expect(MOTIVATION_GAP_MS).toBeLessThanOrEqual(60_000);
    const now = 1_000_000;
    expect(
      decideMotivationCue({
        enabled: false,
        nowMs: now,
        lastSpokenAtMs: null,
        beepUntilMs: 0,
      }).decision,
    ).toBe("skip");
    expect(
      decideMotivationCue({
        enabled: true,
        nowMs: now,
        lastSpokenAtMs: now - 10_000,
        beepUntilMs: 0,
      }).reason,
    ).toBe("gap");
    expect(
      decideMotivationCue({
        enabled: true,
        nowMs: now,
        lastSpokenAtMs: now - 50_000,
        beepUntilMs: now + 200,
        moment: "halfway",
      }).decision,
    ).toBe("queue");
    expect(
      decideMotivationCue({
        enabled: true,
        nowMs: now,
        lastSpokenAtMs: null,
        beepUntilMs: 0,
        restRemaining: 2,
        moment: "rest10",
      }).reason,
    ).toBe("late");
    expect(
      decideMotivationCue({
        enabled: true,
        nowMs: now,
        lastSpokenAtMs: null,
        beepUntilMs: 0,
        restRemaining: 10,
        moment: "rest10",
      }).decision,
    ).toBe("speak");
  });

  it("prefetches start, each exercise, the rest ending, and the finish", () => {
    const cues = cuesToPrefetch(squat);
    expect(cues.map((cue) => cue.cueKey)).toEqual([
      "start",
      "exercise:back-squat",
      "bag:intelligent-jab",
      "rest10",
      "finish",
    ]);
    expect(cues[0]?.exerciseName).toBe("Back squat");
    expect(cues.find((cue) => cue.moment === "bag-round")?.bagTheme).toBe("intelligent jab");
  });

  it("ships the setting and the logger toggle", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/coachMotivation\s+Boolean\s+@default\(true\)/);
    expect(schema).toContain("model CoachCueCache");
    const profile = fs.readFileSync(
      path.join(process.cwd(), "src/components/profile/CoachMotivationToggle.tsx"),
      "utf8",
    );
    expect(profile).toContain("Coach motivation during workouts");
    expect(profile).toContain("data-coach-motivation");
    const logger = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"),
      "utf8",
    );
    const cues = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutCoachCues.tsx"),
      "utf8",
    );
    expect(logger).toContain("WorkoutCoachCues");
    expect(logger).toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
    expect(cues).toContain("data-coach-motivation");
    expect(cues).toContain("data-coach-audio");
    expect(cues).toContain("unlockCoachAudio");
    expect(cues).toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
    const thread = fs.readFileSync(
      path.join(process.cwd(), "src/components/coach/CoachLiveThread.tsx"),
      "utf8",
    );
    expect(thread).toContain("data-coach-speak");
    expect(thread).toContain("data-coach-audio");
    expect(thread).not.toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
  });

  it("keeps in-workout motivation off behind one flag", () => {
    expect(COACH_WORKOUT_MOTIVATION_ENABLED).toBe(false);
    const profilePage = fs.readFileSync(
      path.join(process.cwd(), "src/app/(member)/profile/page.tsx"),
      "utf8",
    );
    expect(profilePage).toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
    expect(profilePage).toContain("CoachMotivationToggle");
    const route = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/coach/motivation/route.ts"),
      "utf8",
    );
    expect(route).toContain("if (!COACH_WORKOUT_MOTIVATION_ENABLED) return motivationOffResponse()");
    const summary = fs.readFileSync(
      path.join(process.cwd(), "src/components/home/SummaryReader.tsx"),
      "utf8",
    );
    const speaker = fs.readFileSync(
      path.join(process.cwd(), "src/components/coach/CoachSpeakButton.tsx"),
      "utf8",
    );
    const sounds = fs.readFileSync(
      path.join(process.cwd(), "src/components/profile/SoundEffectsToggle.tsx"),
      "utf8",
    );
    expect(summary).toContain("Read it to me");
    expect(summary).not.toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
    expect(speaker).toContain("data-coach-speak");
    expect(speaker).not.toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
    expect(sounds).toContain("rest-timer");
    expect(sounds).not.toContain("COACH_WORKOUT_MOTIVATION_ENABLED");
  });
});
