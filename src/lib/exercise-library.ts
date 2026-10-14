/**
 * Swap library. Every card name is one exercise.
 * Combined "A or B" program titles are canonicalized before they render.
 */
import type { LogMode } from "@/lib/exercise-log-mode";

export const EXERCISE_CATEGORIES = [
  "lower",
  "upper_push",
  "upper_pull",
  "rotational",
  "explosive",
  "core",
  "conditioning",
  "mobility",
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export type EquipmentAccess = "gym" | "none" | "both";

export type LibraryExercise = {
  name: string;
  category: ExerciseCategory;
  equipment: EquipmentAccess;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: LogMode;
  notes: string;
  /** Mobility position figure. Counts as the image when there is no clip. */
  figureKey?: string;
};

export const CATEGORY_FILTERS: Array<{ id: "all" | "upper" | ExerciseCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "lower", label: "Lower body" },
  { id: "upper", label: "Upper push / pull" },
  { id: "rotational", label: "Rotational" },
  { id: "explosive", label: "Explosive / plyo" },
  { id: "core", label: "Core" },
  { id: "conditioning", label: "Conditioning" },
  { id: "mobility", label: "Mobility" },
];

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  lower: "Lower body",
  upper_push: "Upper push",
  upper_pull: "Upper pull",
  rotational: "Rotational",
  explosive: "Explosive / plyo",
  core: "Core",
  conditioning: "Conditioning",
  mobility: "Mobility",
};

/** Old combined titles still stored on a program row, shown as one exercise. */
const CANONICAL_NAMES: Record<string, string> = {
  "Squat jump or box step-up": "Squat jump",
  "Cable or band woodchop": "Cable woodchop",
  "Cable or band Pallof press": "Cable Pallof press",
  "Chin-up, band-assist, or lat pulldown": "Chin-up",
  "Band pull-apart or face pull": "Face pull",
  "Kettlebell swing or hip hinge": "Kettlebell swing",
  "Lateral bound or side step-over": "Lateral bound",
  "Jump rope or easy bike intervals": "Jump rope",
};

export function canonicalExerciseName(name: string) {
  return CANONICAL_NAMES[name] ?? name;
}

export function categoryLabel(category: ExerciseCategory) {
  return CATEGORY_LABEL[category];
}

type Row = LibraryExercise;

function row(
  name: string,
  category: ExerciseCategory,
  equipment: EquipmentAccess,
  sets: number,
  reps: string,
  loadText: string,
  restSeconds: number,
  logMode: LogMode,
  notes: string,
  figureKey?: string,
): Row {
  return { name, category, equipment, sets, reps, loadText, restSeconds, logMode, notes, figureKey };
}

const EASY = "Easy range. Stop if a joint pinches.";

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  row("Goblet squat", "lower", "gym", 4, "6", "0-2 RIR · Own the bottom.", 120, "load_reps", "Dumbbell or kettlebell at the chest."),
  row("Pause goblet squat", "lower", "gym", 4, "5", "1-3 RIR · Pause at the bottom.", 120, "load_reps", "Two-count pause. No bounce."),
  row("Romanian deadlift", "lower", "gym", 3, "6", "1-3 RIR · Flat back, hamstrings on every rep.", 90, "load_reps", "Soft knees. This is a hinge, not a squat."),
  row("Dumbbell Romanian deadlift", "lower", "gym", 3, "8", "1-3 RIR · Bells stay close to the legs.", 90, "load_reps", "Hinge until the hamstrings load."),
  row("Reverse lunge", "lower", "gym", 3, "8 / leg", "2-4 RIR · Front knee tracks over the toes.", 75, "load_reps", "Step back. Do not bounce out of the bottom."),
  row("Walking lunge", "lower", "both", 3, "8 / leg", "2-4 RIR · Tall torso.", 75, "load_reps", "Short steps. Knee tracks over the mid-foot."),
  row("Single-leg RDL", "lower", "both", 3, "6 / leg", "1-3 RIR · Soft knee, long reach.", 75, "load_reps", "Hips stay square. A dumbbell is optional."),
  row("Dumbbell step-up", "lower", "gym", 3, "8 / leg", "2-4 RIR · Drive the top foot.", 75, "load_reps", "Whole foot on the box. No push off the back leg."),
  row("Box step-up", "lower", "both", 3, "8 / leg", "2-4 RIR · Quiet step.", 60, "reps_only", "Low box. Control the way down."),
  row("Dumbbell hip thrust", "lower", "gym", 3, "8", "1-3 RIR · Ribs down, squeeze at the top.", 75, "load_reps", "Shoulders on a bench. Chin tucked."),
  row("Dumbbell lateral lunge", "lower", "gym", 3, "8 / side", "2-4 RIR · Sit into the hip.", 60, "load_reps", "Toes stay forward. The trail leg stays long."),
  row("Trap-bar deadlift", "lower", "gym", 4, "5", "0-2 RIR · Flat back.", 120, "load_reps", "Hinge tester. Log reps and lbs."),
  row("Hip hinge", "lower", "none", 3, "8", "2-4 RIR · Push the hips back.", 60, "reps_only", "Hands on the hips. Shins stay nearly vertical."),
  row("Air squat", "lower", "none", 3, "10", "2-4 RIR · Whole foot down.", 60, "reps_only", "Sit between the hips. Knees track over the toes."),
  row("Pause air squat", "lower", "none", 3, "8", "2-4 RIR · Two-count pause.", 60, "reps_only", "Hold the bottom and stand without a bounce."),
  row("Split squat", "lower", "none", 3, "8 / leg", "2-4 RIR · Front heel stays down.", 60, "reps_only", "Short stance. Drop straight down."),
  row("Glute bridge", "lower", "none", 3, "10", "2-4 RIR · Squeeze, do not arch.", 45, "reps_only", "Heels close to the hips. Ribs stay down."),
  row("Single-leg glute bridge", "lower", "none", 3, "8 / leg", "2-4 RIR · Hips stay level.", 45, "reps_only", "One foot down. Pause at the top."),
  row("Lateral lunge", "lower", "none", 3, "8 / side", "2-4 RIR · Sit into the working hip.", 45, "reps_only", "Trail leg stays straight. Chest stays up."),

  row("Dumbbell bench press", "upper_push", "gym", 4, "8", "0-2 RIR · Last rep slow and clean.", 120, "load_reps", "Dumbbells on a bench. Do not bounce off the chest."),
  row("Overhead press", "upper_push", "gym", 3, "6", "1-3 RIR · Ribs down, lockout clean.", 90, "load_reps", "Bells or a bar. No lean-back to finish."),
  row("Single-arm overhead press", "upper_push", "gym", 3, "6 / side", "1-3 RIR · Brace, no side bend.", 75, "load_reps", "One bell. The ribs stay stacked."),
  row("Floor press", "upper_push", "gym", 4, "6", "1-3 RIR · Upper arms to the floor.", 90, "load_reps", "Limited range. Pause on the floor."),
  row("Landmine press", "upper_push", "gym", 3, "8 / side", "2-4 RIR · Elbow in, no back bend.", 75, "load_reps", "Half-kneeling if the shoulders prefer it."),
  row("Push-up", "upper_push", "none", 3, "8", "2-4 RIR · Straight body.", 60, "reps_only", "Chest to the floor, or to a stair if the floor is too hard."),
  row("Pause push-up", "upper_push", "none", 3, "6", "2-4 RIR · Pause on the floor.", 60, "reps_only", "One-count pause. No sag."),
  row("Close-grip push-up", "upper_push", "none", 3, "8", "2-4 RIR · Elbows graze the ribs.", 60, "reps_only", "Hands under the shoulders."),
  row("Feet-elevated push-up", "upper_push", "none", 3, "6", "2-4 RIR · Body in one line.", 60, "reps_only", "Feet on a couch or stair."),
  row("Incline push-up", "upper_push", "none", 3, "10", "2-4 RIR · Hands on a stair or couch.", 60, "reps_only", "Higher hands make it easier."),
  row("Pike push-up", "upper_push", "none", 3, "6", "2-4 RIR · Hips high, head between the hands.", 60, "reps_only", "Bend the elbows toward the floor."),
  row("Push-up to side plank", "upper_push", "none", 3, "6 / side", "3-5 RIR · Rotate as one piece.", 60, "reps_only", "Finish tall in the side plank."),
  row("Explosive dumbbell press", "explosive", "gym", 4, "5", "3-5 RIR · Light bells. Speed off the chest.", 75, "load_reps", "Power primer. Leave speed in the tank."),

  row("One-arm row", "upper_pull", "gym", 4, "8 / side", "0-2 RIR · Elbow to the hip.", 90, "load_reps", "Support the free hand. Last reps stay clean."),
  row("Chest-supported dumbbell row", "upper_pull", "gym", 3, "8", "1-3 RIR · Chest on the bench.", 75, "load_reps", "Pull toward the hips. No yank from the low back."),
  row("Half-kneeling one-arm row", "upper_pull", "gym", 3, "8 / side", "1-3 RIR · Tall knee, quiet ribs.", 75, "load_reps", "The down knee stays under the hip."),
  row("Chin-up", "upper_pull", "both", 4, "5", "1-3 RIR · Full hang, control the lower.", 90, "reps_only", "Chin clears the bar. Swap if you need a band or a pulldown."),
  row("Band-assisted chin-up", "upper_pull", "both", 3, "6", "2-4 RIR · Band under a knee or foot.", 75, "reps_only", "Same full hang. The band only helps the top."),
  row("Lat pulldown", "upper_pull", "gym", 3, "8", "1-3 RIR · Elbows to the ribs.", 75, "load_reps", "Slight lean. Bar to the upper chest, not the neck."),
  row("Straight-arm pulldown", "upper_pull", "gym", 3, "10", "2-4 RIR · Ribs down, arms nearly straight.", 60, "load_reps", "Lats start the pull. No lean-back."),
  row("Dumbbell pullover", "upper_pull", "gym", 3, "10", "2-4 RIR · Ribs down, soft elbows.", 60, "load_reps", "Small range. Stop before the low back arches."),
  row("Face pull", "upper_pull", "gym", 3, "15", "2-4 RIR · Shoulder blades meet.", 45, "reps_only", "Pull toward the face. Pause at the squeeze."),
  row("Band pull-apart", "upper_pull", "both", 3, "15", "2-4 RIR · Scaps back and down.", 45, "reps_only", "Light band. Do not shrug the pull."),
  row("Inverted row", "upper_pull", "none", 3, "8", "2-4 RIR · Body in one line.", 60, "reps_only", "Bar or a sturdy table edge. Chest to the bar."),

  row("Cable woodchop", "rotational", "gym", 3, "8 / side", "2-4 RIR · Hips turn, spine stays quiet.", 60, "load_reps", "Hands finish late. No yank from the low back."),
  row("Band woodchop", "rotational", "both", 3, "8 / side", "2-4 RIR · Turn the hips, not the low back.", 45, "reps_only", "Anchor the band low. Arms stay long."),
  row("Cable Pallof press", "rotational", "gym", 3, "8 / side", "2-4 RIR · Resist the twist.", 60, "load_reps", "Press straight out and pause. Do not rotate toward the stack."),
  row("Band Pallof press", "rotational", "both", 3, "8 / side", "2-4 RIR · Resist the twist.", 45, "reps_only", "Stand sideways to the band. Press and pause."),
  row("Landmine rotation", "rotational", "gym", 3, "6 / side", "3-5 RIR · Hips lead the turn.", 60, "load_reps", "Arms long. The bar travels in an arc."),
  row("Rotational med-ball throw", "rotational", "gym", 3, "6 / side", "3-5 RIR · Light ball, fast turn.", 60, "load_reps", "Throw into a wall. Reset the stance each rep."),

  row("Squat jump", "explosive", "both", 4, "5", "3-5 RIR · Crisp landings.", 45, "reps_only", "Quiet landing. Stop if the knees cave."),
  row("Lateral bound", "explosive", "both", 3, "4 / side", "3-5 RIR · Stick the landing.", 45, "reps_only", "Push the ground away. Hold the finish."),
  row("Side step-over", "explosive", "both", 3, "6 / side", "3-5 RIR · Step, do not crash.", 45, "reps_only", "Low hurdle or a line on the floor."),
  row("Broad jump", "explosive", "both", 3, "4", "3-5 RIR · Soft landing.", 45, "reps_only", "Swing the arms. Stick it before the next jump."),
  row("Plyo push-up", "explosive", "none", 3, "5", "3-5 RIR · Hands leave the floor.", 60, "reps_only", "Drop to the knees if the landing is loud."),
  row("Med-ball chest pass", "explosive", "gym", 3, "8", "3-5 RIR · Light ball, fast pass.", 60, "load_reps", "Pass into a wall. No pause at the chest."),
  row("Kettlebell swing", "explosive", "gym", 5, "8", "3-5 RIR · Snap the hips. Do not squat the bell.", 60, "load_reps", "Arms are a rope. The hips do the work."),
  row("Banded kettlebell swing", "explosive", "gym", 4, "10", "3-5 RIR · Band behind you, hips snap.", 60, "timed", "Posterior power. Quality dies, the set ends."),
  row("Dumbbell high pull", "explosive", "gym", 3, "6", "3-5 RIR · Elbows high, light bells.", 60, "load_reps", "Jump a little. Do not turn it into an upright row grind."),

  row("Front plank", "core", "both", 3, "30 sec", "Hold — no weight", 45, "timed", "Ribs down, glutes on. Log the hold."),
  row("Side plank", "core", "both", 3, "20 sec / side", "Hold — no weight", 45, "timed", "Hips stacked. Log the hold."),
  row("Dead bug", "core", "both", 3, "6 / side", "2-4 RIR · Low back stays down.", 45, "reps_only", "Exhale as the arm and leg reach."),
  row("Side plank with reach", "core", "none", 3, "6 / side", "3-5 RIR · Reach under, then long.", 45, "reps_only", "Hips stay up while the arm threads through."),
  row("Bird dog", "core", "none", 3, "6 / side", "2-4 RIR · Slow arm and opposite leg.", 45, "reps_only", "Hips stay level. Do not arch to get higher."),
  row("Hollow hold", "core", "none", 3, "20 sec", "Hold — no weight", 45, "timed", "Low back pressed down. Shorter hold if it peels up."),

  row("Jump rope", "conditioning", "both", 6, "30 sec", "Smooth — no lbs", 30, "timed", "Stay tall. Misses mean the rope is too fast."),
  row("Easy bike intervals", "conditioning", "gym", 6, "30 sec", "Easy pace. Nasal breathing if you can.", 30, "timed", "Spin. This is not the assault-bike menu."),
  row("Burpees", "conditioning", "none", 4, "8", "3-5 RIR · Step back if the jump is sloppy.", 45, "reps_only", "Chest to the floor, stand, small jump."),
  row("Farmer carry", "conditioning", "gym", 4, "30 sec", "2-3 RIR · Heavy — walk tall.", 60, "load_timed", "Heavy bells. Do not lean."),
  row("Suitcase carry", "conditioning", "gym", 3, "30 sec / side", "2-3 RIR · One bell, no side bend.", 45, "load_timed", "The free arm stays quiet."),
  row("Sled push", "conditioning", "gym", 4, "20 sec", "3-5 RIR · Forward lean, long steps.", 60, "timed", "Hips down. Push the ground away."),

  row("Hip circles", "mobility", "none", 1, "3 / side", EASY, 15, "reps_only", "Stand on one leg and draw a slow circle with the knee.", "hip-cars"),
  row("Front leg raise", "mobility", "none", 2, "12 / side", EASY, 15, "reps_only", "Straight knee. Only as high as you can still control.", "front-raise"),
  row("Side leg raise", "mobility", "none", 2, "12 / side", EASY, 15, "reps_only", "Lift out to the side without leaning away.", "side-raise"),
  row("Back leg raise", "mobility", "none", 2, "12 / side", EASY, 15, "reps_only", "Hinge slightly and lift the leg long behind you.", "back-raise"),
  row("Standing knee to chest", "mobility", "none", 2, "8 / side", EASY, 15, "reps_only", "Pull one knee in and pause.", "knee-chest"),
  row("Wall hang", "mobility", "none", 2, "30 sec", EASY, 20, "timed", "Hands on the wall, hips back, flat back.", "wall-hang"),
  row("Half split", "mobility", "none", 2, "30 sec / side", EASY, 20, "timed", "Front leg long. Fold only as far as the knee stays straight.", "half-split"),
  row("Frog rocks", "mobility", "none", 2, "8", EASY, 20, "reps_only", "Knees wide. Shift the hips a little, do not force them.", "frog-rocks"),
  row("Straddle lean", "mobility", "none", 2, "30 sec", EASY, 20, "timed", "Long spine. Lean only as far as the knees stay straight.", "straddle-lean"),
  row("Deep squat hold", "mobility", "none", 2, "30 sec", EASY, 20, "timed", "Heels down if you can. Hold a door frame if you need it.", "deep-squat"),
  row("Couch stretch", "mobility", "none", 2, "40 sec / side", EASY, 20, "timed", "Back knee under the hip. Tall chest.", "couch"),
  row("Pigeon", "mobility", "none", 2, "40 sec / side", EASY, 20, "timed", "Front shin across. Square the hips as much as you can.", "pigeon"),
  row("Butterfly", "mobility", "none", 2, "30 sec", EASY, 20, "timed", "Soles together. Tall spine, small lean.", "butterfly"),
  row("90/90 hip switches", "mobility", "none", 2, "6 / side", EASY, 20, "reps_only", "Both knees down. Switch without using the hands if you can.", "hip-switch"),
  row("Ankle circles", "mobility", "none", 1, "8 / side", EASY, 10, "reps_only", "Slow circles. The knee stays quiet.", "ankle-cars"),
  row("Shoulder circles", "mobility", "none", 1, "8", EASY, 10, "reps_only", "Big slow circles. Do not shrug the neck.", "shoulder-cars"),
  row("Hang", "mobility", "none", 2, "20 sec", EASY, 20, "timed", "Dead hang from a bar. Shoulders away from the ears.", "hang"),
  row("Child's pose with a lat reach", "mobility", "none", 2, "30 sec / side", EASY, 20, "timed", "Hips toward the heels. Reach one arm long.", "child"),
  row("Neck isometric — flexion", "mobility", "none", 1, "5 sec", "Gentle. Never a max squeeze.", 15, "timed", "Hand on the forehead. Ramp a light push. Skip after a hard spar or a neck injury.", "neck-flex"),
];

const BY_NAME = new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.name, exercise]));

export function libraryExercise(name: string) {
  return BY_NAME.get(name) ?? null;
}

export function figureKeyForExercise(name: string) {
  return BY_NAME.get(name)?.figureKey ?? null;
}

export function libraryNames() {
  return EXERCISE_LIBRARY.map((exercise) => exercise.name);
}

export type LibraryFilter = {
  query?: string;
  category?: "all" | "upper" | ExerciseCategory;
  equipment?: "gym" | "none";
  excludeName?: string;
};

export function filterExerciseLibrary(input: LibraryFilter = {}) {
  const query = (input.query ?? "").trim().toLowerCase();
  const category = input.category ?? "all";
  const equipment = input.equipment ?? "gym";
  return EXERCISE_LIBRARY.filter((exercise) => {
    if (input.excludeName && exercise.name === input.excludeName) return false;
    if (category === "upper") {
      if (exercise.category !== "upper_push" && exercise.category !== "upper_pull") return false;
    } else if (category !== "all" && exercise.category !== category) {
      return false;
    }
    if (equipment === "gym") {
      if (exercise.equipment === "none") return false;
    } else if (exercise.equipment === "gym") {
      return false;
    }
    if (!query) return true;
    return (
      exercise.name.toLowerCase().includes(query) ||
      CATEGORY_LABEL[exercise.category].toLowerCase().includes(query)
    );
  });
}

/** Library rows with no form clip. Mobility rows may still have a position image. */
export function libraryWithoutVideo(
  hasVideo: (name: string) => boolean,
): Array<{ name: string; category: ExerciseCategory; hasImage: boolean }> {
  return EXERCISE_LIBRARY.filter((exercise) => !hasVideo(exercise.name)).map((exercise) => ({
    name: exercise.name,
    category: exercise.category,
    hasImage: Boolean(exercise.figureKey),
  }));
}
