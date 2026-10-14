/**
 * Floor sessions for members who cannot use a gym or weights.
 * Same weekday jobs and 3-week blocks as the gym plan. Every move is
 * something they can do in open space. Not a gym list with the load blanked out.
 */

import type { ScaleBand } from "@/lib/training-scale";
import type { ScaleableExercise } from "@/lib/training-scale";
import { DEMO_PROGRAM_SLUG } from "@/lib/programs";
import { DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import {
  STRENGTH_DAY_BY_BLOCK,
  mesoBlockLabel,
  type MesoBlock,
} from "@/lib/mesocycle";
import { effortLoadText } from "@/lib/rir";

export type FloorRole = "lower" | "pull" | "push" | "posterior" | "gpp" | "bike";

export type FloorSession = {
  role: FloorRole;
  title: string;
  focus: string;
  exercises: ScaleableExercise[];
};

type Move = {
  name: string;
  sets: number;
  reps: string;
  rir?: string;
  cue: string;
  restSeconds: number;
  logMode?: "reps_only" | "timed";
  notes: string;
};

function setsFor(band: ScaleBand, base: number) {
  if (band === "beginner") return Math.max(2, base - 1);
  if (band === "advanced") return base >= 5 ? base : base + 1;
  return base;
}

function move(band: ScaleBand, input: Move): ScaleableExercise {
  const timed = input.logMode === "timed" || /\bsec\b/i.test(input.reps);
  return {
    name: input.name,
    sets: setsFor(band, input.sets),
    reps: input.reps,
    loadText: input.rir ? effortLoadText(input.rir, input.cue) : input.cue,
    restSeconds: input.restSeconds,
    logMode: timed ? "timed" : "reps_only",
    notes: input.notes,
  };
}

function blockForDay(dayNumber: number): MesoBlock | null {
  for (const block of ["A", "B", "C"] as const) {
    const days = STRENGTH_DAY_BY_BLOCK[block];
    if (Object.values(days).includes(dayNumber)) return block;
  }
  return null;
}

export function floorRoleForDay(dayNumber: number, programSlug?: string): FloorRole | null {
  if (programSlug === DEMO_SKILL_PROGRAM_SLUG || programSlug === "skill") return null;
  if (programSlug && programSlug !== DEMO_PROGRAM_SLUG && programSlug !== "strength") return null;
  const block = blockForDay(dayNumber);
  if (block) {
    const days = STRENGTH_DAY_BY_BLOCK[block];
    if (days.monday === dayNumber) return "lower";
    if (days.tuesday === dayNumber) return "pull";
    if (days.wednesday === dayNumber) return "push";
    if (days.thursday === dayNumber) return "posterior";
    if (days.friday === dayNumber) return "gpp";
  }
  if (dayNumber >= 4 && dayNumber <= 9) return "bike";
  return null;
}

function focusFor(block: MesoBlock, job: string) {
  return `No gym or weights · ${mesoBlockLabel(block)} · ${job}`;
}

function lower(block: MesoBlock, band: ScaleBand): ScaleableExercise[] {
  const easy = "Hand on a wall if you tip. Knee tracks over the toes.";
  if (block === "B") {
    return [
      move(band, {
        name: "Squat jump",
        sets: 4,
        reps: band === "beginner" ? "4" : "5",
        rir: "3-5",
        cue: "Quiet landing. Leave a jump in the tank.",
        restSeconds: 45,
        notes: "Explosive primer before the pause squat.",
      }),
      move(band, {
        name: "Pause air squat",
        sets: 4,
        reps: band === "advanced" ? "6" : "8",
        rir: "2-4",
        cue: "Three-second pause in the bottom.",
        restSeconds: 75,
        notes: "Main squat. Stand only when the pause is quiet. Heels stay down.",
      }),
      move(band, {
        name: "Walking lunge",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Long step. No bounce.",
        restSeconds: 60,
        notes: easy,
      }),
      move(band, {
        name: "Split squat",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Back knee soft. Torso tall.",
        restSeconds: 60,
        notes: "Both feet on the floor. This is the single-leg strength, not a bench Bulgarian.",
      }),
      move(band, {
        name: "Single-leg glute bridge",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Hips level. Pause at the top.",
        restSeconds: 45,
        notes: "Shoulders on the floor. The free leg stays long.",
      }),
      move(band, {
        name: "Broad jump",
        sets: 3,
        reps: band === "beginner" ? "3" : "4",
        rir: "3-5",
        cue: "Stick the landing.",
        restSeconds: 45,
        notes: "Reset the stance before the next jump.",
      }),
      move(band, {
        name: "Front plank",
        sets: 3,
        reps: band === "advanced" ? "40 sec" : "30 sec",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Ribs down. Log the hold.",
      }),
    ];
  }
  if (block === "C") {
    return [
      move(band, {
        name: "Squat jump",
        sets: 3,
        reps: "4",
        rir: "3-5",
        cue: "Short primer. Save the legs for the lunge.",
        restSeconds: 45,
        notes: "Quiet feet.",
      }),
      move(band, {
        name: "Walking lunge",
        sets: 4,
        reps: band === "advanced" ? "8 / leg" : "6 / leg",
        rir: "1-3",
        cue: "This is the main lift. Last reps slow and clean.",
        restSeconds: 75,
        notes: easy,
      }),
      move(band, {
        name: "Split squat",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Back knee toward the floor.",
        restSeconds: 60,
        notes: "Hold a wall if balance goes. Do not bounce.",
      }),
      move(band, {
        name: "Single-leg RDL",
        sets: 3,
        reps: band === "advanced" ? "8 / leg" : "6 / leg",
        rir: "2-4",
        cue: "Soft knee. Hips square.",
        restSeconds: 60,
        notes: "Empty hands. Reach long. A wall touch is fine.",
      }),
      move(band, {
        name: "Air squat",
        sets: 3,
        reps: "10",
        rir: "2-4",
        cue: "Two seconds down.",
        restSeconds: 60,
        notes: "Secondary squat. Full depth you can own.",
      }),
      move(band, {
        name: "Lateral lunge",
        sets: 3,
        reps: "6 / side",
        rir: "2-4",
        cue: "Sit into the hip. Trail leg stays long.",
        restSeconds: 45,
        notes: "Frontal-plane strength for stance changes.",
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "25 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Hips stacked. Log the hold.",
      }),
    ];
  }
  return [
    move(band, {
      name: "Squat jump",
      sets: 4,
      reps: "5",
      rir: "3-5",
      cue: "Crisp landing.",
      restSeconds: 45,
      notes: "Explosive primer. Stop if the knees cave.",
    }),
    move(band, {
      name: band === "advanced" ? "Pause air squat" : "Air squat",
      sets: 4,
      reps: band === "beginner" ? "8" : "10",
      rir: "2-4",
      cue: band === "advanced" ? "Two-second pause in the hole." : "Own the bottom. Heels down.",
      restSeconds: 75,
      notes: "Main squat. No bell. Sit between the hips.",
    }),
    move(band, {
      name: "Reverse lunge",
      sets: 3,
      reps: "8 / leg",
      rir: "2-4",
      cue: "Step back. Front knee tracks.",
      restSeconds: 60,
      notes: easy,
    }),
    move(band, {
      name: "Single-leg glute bridge",
      sets: 3,
      reps: "8 / side",
      rir: "2-4",
      cue: "Pause at the top. Hips level.",
      restSeconds: 45,
      notes: "Shoulders stay on the floor.",
    }),
    move(band, {
      name: "Hip hinge",
      sets: 3,
      reps: "8",
      rir: "2-4",
      cue: "Soft knees. Long spine. Hands slide down the thighs.",
      restSeconds: 45,
      notes: "The hinge pattern with empty hands. Stop if the low back rounds hard.",
    }),
    move(band, {
      name: "Lateral lunge",
      sets: 3,
      reps: "6 / side",
      rir: "2-4",
      cue: "Sit into the hip.",
      restSeconds: 45,
      notes: "Trail leg stays long.",
    }),
    move(band, {
      name: "Side plank",
      sets: 3,
      reps: "25 sec / side",
      cue: "Hold — no weight",
      restSeconds: 45,
      logMode: "timed",
      notes: "Hips stacked. Log the hold.",
    }),
  ];
}

function pull(block: MesoBlock, band: ScaleBand): ScaleableExercise[] {
  const floor =
    "Lie face down. Lift from the shoulder blade, not by shrugging the ears. No bar and no bell — this is the pull.";
  if (block === "B") {
    return [
      move(band, {
        name: "Prone Y raise",
        sets: 3,
        reps: "8",
        rir: "2-4",
        cue: "One-second pause at the top. Thumbs up.",
        restSeconds: 45,
        notes: floor,
      }),
      move(band, {
        name: "Prone T raise",
        sets: 3,
        reps: "8",
        rir: "2-4",
        cue: "Arms out to a T. Squeeze the blades.",
        restSeconds: 45,
        notes: floor,
      }),
      move(band, {
        name: "Superman hold",
        sets: 3,
        reps: band === "beginner" ? "15 sec" : "20 sec",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Arms and legs long. Ribs stay down. Log the hold.",
      }),
      move(band, {
        name: "Bird dog",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Slow reach. Hips stay square.",
        restSeconds: 45,
        notes: "Opposite arm and leg. Do not twist.",
      }),
      move(band, {
        name: "Dead bug",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Low back stays glued.",
        restSeconds: 45,
        notes: "Exhale as the arm and leg reach.",
      }),
      move(band, {
        name: "Prone W raise",
        sets: 3,
        reps: "10",
        rir: "2-4",
        cue: "Elbows bent. Pull the blades down and in.",
        restSeconds: 45,
        notes: floor,
      }),
      move(band, {
        name: "Hollow hold",
        sets: 3,
        reps: band === "advanced" ? "25 sec" : "20 sec",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Low back pressed down. Bend the knees if the back peels up.",
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "25 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Hips stacked.",
      }),
    ];
  }
  if (block === "C") {
    return [
      move(band, {
        name: "Prone Y raise",
        sets: 3,
        reps: "6",
        rir: "2-4",
        cue: "Stricter and slower than Block A.",
        restSeconds: 45,
        notes: floor,
      }),
      move(band, {
        name: "Prone scap squeeze",
        sets: 4,
        reps: "12",
        rir: "2-4",
        cue: "This is the main pull. Forehead on the floor. Blades meet.",
        restSeconds: 45,
        notes: "Arms stay by the hips. No shrug.",
      }),
      move(band, {
        name: "Superman",
        sets: 3,
        reps: "8",
        rir: "2-4",
        cue: "Lift, pause, lower. Do not yank.",
        restSeconds: 45,
        notes: "Arms and legs leave the floor together.",
      }),
      move(band, {
        name: "Bird dog",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Two-second reach.",
        restSeconds: 45,
        notes: "Hips square.",
      }),
      move(band, {
        name: "Dead bug",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Low back stays down.",
        restSeconds: 45,
        notes: "Slow.",
      }),
      move(band, {
        name: "Prone T raise",
        sets: 3,
        reps: "10",
        rir: "2-4",
        cue: "Arms out. Thumbs up.",
        restSeconds: 45,
        notes: floor,
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "30 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Hips stacked.",
      }),
      move(band, {
        name: "Front plank",
        sets: 3,
        reps: "30 sec",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Ribs down. Log the hold.",
      }),
    ];
  }
  return [
    move(band, {
      name: "Prone Y raise",
      sets: 3,
      reps: "8",
      rir: "2-4",
      cue: "Thumbs up. Lift the arms, not the chin.",
      restSeconds: 45,
      notes: floor,
    }),
    move(band, {
      name: "Prone T raise",
      sets: 3,
      reps: "8",
      rir: "2-4",
      cue: "Arms out to the sides. Blades meet.",
      restSeconds: 45,
      notes: floor,
    }),
    move(band, {
      name: "Superman",
      sets: 3,
      reps: "8",
      rir: "2-4",
      cue: "Long body. Pause at the top.",
      restSeconds: 45,
      notes: "Arms and legs lift together.",
    }),
    move(band, {
      name: "Bird dog",
      sets: 3,
      reps: "8 / side",
      rir: "2-4",
      cue: "Reach opposite arm and leg.",
      restSeconds: 45,
      notes: "Hips stay square.",
    }),
    move(band, {
      name: "Dead bug",
      sets: 3,
      reps: "8 / side",
      rir: "2-4",
      cue: "Low back glued to the floor.",
      restSeconds: 45,
      notes: "Exhale on the reach.",
    }),
    move(band, {
      name: "Prone scap squeeze",
      sets: 3,
      reps: "12",
      rir: "2-4",
      cue: "Palms up by the hips. Squeeze, do not shrug.",
      restSeconds: 45,
      notes: "The row pattern you can do with no bar.",
    }),
    move(band, {
      name: "Side plank",
      sets: 3,
      reps: "25 sec / side",
      cue: "Hold — no weight",
      restSeconds: 45,
      logMode: "timed",
      notes: "Hips stacked.",
    }),
    move(band, {
      name: "Front plank",
      sets: 3,
      reps: "30 sec",
      cue: "Hold — no weight",
      restSeconds: 45,
      logMode: "timed",
      notes: "Ribs down.",
    }),
  ];
}

function push(block: MesoBlock, band: ScaleBand): ScaleableExercise[] {
  const hands =
    "Hands on a stair, a couch, or a sturdy chair. Higher hands make it easier.";
  const feet =
    "Feet on a couch or a stair. If you have neither, keep the feet on the floor and slow the lowering.";
  const pike = "Hips high. Bend the knees if your head cannot reach the floor.";
  const explosive =
    band === "beginner"
      ? {
          name: "Incline push-up",
          reps: "6",
          notes: `Explosive primer, made easier. ${hands}`,
          cue: "Fast hands, soft landing on the raised surface.",
        }
      : {
          name: "Plyo push-up",
          reps: band === "advanced" ? "4" : "5",
          notes: "Hands leave the floor. Land soft. Elevate the hands if a full plyo falls apart.",
          cue: "Speed. Stop when the landing gets loud.",
        };
  if (block === "B") {
    return [
      move(band, {
        name: explosive.name,
        sets: 3,
        reps: explosive.reps,
        rir: "3-5",
        cue: explosive.cue,
        restSeconds: 45,
        notes: "Fewer reps than Block A. Same intent.",
      }),
      move(band, {
        name: "Pause push-up",
        sets: 4,
        reps: band === "beginner" ? "5–8" : "6–8",
        rir: "1-3",
        cue: "Two-second pause on the floor.",
        restSeconds: 75,
        notes:
          band === "beginner"
            ? `Main press. ${hands} Chest meets the surface, then pause.`
            : "Main press. Chest to the floor, pause, then press. Knees only if the body line breaks.",
      }),
      move(band, {
        name: "Feet-elevated push-up",
        sets: 3,
        reps: band === "beginner" ? "6–8" : "8",
        rir: "2-4",
        cue: "Body in one line.",
        restSeconds: 60,
        notes: feet,
      }),
      move(band, {
        name: "Pike push-up",
        sets: 3,
        reps: band === "beginner" ? "4–6" : "6–8",
        rir: "2-4",
        cue: "Head toward the floor between the hands.",
        restSeconds: 60,
        notes: pike,
      }),
      move(band, {
        name: "Close-grip push-up",
        sets: 3,
        reps: "8",
        rir: "2-4",
        cue: "Hands under the chest. Elbows skim the ribs.",
        restSeconds: 60,
        notes: "The lockout work. Straight body.",
      }),
      move(band, {
        name: "Dead bug",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Resist the arch.",
        restSeconds: 45,
        notes: "Anti-extension after the presses.",
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "25 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Hips stacked.",
      }),
    ];
  }
  if (block === "C") {
    return [
      move(band, {
        name: explosive.name,
        sets: 3,
        reps: "5",
        rir: "3-5",
        cue: "Speed first.",
        restSeconds: 45,
        notes: explosive.notes,
      }),
      move(band, {
        name: "Pause push-up",
        sets: 4,
        reps: band === "beginner" ? "6–8" : "6",
        rir: "1-3",
        cue: "One-second pause on the chest.",
        restSeconds: 75,
        notes: "Block C is a pause, not a heavier grind. Straight body.",
      }),
      move(band, {
        name: "Pike push-up",
        sets: 3,
        reps: band === "advanced" ? "8" : "6",
        rir: "2-4",
        cue: "Stricter range than Block A.",
        restSeconds: 60,
        notes: pike,
      }),
      move(band, {
        name: "Push-up to side plank",
        sets: 3,
        reps: "6 / side",
        rir: "2-4",
        cue: "Press, then rotate to a tall side plank.",
        restSeconds: 60,
        notes: "The rotational piece. Hips stay high when you turn.",
      }),
      move(band, {
        name: "Close-grip push-up",
        sets: 3,
        reps: "8",
        rir: "2-4",
        cue: "Elbows in.",
        restSeconds: 60,
        notes: "Lockout strength.",
      }),
      move(band, {
        name: "Dead bug",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Low back stays down.",
        restSeconds: 45,
        notes: "Slow reach.",
      }),
      move(band, {
        name: "Front plank",
        sets: 3,
        reps: "35 sec",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Ribs down. Log the hold.",
      }),
    ];
  }
  return [
    move(band, {
      name: explosive.name,
      sets: 4,
      reps: explosive.reps,
      rir: "3-5",
      cue: explosive.cue,
      restSeconds: 45,
      notes: explosive.notes,
    }),
    move(band, {
      name: "Push-up",
      sets: 4,
      reps: band === "beginner" ? "6–10" : "8–12",
      rir: "1-3",
      cue: "Straight body. Last reps slow and clean.",
      restSeconds: 75,
      notes:
        band === "beginner"
          ? `Main press. ${hands} Move to the floor when the raised version is easy.`
          : "Main press. Chest to the floor. Knees only if the last reps collapse.",
    }),
    move(band, {
      name: "Pike push-up",
      sets: 3,
      reps: band === "beginner" ? "4–6" : "6–8",
      rir: "2-4",
      cue: "Overhead strength. Hips stay high.",
      restSeconds: 60,
      notes: pike,
    }),
    move(band, {
      name: "Close-grip push-up",
      sets: 3,
      reps: "8–10",
      rir: "2-4",
      cue: "Hands under the chest.",
      restSeconds: 60,
      notes: "Elbows track the ribs.",
    }),
    move(band, {
      name: "Side plank with reach",
      sets: 3,
      reps: "6 / side",
      rir: "2-4",
      cue: "Reach under the body, then open the chest.",
      restSeconds: 45,
      notes: "Rotational strength. Hips stay up.",
    }),
    move(band, {
      name: "Dead bug",
      sets: 3,
      reps: "8 / side",
      rir: "2-4",
      cue: "Resist the twist and the arch.",
      restSeconds: 45,
      notes: "Low back stays down.",
    }),
    move(band, {
      name: "Front plank",
      sets: 3,
      reps: "30 sec",
      cue: "Hold — no weight",
      restSeconds: 45,
      logMode: "timed",
      notes: "Brace to finish. Log the hold.",
    }),
  ];
}

function posterior(block: MesoBlock, band: ScaleBand): ScaleableExercise[] {
  if (block === "B") {
    return [
      move(band, {
        name: "Broad jump",
        sets: 4,
        reps: "3",
        rir: "3-5",
        cue: "Max distance you can stick.",
        restSeconds: 60,
        notes: "Reset fully between jumps.",
      }),
      move(band, {
        name: "Hip hinge",
        sets: 4,
        reps: "8",
        rir: "1-3",
        cue: "One-second pause with the hips back.",
        restSeconds: 75,
        notes: "Main hinge. Hands on the thighs. Flat back.",
      }),
      move(band, {
        name: "Single-leg glute bridge",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Pause on top.",
        restSeconds: 45,
        notes: "Hips level.",
      }),
      move(band, {
        name: "Walking lunge",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Long step.",
        restSeconds: 60,
        notes: "Knee tracks over the toes.",
      }),
      move(band, {
        name: "Glute bridge",
        sets: 3,
        reps: "12",
        rir: "2-4",
        cue: "Squeeze at the top. Ribs down.",
        restSeconds: 45,
        notes: "Both feet on the floor. Do not over-arch.",
      }),
      move(band, {
        name: "Superman",
        sets: 3,
        reps: "8",
        rir: "2-4",
        cue: "Long body.",
        restSeconds: 45,
        notes: "Posterior endurance after the hinge.",
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "25 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Hips stacked.",
      }),
    ];
  }
  if (block === "C") {
    return [
      move(band, {
        name: "Broad jump",
        sets: 3,
        reps: "4",
        rir: "3-5",
        cue: "Stick each landing.",
        restSeconds: 45,
        notes: "Shorter primer. The hinge carries the day.",
      }),
      move(band, {
        name: "Single-leg RDL",
        sets: 4,
        reps: band === "advanced" ? "8 / leg" : "6 / leg",
        rir: "2-4",
        cue: "Higher reps than Block B. Balance first.",
        restSeconds: 60,
        notes: "Empty hands. Square hips.",
      }),
      move(band, {
        name: "Glute bridge",
        sets: 3,
        reps: "12",
        rir: "2-4",
        cue: "Two-second squeeze.",
        restSeconds: 45,
        notes: "Ribs down.",
      }),
      move(band, {
        name: "Split squat",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Back knee soft.",
        restSeconds: 60,
        notes: "Both feet on the floor.",
      }),
      move(band, {
        name: "Lateral lunge",
        sets: 3,
        reps: "6 / side",
        rir: "2-4",
        cue: "Sit into the hip.",
        restSeconds: 45,
        notes: "Trail leg long.",
      }),
      move(band, {
        name: "Superman",
        sets: 3,
        reps: "10",
        rir: "2-4",
        cue: "Smooth lifts.",
        restSeconds: 45,
        notes: "Quality dies, the set ends.",
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "30 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Hips stacked.",
      }),
    ];
  }
  return [
    move(band, {
      name: "Broad jump",
      sets: 4,
      reps: "4",
      rir: "3-5",
      cue: "Stick the landing.",
      restSeconds: 45,
      notes: "Horizontal power before the hinge.",
    }),
    move(band, {
      name: "Single-leg RDL",
      sets: 4,
      reps: "6 / leg",
      rir: "1-3",
      cue: "Soft knee, long reach.",
      restSeconds: 75,
      notes: "Main hinge. Empty hands. Hips stay square.",
    }),
    move(band, {
      name: "Glute bridge",
      sets: 3,
      reps: "10",
      rir: "2-4",
      cue: "Pause at the top.",
      restSeconds: 45,
      notes: "Both feet down. Ribs down.",
    }),
    move(band, {
      name: "Reverse lunge",
      sets: 3,
      reps: "8 / leg",
      rir: "2-4",
      cue: "Step back.",
      restSeconds: 60,
      notes: "Front knee tracks.",
    }),
    move(band, {
      name: "Single-leg glute bridge",
      sets: 3,
      reps: "8 / side",
      rir: "2-4",
      cue: "Hips level.",
      restSeconds: 45,
      notes: "Free leg stays long.",
    }),
    move(band, {
      name: "Lateral lunge",
      sets: 3,
      reps: "6 / side",
      rir: "2-4",
      cue: "Sit into the hip.",
      restSeconds: 45,
      notes: "Frontal-plane strength.",
    }),
    move(band, {
      name: "Side plank",
      sets: 3,
      reps: "25 sec / side",
      cue: "Hold — no weight",
      restSeconds: 45,
      logMode: "timed",
      notes: "Hips stacked.",
    }),
  ];
}

function gpp(block: MesoBlock, band: ScaleBand): ScaleableExercise[] {
  const sharedStart: Move[] = [
    {
      name: "Squat jump",
      sets: 4,
      reps: "6",
      rir: "3-5",
      cue: "Repeatable. Quiet landing.",
      restSeconds: 45,
      notes: "Opener. Stop if the knees cave.",
    },
  ];
  if (block === "B") {
    return [
      ...sharedStart.map((row) => move(band, row)),
      move(band, {
        name: "Walking lunge",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Keep moving.",
        restSeconds: 45,
        notes: "Long step.",
      }),
      move(band, {
        name: "Push-up",
        sets: 3,
        reps: "8–12",
        rir: "2-4",
        cue: "One upper-body station in the circuit.",
        restSeconds: 45,
        notes: "Straight body. This is one piece of the GPP, with the legs and the trunk.",
      }),
      move(band, {
        name: "Burpees",
        sets: 4,
        reps: "8",
        rir: "3-5",
        cue: "Hard and repeatable.",
        restSeconds: 45,
        notes: "Stand-up burpee. Stop if the hips pike and the set turns sloppy. Count reps.",
      }),
      move(band, {
        name: "Mountain climber",
        sets: 3,
        reps: "20 / side",
        rir: "3-5",
        cue: "Hands under shoulders. Hips quiet.",
        restSeconds: 45,
        notes: "Count the reps. Stop if the low back sags.",
      }),
      move(band, {
        name: "Broad jump",
        sets: 3,
        reps: "4",
        rir: "3-5",
        cue: "Stick the landing.",
        restSeconds: 45,
        notes: "Reset between jumps.",
      }),
      move(band, {
        name: "Side plank",
        sets: 3,
        reps: "25 sec / side",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Trunk finisher.",
      }),
    ];
  }
  if (block === "C") {
    return [
      move(band, {
        name: "Squat jump",
        sets: 3,
        reps: "5",
        rir: "3-5",
        cue: "Sharp and short.",
        restSeconds: 45,
        notes: "Opener.",
      }),
      move(band, {
        name: "Split squat",
        sets: 3,
        reps: "8 / leg",
        rir: "2-4",
        cue: "Controlled down.",
        restSeconds: 45,
        notes: "Both feet on the floor.",
      }),
      move(band, {
        name: "Push-up",
        sets: 3,
        reps: "8–12",
        rir: "2-4",
        cue: "One press station.",
        restSeconds: 45,
        notes: "Straight body.",
      }),
      move(band, {
        name: "Burpees",
        sets: 4,
        reps: "8",
        rir: "3-5",
        cue: "Same quality as Block B.",
        restSeconds: 45,
        notes: "Count reps. Stop when the shape breaks.",
      }),
      move(band, {
        name: "Single-leg glute bridge",
        sets: 3,
        reps: "8 / side",
        rir: "2-4",
        cue: "Pause on top.",
        restSeconds: 45,
        notes: "Hips level.",
      }),
      move(band, {
        name: "Lateral bound",
        sets: 3,
        reps: "6 / side",
        rir: "3-5",
        cue: "Cover ground. Stick the landing.",
        restSeconds: 45,
        notes: "Athletic finisher.",
      }),
      move(band, {
        name: "Front plank",
        sets: 3,
        reps: "30 sec",
        cue: "Hold — no weight",
        restSeconds: 45,
        logMode: "timed",
        notes: "Brace to finish.",
      }),
    ];
  }
  return [
    move(band, sharedStart[0]),
    move(band, {
      name: "Reverse lunge",
      sets: 3,
      reps: "8 / leg",
      rir: "2-4",
      cue: "Step back, stand tall.",
      restSeconds: 45,
      notes: "Front knee tracks.",
    }),
    move(band, {
      name: "Push-up",
      sets: 3,
      reps: "8–12",
      rir: "2-4",
      cue: "One press station in a full-body circuit.",
      restSeconds: 45,
      notes: "Straight body. The rest of the day is legs, hops, and a brace.",
    }),
    move(band, {
      name: "Glute bridge",
      sets: 3,
      reps: "12",
      rir: "2-4",
      cue: "Squeeze, ribs down.",
      restSeconds: 45,
      notes: "Both feet on the floor.",
    }),
    move(band, {
      name: "Mountain climber",
      sets: 3,
      reps: "20 / side",
      rir: "3-5",
      cue: "Hips quiet.",
      restSeconds: 45,
      notes: "Count the reps.",
    }),
    move(band, {
      name: "Lateral bound",
      sets: 3,
      reps: "6 / side",
      rir: "3-5",
      cue: "Stick the landing.",
      restSeconds: 45,
      notes: "Athletic finisher.",
    }),
    move(band, {
      name: "Front plank",
      sets: 3,
      reps: "30 sec",
      cue: "Hold — no weight",
      restSeconds: 45,
      logMode: "timed",
      notes: "Trunk finisher. Log the hold.",
    }),
  ];
}

function bike(dayNumber: number, band: ScaleBand): { title: string; focus: string; exercises: ScaleableExercise[] } {
  const easy = "Easy enough to repeat. You should be able to talk.";
  if (dayNumber === 5) {
    return {
      title: "No gym — short power",
      focus: "No gym or weights · Short jumps with full rest. No bike.",
      exercises: [
        move(band, {
          name: "Broad jump",
          sets: 6,
          reps: "3",
          rir: "3-5",
          cue: "All-out distance, then full rest.",
          restSeconds: 60,
          notes: "Quality dies, the set ends. Stick the landing.",
        }),
        move(band, {
          name: "Squat jump",
          sets: 6,
          reps: "3",
          rir: "3-5",
          cue: "Full rest between sets.",
          restSeconds: 60,
          notes: "Quiet landing.",
        }),
        move(band, {
          name: "Burpees",
          sets: 5,
          reps: "4",
          rir: "3-5",
          cue: "Fast, then rest. Not a grind.",
          restSeconds: 60,
          notes: "Count the reps. Stand tall between sets.",
        }),
      ],
    };
  }
  if (dayNumber === 6) {
    return {
      title: "No gym — tempo repeats",
      focus: "No gym or weights · Controlled repeats. Not all-out. No bike.",
      exercises: [
        move(band, {
          name: "Air squat",
          sets: 8,
          reps: "10",
          rir: "3-5",
          cue: "Smooth. Leave reps in the tank.",
          restSeconds: 40,
          notes: easy,
        }),
        move(band, {
          name: "Reverse lunge",
          sets: 6,
          reps: "6 / leg",
          rir: "3-5",
          cue: "Even pace.",
          restSeconds: 40,
          notes: easy,
        }),
        move(band, {
          name: "Glute bridge",
          sets: 6,
          reps: "12",
          rir: "3-5",
          cue: "Smooth squeeze.",
          restSeconds: 40,
          notes: easy,
        }),
      ],
    };
  }
  if (dayNumber === 7) {
    return {
      title: "No gym — longer easy work",
      focus: "No gym or weights · Longer easy sets. No bike.",
      exercises: [
        move(band, {
          name: "Air squat",
          sets: 4,
          reps: "15",
          rir: "4-6",
          cue: "Conversational pace.",
          restSeconds: 30,
          notes: easy,
        }),
        move(band, {
          name: "Walking lunge",
          sets: 3,
          reps: "10 / leg",
          rir: "4-6",
          cue: "Easy steps.",
          restSeconds: 30,
          notes: easy,
        }),
        move(band, {
          name: "Glute bridge",
          sets: 3,
          reps: "15",
          rir: "4-6",
          cue: "Easy squeeze.",
          restSeconds: 30,
          notes: easy,
        }),
        move(band, {
          name: "Bird dog",
          sets: 3,
          reps: "8 / side",
          rir: "4-6",
          cue: "Slow.",
          restSeconds: 30,
          notes: "Hips square.",
        }),
        move(band, {
          name: "Front plank",
          sets: 3,
          reps: "30 sec",
          cue: "Hold — no weight",
          restSeconds: 30,
          logMode: "timed",
          notes: "Easy brace.",
        }),
      ],
    };
  }
  if (dayNumber === 8) {
    return {
      title: "No gym — easy aerobic",
      focus: "No gym or weights · Easy pace. Nasal breathing if you can. No bike.",
      exercises: [
        move(band, {
          name: "Air squat",
          sets: 4,
          reps: "12",
          rir: "5-6",
          cue: "Very easy.",
          restSeconds: 20,
          notes: "You could keep going. That is the point.",
        }),
        move(band, {
          name: "Glute bridge",
          sets: 3,
          reps: "12",
          rir: "5-6",
          cue: "Easy.",
          restSeconds: 20,
          notes: "Ribs down.",
        }),
        move(band, {
          name: "Dead bug",
          sets: 3,
          reps: "8 / side",
          rir: "5-6",
          cue: "Slow.",
          restSeconds: 20,
          notes: "Low back down.",
        }),
        move(band, {
          name: "Side plank",
          sets: 2,
          reps: "20 sec / side",
          cue: "Hold — no weight",
          restSeconds: 20,
          logMode: "timed",
          notes: "Easy hold.",
        }),
      ],
    };
  }
  if (dayNumber === 9) {
    return {
      title: "No gym — short finisher",
      focus: "No gym or weights · Hard, short sets. No bike and no interval timer.",
      exercises: [
        move(band, {
          name: "Burpees",
          sets: 5,
          reps: "8",
          rir: "3-5",
          cue: "Hard and repeatable.",
          restSeconds: 40,
          notes: "Count reps.",
        }),
        move(band, {
          name: "Squat jump",
          sets: 5,
          reps: "6",
          rir: "3-5",
          cue: "Quiet landing.",
          restSeconds: 40,
          notes: "Stop if the landing gets loud.",
        }),
        move(band, {
          name: "Mountain climber",
          sets: 5,
          reps: "20 / side",
          rir: "3-5",
          cue: "Hips quiet.",
          restSeconds: 40,
          notes: "Count the reps.",
        }),
        move(band, {
          name: "Lateral bound",
          sets: 4,
          reps: "4 / side",
          rir: "3-5",
          cue: "Stick it.",
          restSeconds: 40,
          notes: "Full reset.",
        }),
      ],
    };
  }
  return {
    title: "No gym — floor sprints",
    focus: "No gym or weights · Short hard sets with rest you control. No bike.",
    exercises: [
      move(band, {
        name: "Squat jump",
        sets: 8,
        reps: "5",
        rir: "3-5",
        cue: "Hard, then rest. Repeatable.",
        restSeconds: 45,
        notes: "The sprint job, on the floor.",
      }),
      move(band, {
        name: "Burpees",
        sets: 5,
        reps: "6",
        rir: "3-5",
        cue: "Stand tall between reps.",
        restSeconds: 45,
        notes: "Count reps.",
      }),
      move(band, {
        name: "Mountain climber",
        sets: 5,
        reps: "20 / side",
        rir: "3-5",
        cue: "Fast feet, quiet hips.",
        restSeconds: 45,
        notes: "Count the reps.",
      }),
      move(band, {
        name: "Lateral bound",
        sets: 4,
        reps: "4 / side",
        rir: "3-5",
        cue: "Stick the landing.",
        restSeconds: 45,
        notes: "Reset.",
      }),
    ],
  };
}

const ROLE_TITLE: Record<Exclude<FloorRole, "bike">, string> = {
  lower: "No gym — lower body",
  pull: "No gym — pull and trunk",
  push: "No gym — push",
  posterior: "No gym — posterior chain",
  gpp: "No gym — full-body conditioning",
};

const ROLE_JOB: Record<Exclude<FloorRole, "bike">, string> = {
  lower: "Squat, lunge, and a hinge you can do on the floor.",
  pull: "Shoulder-blade pulls and trunk. No bar required.",
  push: "Horizontal press, pike, lockout, then rotation and a brace.",
  posterior: "Hinge, bridge, and single-leg work.",
  gpp: "A full circuit: legs, one press, hops, and a brace.",
};

export function floorSessionForDay(
  dayNumber: number,
  programSlug: string | undefined,
  band: ScaleBand,
): FloorSession | null {
  const role = floorRoleForDay(dayNumber, programSlug);
  if (!role) return null;
  if (role === "bike") {
    const session = bike(dayNumber, band);
    return { role, ...session };
  }
  const block = blockForDay(dayNumber) ?? "A";
  const exercises =
    role === "lower"
      ? lower(block, band)
      : role === "pull"
        ? pull(block, band)
        : role === "push"
          ? push(block, band)
          : role === "posterior"
            ? posterior(block, band)
            : gpp(block, band);
  return {
    role,
    title: ROLE_TITLE[role],
    focus: focusFor(block, ROLE_JOB[role]),
    exercises,
  };
}
