/**
 * Drill ideas taken from public Instagram posts Ricky saved.
 * Cues are SVG's words. Each card links to that creator's own post.
 * Fight footage, promo-only posts, and clips of children are not in this list.
 */

export type IgDrillGroup = "hips" | "kicks" | "power" | "accessories";

export type IgDrill = {
  id: string;
  title: string;
  group: IgDrillGroup;
  place: string;
  prescription: string;
  cues: string;
  credit: {
    handle: string;
    url: string;
    idea: string;
  };
};

export const IG_DRILL_DISCLAIMER =
  "These cues are written by SVG Performance. The link goes to the creator’s own post. SVG is not affiliated with them, and a credit is not an endorsement.";

export const IG_DRILL_GROUPS: { id: IgDrillGroup; title: string; blurb: string }[] = [
  {
    id: "hips",
    title: "Hips",
    blurb: "Seated and active hip work before you chase a higher kick.",
  },
  {
    id: "kicks",
    title: "Kicks",
    blurb: "Slow kicks to a mark you can recover from.",
  },
  {
    id: "power",
    title: "Power",
    blurb: "Short add-ons for the Mon/Wed plyo block. Landings still come first.",
  },
  {
    id: "accessories",
    title: "Accessories",
    blurb: "Optional pieces for strikers, grapplers, travel days, and Friday.",
  },
];

export const IG_DRILLS: IgDrill[] = [
  {
    id: "seated-hip-open",
    title: "Seated hip openers",
    group: "hips",
    place: "Mobility, before Kicker’s Hips",
    prescription: "2 holds × 20 s each side",
    cues: "Sit tall. Fold one leg in front and let the other knee fall open. Rock the pelvis a little, then ease the open knee farther only while the hip stays comfortable. Switch sides.",
    credit: {
      handle: "@lukamoves_",
      url: "https://www.instagram.com/p/DcOQkS0vLKv/",
      idea: "seated hip mobility for fighters",
    },
  },
  {
    id: "lunge-squat-shift",
    title: "Lunge into a deep squat",
    group: "hips",
    place: "Mobility, on a flexibility day",
    prescription: "2 sets × 5 each side",
    cues: "From a long lunge, shift into a deep squat you can still breathe in. Stand through the front foot. Keep it slow. The moving part matters more than a long passive hold.",
    credit: {
      handle: "@lukamoves_",
      url: "https://www.instagram.com/p/DcWCiHSv4Mz/",
      idea: "active flexibility from lunges and a deep squat",
    },
  },
  {
    id: "easy-hip-back",
    title: "Easy hips when the low back feels stiff",
    group: "hips",
    place: "Mobility, easy day",
    prescription: "1 round × 20 s each shape",
    cues: "Sit in a 90/90. If that is easy, hug one knee and leave the other leg long. Shrink any shape that pinches the low back. Sharp pain is a stop, not a target.",
    credit: {
      handle: "@coachgreen.pt",
      url: "https://www.instagram.com/p/DM5W40vIqEk/",
      idea: "hip mobility when the low back feels stiff",
    },
  },
  {
    id: "mark-high-kick",
    title: "High kick to a mark",
    group: "kicks",
    place: "After Kicker’s Hips",
    prescription: "2 sets × 5 each side",
    cues: "Chamber the knee, turn the standing heel toward the target, and extend only to a height you can pause at. Set the foot down under your hip. Give the left and the right the same number of reps.",
    credit: {
      handle: "@x_tarasov",
      url: "https://www.instagram.com/p/DcbslJKJeUv/",
      idea: "a practiced high kick, one side at a time",
    },
  },
  {
    id: "kick-and-recover",
    title: "Kick, then recover",
    group: "kicks",
    place: "Kicking, after the mark kicks feel steady",
    prescription: "2 sets × 4 each side",
    cues: "Throw a controlled high kick and land where you could kick again. If you stumble, lower the target. Speed waits until the landing is boring.",
    credit: {
      handle: "@x_tarasov",
      url: "https://www.instagram.com/p/DcXFfxApSXo/",
      idea: "a high kick you can recover from",
    },
  },
  {
    id: "quiet-pogos",
    title: "Quiet pogo hops",
    group: "power",
    place: "Mon/Wed plyo block, after snap-down landings",
    prescription: "2 sets × 6",
    cues: "Small hops on the balls of the feet. Land softly. Add one higher jump only when the small hops stay quiet.",
    credit: {
      handle: "@iamcoachleroy",
      url: "https://www.instagram.com/p/DbfvEZzp_Vd/",
      idea: "a small plyometric hop after an explosive jump",
    },
  },
  {
    id: "lunge-high-knee",
    title: "Lunge to a high knee",
    group: "power",
    place: "Striker add-on inside the plyo block",
    prescription: "2 sets × 4 each side",
    cues: "Step into a lunge and drive the back knee up to hip height. You can open that knee into a kick chamber. Stick the foot when it comes down.",
    credit: {
      handle: "@kisremo",
      url: "https://www.instagram.com/p/DYocIFJt-XX/",
      idea: "a lunge that finishes in a high knee",
    },
  },
  {
    id: "reactive-freeze",
    title: "Fast feet, then freeze",
    group: "power",
    place: "Striker add-on, after the plyo block",
    prescription: "4 rounds × 5 s",
    cues: "Move the feet quickly in place, then stop on one foot and hold still. If the freeze wobbles, slow the feet down.",
    credit: {
      handle: "@xypxox",
      url: "https://www.instagram.com/p/DZcyfzaIGOk/",
      idea: "reactive feet, not just heavy leg work",
    },
  },
  {
    id: "kneeling-side-hop",
    title: "Kneeling side hop",
    group: "power",
    place: "Advanced plyo, only after landings are quiet",
    prescription: "2 sets × 3 each side",
    cues: "Start on both knees. Hop to the side and land on your feet with a quiet stick. Two or three each side is enough. Skip it if the snap-down landings are still loud.",
    credit: {
      handle: "@kodyriemer",
      url: "https://www.instagram.com/p/DW2LWE1jjQ6/",
      idea: "a kneeling jump into a stuck landing",
    },
  },
  {
    id: "half-kneel-turn",
    title: "Half-kneeling turn",
    group: "accessories",
    place: "Travel day, with or without a kettlebell",
    prescription: "2 sets × 6 each side",
    cues: "Half kneel. Hold a light kettlebell at the chest, or use empty hands. Turn the ribs. Keep the hips pointed forward and come back slowly.",
    credit: {
      handle: "@maximilianmoves",
      url: "https://www.instagram.com/p/DQm7NdGDi1X/",
      idea: "a half-kneeling turn with a kettlebell",
    },
  },
  {
    id: "wall-get-up",
    title: "Get up along the wall",
    group: "accessories",
    place: "Grappler accessory",
    prescription: "3 reps each side",
    cues: "Sit with your back close to a wall. Post one hand, turn the hip in, and stand without crawling away from the wall. Switch the posting hand.",
    credit: {
      handle: "@original_gladiator_school",
      url: "https://www.instagram.com/p/DbOOOhxPtQz/",
      idea: "standing up with your back near a wall",
    },
  },
  {
    id: "pendulum-step",
    title: "Step off the line",
    group: "accessories",
    place: "Striker accessory, hands up",
    prescription: "3 rounds × 20 s",
    cues: "Shift your weight, step off the center line, and come back. Hands stay up. Shadow it alone, or have a partner tap a pad when you return.",
    credit: {
      handle: "@milakot_zasport",
      url: "https://www.instagram.com/p/DWgscL6iIkF/",
      idea: "a step off the line and back",
    },
  },
  {
    id: "hook-switch-cross",
    title: "Switch stance, then the rear hand",
    group: "accessories",
    place: "Striker pad or shadow work",
    prescription: "3 rounds × 4",
    cues: "Build a short combo that changes your feet in the middle. Finish with the rear hand from the new stance. Touch the lead glove to your forehead as you switch so you stay covered.",
    credit: {
      handle: "@italiansamurai_mma",
      url: "https://www.instagram.com/p/DdG5mV2IA_g/",
      idea: "a combo that changes stance before the last shot",
    },
  },
  {
    id: "landmine-turn",
    title: "Landmine turn",
    group: "accessories",
    place: "Mon/Wed, after the main lifts",
    prescription: "3 sets × 6 each side",
    cues: "Anchor one end of the bar. Steer the other end from hip to hip with the feet planted. The hips and abs do the turning. Do not yank the bar.",
    credit: {
      handle: "@jrich.02",
      url: "https://www.instagram.com/p/DZp4dgeTF-Q/",
      idea: "turning a landmine with the whole body",
    },
  },
  {
    id: "slow-rib-turns",
    title: "Slow rib turns",
    group: "accessories",
    place: "Before med-ball throws",
    prescription: "2 sets × 6 each side",
    cues: "Hold a light plate or kettlebell and turn the ribs over a stable hip. The first reps stay slow. Only the last two may speed up.",
    credit: {
      handle: "@athleticsbydennis",
      url: "https://www.instagram.com/p/DY7crRiI32t/",
      idea: "rotational core work before faster turns",
    },
  },
  {
    id: "floor-twists",
    title: "Floor twists",
    group: "accessories",
    place: "Easy conditioning day",
    prescription: "3 sets × 8 each side",
    cues: "Lie on your back, arms heavy on the floor, knees bent up. Twist the knees side to side only as fast as the low back stays quiet.",
    credit: {
      handle: "@quintin.torres36",
      url: "https://www.instagram.com/p/DYII7S2h-2a/",
      idea: "a supine twist for rotational speed",
    },
  },
  {
    id: "hug-and-walk",
    title: "Bear-hug carry",
    group: "accessories",
    place: "Friday GPP or the travel day",
    prescription: "3 walks × 20 s",
    cues: "Hug a sandbag, or a backpack held at the chest, and walk tall. If you have to lean back, the load is too heavy.",
    credit: {
      handle: "@fit.ferris",
      url: "https://www.instagram.com/p/DZRCVVUCm5O/",
      idea: "a bear-hug carry",
    },
  },
  {
    id: "glute-then-carry",
    title: "Glutes, then a short carry",
    group: "accessories",
    place: "Friday GPP add-on",
    prescription: "2 sets × 8 bridges, then a 20 s carry",
    cues: "Bridge the hips and squeeze at the top. Then walk a light carry. This supports the hips. It is not a complete injury plan.",
    credit: {
      handle: "@beyond_boundaries_sc",
      url: "https://www.instagram.com/p/DaIZjyMu03F/",
      idea: "glute and core work for combat athletes",
    },
  },
  {
    id: "seated-trap-raise",
    title: "Seated trap raise",
    group: "accessories",
    place: "Upper-body accessory, optional",
    prescription: "3 sets × 10",
    cues: "Sit tall on a bench. Shrug the dumbbells up and slightly back, then lower them under control. Stop if the neck starts doing the work.",
    credit: {
      handle: "@dennisyumu",
      url: "https://www.instagram.com/p/DdmWKFCJY5r/",
      idea: "a seated dumbbell raise for the traps",
    },
  },
];

export function igDrillsInGroup(group: IgDrillGroup) {
  return IG_DRILLS.filter((drill) => drill.group === group);
}

export function igDrillById(id: string) {
  return IG_DRILLS.find((drill) => drill.id === id) ?? null;
}

/** Short plyo add-on. Landings stay first in plyoBlockFor. */
export function pogoPlyoDrill() {
  const drill = igDrillById("quiet-pogos");
  if (!drill) throw new Error("quiet-pogos missing");
  return { name: drill.title, prescription: drill.prescription, cues: drill.cues };
}

export function strikerPlyoAddOn() {
  const drill = igDrillById("lunge-high-knee");
  if (!drill) throw new Error("lunge-high-knee missing");
  return { name: drill.title, prescription: drill.prescription, cues: drill.cues };
}
