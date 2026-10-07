import { describe, expect, it } from "vitest";
import { BAG_THEMES, SHADOW_COOL_NAME, SHADOW_EMPTY_NAME } from "@/lib/bag-themes";
import { lookupFormVideo, skipsFormVideo } from "@/lib/form-videos";
import { recommendFromCheckIn, type CheckInSnapshot } from "@/lib/mobility-checkin";
import { MOTION_MAX_SECONDS, MOTION_MIN_SECONDS, motionClips, poseAt } from "@/lib/mobility-motion";
import { figureForBlock } from "@/lib/mobility-poses";
import { mobilityBookendsForSession } from "@/lib/mobility-train";
import { advanceCueKind, mobilityVoiceLine } from "@/lib/mobility-voice";

const blank: CheckInSnapshot = {
  sitReachLevel: "",
  frontSplitLeft: null,
  frontSplitRight: null,
  sideSplit: null,
  lengthUnit: "in",
  hipLeft: null,
  hipRight: null,
  ankleLeft: null,
  ankleRight: null,
  kickFrontLeft: "",
  kickFrontRight: "",
  kickSideLeft: "",
  kickSideRight: "",
  shoulderGap: null,
};

describe("mobility voice cues", () => {
  it("keeps the four prompts short", () => {
    const lines = [
      mobilityVoiceLine("start", { name: "Hip circles" }),
      mobilityVoiceLine("switch"),
      mobilityVoiceLine("ten"),
      mobilityVoiceLine("next", { name: "Front leg raise" }),
    ];
    expect(lines).toEqual([
      "Start. Hip circles.",
      "Switch sides.",
      "About ten seconds.",
      "Next. Front leg raise.",
    ]);
    for (const line of lines) expect(line.length).toBeLessThan(40);
  });

  it("says switch sides only when the same stretch changes side", () => {
    expect(
      advanceCueKind(
        { blockKey: "hip-cars", side: "left" },
        { blockKey: "hip-cars", side: "right" },
      ),
    ).toBe("switch");
    expect(
      advanceCueKind(
        { blockKey: "hip-cars", side: "right" },
        { blockKey: "front-raise", side: "left" },
      ),
    ).toBe("next");
  });
});

describe("short mobility motion", () => {
  it("loops only the path stretches, for a few seconds", () => {
    const clips = motionClips();
    expect(clips.length).toBeGreaterThan(0);
    expect(clips.length).toBeLessThanOrEqual(8);
    const holds = ["wall-hang", "half-split", "couch", "pigeon", "butterfly", "child", "breath", "hang", "neck-flex"];
    for (const clip of clips) {
      expect(clip.seconds).toBeGreaterThanOrEqual(MOTION_MIN_SECONDS);
      expect(clip.seconds).toBeLessThanOrEqual(MOTION_MAX_SECONDS);
      expect(figureForBlock(clip.blockKey)?.caption).toMatch(/\s/);
      expect(holds).not.toContain(clip.blockKey);
      expect(skipsFormVideo(clip.blockKey)).toBe(false);
      const still = figureForBlock(clip.blockKey)!;
      const joints = ["kneeR", "footR", "hip", "elbowR", "handR"] as const;
      const shifted = (progress: number) => {
        const pose = poseAt(clip, still, progress);
        return joints.some(
          (joint) => pose[joint][0] !== still[joint][0] || pose[joint][1] !== still[joint][1],
        );
      };
      expect(shifted(0)).toBe(false);
      expect(shifted(0.45)).toBe(true);
    }
    expect(clips.map((clip) => clip.blockKey)).toContain("hip-cars");
    expect(clips.map((clip) => clip.blockKey)).not.toContain("half-split");
  });

  it("leaves shadowboxing without a form video", () => {
    expect(lookupFormVideo(SHADOW_EMPTY_NAME).omit).toBe(true);
    expect(lookupFormVideo(SHADOW_COOL_NAME).omit).toBe(true);
    expect(lookupFormVideo(SHADOW_EMPTY_NAME).url).toBe("");
  });
});

describe("activate and recover for a train day", () => {
  it("sends a kick-heavy bag day to kicker hips, then the split builder", () => {
    const theme = BAG_THEMES.A.Tuesday;
    const bookend = mobilityBookendsForSession({
      kind: "skill",
      title: theme.label,
      subtitle: theme.theme,
      label: theme.label,
    });
    expect(bookend?.activate.id).toBe("kickers-hips");
    expect(bookend?.recover.id).toBe("split-builder");
  });

  it("matches the other bag, lift, bike, and GPP days without touching rest", () => {
    expect(
      mobilityBookendsForSession({
        kind: "skill",
        title: BAG_THEMES.B.Tuesday.label,
        subtitle: BAG_THEMES.B.Tuesday.theme,
        label: BAG_THEMES.B.Tuesday.label,
      })?.activate.id,
    ).toBe("kickers-hips");
    expect(
      mobilityBookendsForSession({
        kind: "skill",
        title: BAG_THEMES.A.Thursday.label,
        subtitle: BAG_THEMES.A.Thursday.theme,
        label: BAG_THEMES.A.Thursday.label,
      })?.recover.id,
    ).toBe("grapplers-neck-hips");
    expect(
      mobilityBookendsForSession({
        kind: "skill",
        title: BAG_THEMES.A.Monday.label,
        subtitle: BAG_THEMES.A.Monday.theme,
        label: BAG_THEMES.A.Monday.label,
      })?.activate.id,
    ).toBe("upper-back");
    expect(
      mobilityBookendsForSession({
        kind: "strength",
        title: "Day 1 — Lower body strength",
        subtitle: "Squat and hinge",
        label: "Strength — lower (squat / hinge)",
      })?.recover.id,
    ).toBe("split-builder");
    expect(
      mobilityBookendsForSession({
        kind: "conditioning",
        title: "Day 4 — Assault bike",
        subtitle: "Assault bike intervals",
        label: "Assault Bike",
      })?.activate.id,
    ).toBe("daily-warmup");
    expect(
      mobilityBookendsForSession({
        kind: "conditioning",
        title: "Day 10 — Friday GPP",
        subtitle: "Sled, carry, swing",
        label: "Conditioning — full-body GPP",
      }),
    ).toMatchObject({
      activate: { id: "daily-warmup" },
      recover: { id: "cooldown" },
    });
    expect(
      mobilityBookendsForSession({
        kind: "rest",
        title: "Rest day",
        subtitle: "Off",
        label: "Rest / skip",
      }),
    ).toBeNull();
  });
});

describe("check-in routine recommendations", () => {
  it("picks one or two routines that close the logged gap", () => {
    expect(recommendFromCheckIn(blank)).toEqual([]);
    expect(
      recommendFromCheckIn({
        ...blank,
        kickFrontLeft: "belt",
        kickFrontRight: "belt",
        kickSideLeft: "chest",
        kickSideRight: "chest",
      }).map((pick) => pick.id),
    ).toEqual(["kickers-hips"]);
    expect(
      recommendFromCheckIn({
        ...blank,
        sitReachLevel: "knees",
        kickFrontLeft: "belt",
        kickFrontRight: "head",
        ankleLeft: 2,
        ankleRight: 2,
        shoulderGap: 4,
      }).map((pick) => pick.id),
    ).toEqual(["kickers-hips", "split-builder"]);
    expect(
      recommendFromCheckIn({
        ...blank,
        frontSplitLeft: 8,
        frontSplitRight: 8,
        lengthUnit: "in",
      }).map((pick) => pick.id),
    ).toEqual(["split-builder"]);
    expect(
      recommendFromCheckIn({
        ...blank,
        sitReachLevel: "past",
        frontSplitLeft: 1,
        frontSplitRight: 1,
        sideSplit: 1,
        hipLeft: 2,
        hipRight: 2,
        ankleLeft: 5,
        ankleRight: 5,
        kickFrontLeft: "head",
        kickFrontRight: "head",
        kickSideLeft: "shoulder",
        kickSideRight: "shoulder",
        shoulderGap: 0,
      }),
    ).toEqual([]);
  });
});
