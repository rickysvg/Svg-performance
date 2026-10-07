/**
 * 1–2 routines from the mobility check-in the athlete already logs.
 * Not a new assessment. Empty fields are ignored.
 */
import { lengthToCm } from "@/lib/length-units";
import {
  isKickMark,
  kickGapOver10,
  sideGapOver10,
  type KickMark,
} from "@/lib/mobility";

const KICK_RANK: Record<string, number> = { belt: 1, chest: 2, shoulder: 3, head: 4 };

/** Distance to the floor still counts as a split to build. */
const SPLIT_OFF_FLOOR_CM = 15;
/** Knee-to-wall shorter than this is the ankle gap. */
const ANKLE_SHORT_CM = 8;
/** Shoulder reach gap worth a routine. 0 means the fingers already overlap. */
const SHOULDER_GAP_CM = 5;

export type CheckInSnapshot = {
  sitReachLevel: string;
  frontSplitLeft: number | null;
  frontSplitRight: number | null;
  sideSplit: number | null;
  lengthUnit: string;
  hipLeft: number | null;
  hipRight: number | null;
  ankleLeft: number | null;
  ankleRight: number | null;
  kickFrontLeft: string;
  kickFrontRight: string;
  kickSideLeft: string;
  kickSideRight: string;
  shoulderGap: number | null;
};

export type RoutineRecommendation = {
  id: string;
  reason: string;
};

function cm(value: number | null, unit: string) {
  if (value == null || !Number.isFinite(value)) return null;
  return lengthToCm(value, unit);
}

export function recommendFromCheckIn(row: CheckInSnapshot): RoutineRecommendation[] {
  const picks: RoutineRecommendation[] = [];
  const seen = new Set<string>();
  const add = (id: string, reason: string) => {
    if (seen.has(id) || picks.length >= 2) return;
    seen.add(id);
    picks.push({ id, reason });
  };

  const kicks = [row.kickFrontLeft, row.kickFrontRight, row.kickSideLeft, row.kickSideRight].filter(
    (mark): mark is KickMark => isKickMark(mark),
  );
  const lowKick = kicks.some((mark) => KICK_RANK[mark] < KICK_RANK.shoulder);
  const kickGap =
    kickGapOver10(row.kickFrontLeft, row.kickFrontRight) ||
    kickGapOver10(row.kickSideLeft, row.kickSideRight);
  if (lowKick || kickGap) {
    add(
      "kickers-hips",
      lowKick
        ? "Kick height is still short of the shoulder. Lift the leg."
        : "One kick side is behind the other.",
    );
  }

  const tightReach = row.sitReachLevel === "knees" || row.sitReachLevel === "shins";
  const frontGap = sideGapOver10(row.frontSplitLeft, row.frontSplitRight);
  const splitOff = [row.frontSplitLeft, row.frontSplitRight, row.sideSplit].some((value) => {
    const distance = cm(value, row.lengthUnit);
    return distance != null && distance >= SPLIT_OFF_FLOOR_CM;
  });
  if (tightReach || frontGap || splitOff) {
    add(
      "split-builder",
      tightReach
        ? "Sit-and-reach is still at the knees or shins."
        : frontGap
          ? "Front split has a left/right gap."
          : "The split is still off the floor.",
    );
  }

  const hipLow = (row.hipLeft != null && row.hipLeft <= 0) || (row.hipRight != null && row.hipRight <= 0);
  const hipGap = sideGapOver10(row.hipLeft, row.hipRight);
  if (hipLow || hipGap) {
    add(
      "kickers-hips",
      hipGap ? "90/90 has a left/right gap." : "90/90 still needs a hand.",
    );
  }

  const ankleGap = sideGapOver10(row.ankleLeft, row.ankleRight);
  const ankleShort = [row.ankleLeft, row.ankleRight].some((value) => {
    const distance = cm(value, row.lengthUnit);
    return distance != null && distance < ANKLE_SHORT_CM;
  });
  if (ankleShort || ankleGap) {
    add(
      "ankle-knee",
      ankleGap ? "Knee-to-wall has a left/right gap." : "Knee-to-wall is still short.",
    );
  }

  const shoulder = cm(row.shoulderGap, row.lengthUnit);
  if (shoulder != null && shoulder >= SHOULDER_GAP_CM) {
    add("upper-back", "Shoulder reach still has a gap.");
  }

  return picks;
}
