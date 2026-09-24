/**
 * Coach credits for guest methods. Looked up in TS — no Prisma field.
 * Never present these as SVG’s program or as a coach endorsement.
 * YouTube URLs are only those listed in the research file.
 */

export type CoachCredit = {
  line: string;
  url: string;
  svgScaling: boolean;
};

const YT = {
  daruConjugate: "https://www.youtube.com/watch?v=yxHlOKDwq4k",
  daruBike: "https://www.youtube.com/watch?v=LhvPU8vhyq0",
  daruTrapBar: "https://www.youtube.com/watch?v=la0tQgLlHV0",
  daruLandmine: "https://www.youtube.com/watch?v=FgON_5YZ0NI",
  daruChestPass: "https://www.youtube.com/watch?v=4vLRsqNL4xc",
  daruFloorPress: "https://www.youtube.com/watch?v=FXaZo1ZObaM",
  daruKbSwing: "https://www.youtube.com/watch?v=eNDyywpFl1k",
  daruNeck: "https://www.youtube.com/watch?v=n8h-FheN2p4",
  daruSledHam: "https://www.youtube.com/watch?v=76vrRRCA3w8",
  edwardsFilm: "https://www.youtube.com/watch?v=7Jf_JutBJlo",
} as const;

const DARU = "Credit: Phil Daru / Daru Strong";
const JAMIESON = "Credit: Joel Jamieson / 8weeksout";
const EDWARDS = "Credit: Leon Edwards";

const BY_NAME: Record<string, CoachCredit> = {
  "Daru alactic power bike": { line: DARU, url: YT.daruBike, svgScaling: true },
  "Daru 75% endurance bike": { line: DARU, url: YT.daruBike, svgScaling: true },
  "Jamieson tempo bike": { line: JAMIESON, url: YT.daruBike, svgScaling: true },
  "Jamieson cardiac output bike": { line: JAMIESON, url: YT.daruBike, svgScaling: true },
  "Leon Edwards 10/20 bike finisher": { line: EDWARDS, url: YT.edwardsFilm, svgScaling: true },
  "Trap-bar deadlift": { line: DARU, url: YT.daruTrapBar, svgScaling: true },
  "Floor press": { line: DARU, url: YT.daruFloorPress, svgScaling: true },
  "Landmine press": { line: DARU, url: YT.daruLandmine, svgScaling: true },
  "Rotational med-ball throw": { line: DARU, url: YT.daruConjugate, svgScaling: true },
  "Med-ball chest pass": { line: DARU, url: YT.daruChestPass, svgScaling: true },
  "Sled push": { line: DARU, url: YT.daruConjugate, svgScaling: true },
  "Sled hamstring drag": { line: DARU, url: YT.daruSledHam, svgScaling: false },
  "Farmer's carry": { line: DARU, url: YT.daruConjugate, svgScaling: true },
  "Banded kettlebell swing": { line: DARU, url: YT.daruKbSwing, svgScaling: true },
  "Neck extension hold": { line: DARU, url: YT.daruNeck, svgScaling: true },
  "Banded DB front-rack march": { line: DARU, url: YT.daruNeck, svgScaling: false },
  "Bent-over DB shrug": { line: DARU, url: YT.daruNeck, svgScaling: false },
};

export const COACH_CREDIT_DISCLAIMER =
  "Not an SVG program. No coach endorsement.";

export function creditForExercise(name: string): CoachCredit | null {
  return BY_NAME[name] ?? null;
}

export function creditedExerciseNames() {
  return Object.keys(BY_NAME);
}
