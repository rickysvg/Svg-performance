/**
 * Fill src/data/fighter-exercises.json with oEmbed-checked form clips.
 * Resume-safe: cached search responses and already accepted rows are kept.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/data/fighter-exercises.json");
const CACHE = "/tmp/fighter-search-cache.json";

const EQUIPMENT = new Set([
  "dumbbell", "dumbbells", "barbell", "barbells", "kettlebell", "kettlebells", "cable", "cables",
  "machine", "band", "banded", "landmine", "plate", "plates", "smith", "trap", "medicine", "med",
  "ball", "balls", "ez",
]);
const GENERIC = new Set([
  "press", "raise", "curl", "curls", "squat", "squats", "row", "rows", "hold", "holds", "carry",
  "carries", "fly", "flys", "pull", "pulls", "push", "lunge", "lunges", "jump", "jumps", "slam",
  "slams", "twist", "twists", "crunch", "crunches", "plank", "hang", "hangs", "dip", "dips",
  "clean", "jerk", "swing", "swings", "extension", "extensions", "bench", "deadlift", "thrust",
  "thrusts", "bridge", "bridges",
]);
const QUALIFIERS = [
  "incline", "decline", "seated", "standing", "single", "reverse", "pause", "close", "overhead",
  "kneeling", "wide", "narrow", "neutral", "underhand", "lying", "prone", "supine", "tempo",
  "deficit", "hack", "pendulum", "cyclist", "sissy", "arnold", "spoto", "donkey", "frog",
];
const REPUTABLE = [
  "nasm", "squat university", "athlean", "nippard", "ethier", "scott herman", "scottherman",
  "puregym", "e3 rehab", "bob & brad", "physiotutors", "barbell medicine", "calgary barbell",
  "alan thrall", "onnit", "renaissance periodization", "buff dudes", "ace fitness", "nsca",
  "bodybuilding.com", "men's health", "mens health", "rogue fitness", "catalyst athletics",
  "garage strength", "eric cressey", "bret contreras", "fitnessblender", "hasfit", "livestrong",
  "mountain dog", "prehab", "barbell logic", "calisthenicmovement", "thenx", "hybrid calisthenics",
  "fitnessfaqs", "strength side", "jeff nippard", "jeremy ethier", "opex", "goodlife",
  "calisthenic", "mind pump", "starting strength", "juggernaut", "kabuki", "precision nutrition",
  "functional bodybuilding", "squatuniversity", "dr. mike", "rp strength", "howcast", "bowflex",
  "muscle and strength", "muscle & strength", "criticalbench", "exrx", "gmb fitness",
  "gold medal bodies", "the bioneer", "tony gentilcore", "john rusin", "megsquats", "meg squats",
  "untamed strength", "neversate", "brian alsruhe", "red delta", "picturefit", "testosterone nation",
];

function norm(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokens(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !EQUIPMENT.has(word) && !["the", "and", "with", "for", "from", "into", "each", "side", "arm", "leg", "bar"].includes(word));
}

function hasToken(title, token) {
  const hay = norm(title);
  const needle = norm(token);
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  if (needle.endsWith("s") && hay.includes(needle.slice(0, -1))) return true;
  if (!needle.endsWith("s") && hay.includes(`${needle}s`)) return true;
  return false;
}

function titleFits(name, title, extra = []) {
  const words = tokens(name);
  const ranked = [...words].sort((a, b) => b.length - a.length);
  if (ranked.length === 0 && extra.length === 0) return false;
  const required = [];
  if (ranked[0]) required.push(ranked[0]);
  if (ranked[0] && GENERIC.has(ranked[0]) && ranked[1]) required.push(ranked[1]);
  for (const word of extra) required.push(word);
  if (!required.every((word) => hasToken(title, word))) return false;
  const nameNorm = norm(name);
  for (const qualifier of QUALIFIERS) {
    if (norm(title).includes(qualifier) && !nameNorm.includes(qualifier)) return false;
  }
  if (/workout|routine|compilation|mistake|challenge|full body|ranked|i tried|5 ways|best exercises/i.test(title)) {
    return false;
  }
  return true;
}

function reputable(channel) {
  const text = channel.toLowerCase();
  return REPUTABLE.some((name) => text.includes(name));
}

function demoTitle(title) {
  return /how to|tutorial|demo|proper form|technique|exercise library/i.test(title);
}

function parseLength(value) {
  if (!value) return null;
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function walk(node, found) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, found);
    return;
  }
  if (node.videoRenderer) {
    const video = node.videoRenderer;
    const title = (video.title?.runs ?? []).map((run) => run.text ?? "").join("") || video.title?.simpleText || "";
    const channel = (video.longBylineText?.runs ?? []).map((run) => run.text ?? "").join("")
      || (video.ownerText?.runs ?? []).map((run) => run.text ?? "").join("");
    found.push({
      videoId: video.videoId,
      seconds: parseLength(video.lengthText?.simpleText),
      channel,
      title,
    });
    return;
  }
  for (const value of Object.values(node)) walk(value, found);
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
}

function existingNames() {
  const library = fs.readFileSync(path.join(ROOT, "src/lib/exercise-library.ts"), "utf8");
  const base = [...library.matchAll(/row\("([^"]+)"/g)].map((match) => match[1].toLowerCase());
  const combat = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/combat-exercise-library.json"), "utf8"));
  return new Set([...base, ...combat.map((row) => String(row.name).toLowerCase())]);
}

function existingVideoIds() {
  const ids = new Set();
  const files = [
    path.join(ROOT, "src/lib/form-videos.ts"),
    path.join(ROOT, "src/data/combat-exercise-library.json"),
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/g)) ids.add(match[1]);
    for (const match of text.matchAll(/"videoUrl"\s*:\s*"([^"]+)"/g)) {
      const id = match[1].match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/);
      if (id) ids.add(id[1]);
    }
  }
  return ids;
}

const cache = loadCache();
let cacheWrites = 0;

async function search(query) {
  if (cache[query]) return cache[query];
  const response = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20241001.00.00", hl: "en", gl: "US" } },
      query,
    }),
  });
  if (!response.ok) throw new Error(`search ${response.status} ${query}`);
  const data = await response.json();
  const found = [];
  walk(data, found);
  cache[query] = found.filter((row) => row.videoId && row.seconds != null);
  cacheWrites += 1;
  if (cacheWrites % 15 === 0) fs.writeFileSync(CACHE, JSON.stringify(cache));
  return cache[query];
}

async function oembed(videoId) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  const response = await fetch(endpoint, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.title) return null;
  return { title: String(data.title), channel: String(data.author_name ?? "") };
}

function row(name, category, region, pattern, gear, sets, reps, rest, logMode, notes, need = []) {
  const equipment = gear === "bodyweight" ? "none" : gear === "band" ? "both" : "gym";
  const safeEquipment = pattern === "squat" && equipment !== "gym" ? "gym" : equipment;
  return {
    name, category, equipment: safeEquipment, region, pattern, gear,
    sets, reps, loadText: logMode === "timed" || logMode === "load_timed" ? "Quality, not a grind." : "2-4 RIR · Clean reps.",
    restSeconds: Math.min(90, rest), logMode, notes, need,
  };
}

const L = "load_reps";
const R = "reps_only";
const T = "timed";
const LT = "load_timed";

const EXERCISES = [
  row("Dumbbell overhead triceps extension", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "10", 45, L, "Elbows stay pointed up. Lower behind the head."),
  row("Seated dumbbell overhead triceps extension", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "10", 45, L, "Back against the bench. Elbows quiet."),
  row("Single-arm dumbbell overhead extension", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "8 / side", 45, L, "Free hand can brace the working arm."),
  row("Cable overhead triceps extension", "upper_push", "triceps", "elbow-extension", "cable", 3, "10", 45, L, "Face away from the stack. Elbows stay high."),
  row("Rope overhead triceps extension", "upper_push", "triceps", "elbow-extension", "cable", 3, "10", 45, L, "Split the rope at the top. Do not flare the ribs."),
  row("EZ-bar overhead triceps extension", "upper_push", "triceps", "elbow-extension", "ez-bar", 3, "8", 60, L, "Close grip. Elbows point forward."),
  row("Seated EZ-bar overhead triceps extension", "upper_push", "triceps", "elbow-extension", "ez-bar", 3, "8", 60, L, "Sit tall. The bar travels behind the head."),
  row("Barbell overhead triceps extension", "upper_push", "triceps", "elbow-extension", "barbell", 3, "8", 60, L, "Narrow grip. Keep the upper arms still."),
  row("EZ-bar skull crusher", "upper_push", "triceps", "elbow-extension", "ez-bar", 3, "8", 60, L, "Lower to the forehead or just behind it. Elbows stay stacked."),
  row("Dumbbell skull crusher", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "8", 60, L, "Bells stay shoulder-width. Do not bounce off the forehead."),
  row("Cable skull crusher", "upper_push", "triceps", "elbow-extension", "cable", 3, "10", 45, L, "Cable from low. Hinge the elbows only."),
  row("Incline EZ-bar skull crusher", "upper_push", "triceps", "elbow-extension", "ez-bar", 3, "8", 60, L, "Bench at a shallow incline. Elbows stay pointed at the ceiling."),
  row("Rope triceps pushdown", "upper_push", "triceps", "elbow-extension", "cable", 3, "12", 45, L, "Split the rope at the bottom. Elbows pinned."),
  row("Straight-bar triceps pushdown", "upper_push", "triceps", "elbow-extension", "cable", 3, "12", 45, L, "Bar stays close. Full lockout without shrugging."),
  row("V-bar triceps pushdown", "upper_push", "triceps", "elbow-extension", "cable", 3, "12", 45, L, "Neutral grip. Elbows do not drift forward."),
  row("Reverse-grip triceps pushdown", "upper_push", "triceps", "elbow-extension", "cable", 3, "10", 45, L, "Palms up. Keep the wrists stacked over the forearms."),
  row("Single-arm cable pushdown", "upper_push", "triceps", "elbow-extension", "cable", 3, "10 / side", 45, L, "One handle. The shoulder stays down."),
  row("Dumbbell triceps kickback", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "12 / side", 45, L, "Upper arm parallel to the floor. Straighten without swinging."),
  row("Cable triceps kickback", "upper_push", "triceps", "elbow-extension", "cable", 3, "12 / side", 45, L, "Hinge first. Only the forearm moves."),
  row("Bench dip", "upper_push", "triceps", "elbow-extension", "bodyweight", 3, "10", 45, R, "Hands on the bench. Shoulders stay down."),
  row("Weighted bench dip", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "8", 60, L, "A plate or bell on the lap. Same elbow path as the bench dip."),
  row("Machine dip", "upper_push", "triceps", "elbow-extension", "machine", 3, "10", 60, L, "Chest tall. Do not let the shoulders roll forward."),
  row("Barbell JM press", "upper_push", "triceps", "elbow-extension", "barbell", 3, "6", 75, L, "Bar drifts toward the face as the elbows drop. A skull-crusher and a press."),
  row("Dumbbell Tate press", "upper_push", "triceps", "elbow-extension", "dumbbell", 3, "8", 60, L, "Bells start together over the chest. Elbows flare as they lower."),

  row("Incline barbell bench press", "upper_push", "chest", "horizontal-push", "barbell", 4, "6", 90, L, "Bench around 30 degrees. Bar to the upper chest."),
  row("Decline barbell bench press", "upper_push", "chest", "horizontal-push", "barbell", 3, "8", 75, L, "Feet locked. Bar to the lower chest."),
  row("Decline dumbbell press", "upper_push", "chest", "horizontal-push", "dumbbell", 3, "8", 75, L, "Bells move down and slightly out. Control the bottom."),
  row("Machine chest press", "upper_push", "chest", "horizontal-push", "machine", 3, "10", 60, L, "Shoulder blades stay on the pad. Do not lock out hard."),
  row("Incline machine press", "upper_push", "chest", "horizontal-push", "machine", 3, "10", 60, L, "Handles start near the upper chest."),
  row("Cable chest fly", "upper_push", "chest", "horizontal-push", "cable", 3, "12", 45, L, "Soft elbows. Squeeze in front of the chest."),
  row("Dumbbell chest fly", "upper_push", "chest", "horizontal-push", "dumbbell", 3, "10", 60, L, "Slight elbow bend. Stop when the chest opens."),
  row("Incline dumbbell fly", "upper_push", "chest", "horizontal-push", "dumbbell", 3, "10", 60, L, "Shallow incline. The bells arc wide, not deep."),
  row("Pec-deck machine fly", "upper_push", "chest", "horizontal-push", "machine", 3, "12", 45, L, "Forearms on the pads. Bring the elbows together."),
  row("Smith machine bench press", "upper_push", "chest", "horizontal-push", "smith", 3, "8", 75, L, "Bar path is fixed. Set the bench so it meets the lower chest."),
  row("Pause barbell bench press", "upper_push", "chest", "horizontal-push", "barbell", 4, "5", 90, L, "One-count pause on the chest. No bounce."),
  row("Wide-grip barbell bench press", "upper_push", "chest", "horizontal-push", "barbell", 3, "6", 90, L, "Grip just outside the rings. Elbows stay under the bar."),
  row("Neutral-grip dumbbell bench press", "upper_push", "chest", "horizontal-push", "dumbbell", 3, "8", 75, L, "Palms face each other. Easier on the shoulders."),
  row("Low-to-high cable fly", "upper_push", "chest", "horizontal-push", "cable", 3, "12", 45, L, "Cables start low. Finish in front of the face."),
  row("High-to-low cable fly", "upper_push", "chest", "horizontal-push", "cable", 3, "12", 45, L, "Cables start high. Finish toward the hips."),
  row("Dumbbell squeeze press", "upper_push", "chest", "horizontal-push", "dumbbell", 3, "10", 60, L, "Bells touch the whole way. Press up and slightly in."),
  row("Single-arm cable chest press", "upper_push", "chest", "horizontal-push", "cable", 3, "10 / side", 45, L, "Stagger the stance. Press straight out."),
  row("Barbell Spoto press", "upper_push", "chest", "horizontal-push", "barbell", 3, "5", 90, L, "Pause an inch off the chest. Do not rest the bar."),

  row("Dumbbell lateral raise", "upper_push", "shoulders", "shoulder-raise", "dumbbell", 3, "12", 45, L, "Lead with the elbows. Stop at shoulder height."),
  row("Cable lateral raise", "upper_push", "shoulders", "shoulder-raise", "cable", 3, "12", 45, L, "Cable from the far side. The wrist stays quiet."),
  row("Machine lateral raise", "upper_push", "shoulders", "shoulder-raise", "machine", 3, "12", 45, L, "Pads on the upper arms. Do not shrug."),
  row("Lean-away cable lateral raise", "upper_push", "shoulders", "shoulder-raise", "cable", 3, "12 / side", 45, L, "Hold the machine and lean. A longer range at the bottom."),
  row("Dumbbell front raise", "upper_push", "shoulders", "shoulder-raise", "dumbbell", 3, "10", 45, L, "Raise to eye level. Do not swing."),
  row("Plate front raise", "upper_push", "shoulders", "shoulder-raise", "plate", 3, "10", 45, L, "Hold a plate at the sides. Lift to eye level."),
  row("Cable front raise", "upper_push", "shoulders", "shoulder-raise", "cable", 3, "12", 45, L, "Rope or bar from low. Soft elbows."),
  row("Bent-over dumbbell reverse fly", "upper_push", "shoulders", "shoulder-raise", "dumbbell", 3, "12", 45, L, "Hinge. Palms face each other. Squeeze the rear delts."),
  row("Cable rear-delt fly", "upper_push", "shoulders", "shoulder-raise", "cable", 3, "12", 45, L, "Cables cross. Open the arms to the sides."),
  row("Reverse pec-deck fly", "upper_push", "shoulders", "shoulder-raise", "machine", 3, "12", 45, L, "Chest on the pad. Lead with the elbows."),
  row("Arnold press", "upper_push", "shoulders", "overhead-push", "dumbbell", 3, "8", 60, L, "Start palms in. Rotate to palms forward as you press."),
  row("Seated barbell shoulder press", "upper_push", "shoulders", "overhead-push", "barbell", 4, "6", 90, L, "Bar from the front of the shoulders. Ribs stay down."),
  row("Machine shoulder press", "upper_push", "shoulders", "overhead-push", "machine", 3, "10", 60, L, "Back on the pad. Press without shrugging the finish."),
  row("Dumbbell push press", "upper_push", "shoulders", "overhead-push", "dumbbell", 3, "6", 75, L, "A small dip, then drive the bells overhead."),
  row("Rope face pull", "upper_pull", "shoulders", "shoulder-raise", "cable", 3, "15", 45, L, "Pull the rope to the face. Thumbs end pointing back."),
  row("Band face pull", "upper_pull", "shoulders", "shoulder-raise", "band", 3, "15", 45, L, "Anchor at face height. Same finish as the cable."),
  row("Dumbbell shrug", "upper_push", "shoulders", "shrug", "dumbbell", 3, "10", 45, L, "Shoulders up and slightly back. Do not roll them."),
  row("Barbell shrug", "upper_push", "shoulders", "shrug", "barbell", 3, "8", 60, L, "Bar in the hands. Tall neck. Pause at the top."),
  row("Trap-bar shrug", "upper_push", "shoulders", "shrug", "trap-bar", 3, "8", 60, L, "Handles at the sides. Stand tall and shrug."),
  row("Cable shrug", "upper_push", "shoulders", "shrug", "cable", 3, "12", 45, L, "Cable from low. Shrug without leaning back."),
  row("Dumbbell Y-raise", "upper_push", "shoulders", "shoulder-raise", "dumbbell", 3, "10", 45, L, "Light bells. Raise into a Y with the thumbs up."),
  row("Cable upright row", "upper_push", "shoulders", "shoulder-raise", "cable", 3, "12", 45, L, "Wide grip. Elbows lead. Stop if the shoulders pinch."),

  row("Dumbbell bent-over row", "upper_pull", "back", "horizontal-pull", "dumbbell", 3, "8", 75, L, "Both bells. Flat back. Pull toward the hips."),
  row("Three-point dumbbell row", "upper_pull", "back", "horizontal-pull", "dumbbell", 3, "8 / side", 60, L, "One hand on the bench. Pull the bell to the hip."),
  row("Chest-supported machine row", "upper_pull", "back", "horizontal-pull", "machine", 3, "10", 60, L, "Chest on the pad. Pull the handles to the ribs."),
  row("Wide-grip lat pulldown", "upper_pull", "back", "vertical-pull", "cable", 3, "8", 75, L, "Pull to the upper chest. Elbows drive down."),
  row("Close-grip lat pulldown", "upper_pull", "back", "vertical-pull", "cable", 3, "8", 75, L, "Neutral or close bar. Pull to the chest."),
  row("Neutral-grip lat pulldown", "upper_pull", "back", "vertical-pull", "cable", 3, "8", 75, L, "Palms face each other. Full stretch at the top."),
  row("Reverse-grip lat pulldown", "upper_pull", "back", "vertical-pull", "cable", 3, "8", 75, L, "Palms face you. Pull the bar to the chest."),
  row("Rope straight-arm pulldown", "upper_pull", "back", "vertical-pull", "cable", 3, "12", 45, L, "Arms stay nearly straight. Pull the rope to the thighs."),
  row("Cable pullover", "upper_pull", "back", "vertical-pull", "cable", 3, "12", 45, L, "Hinge slightly. The arms sweep from overhead to the hips."),
  row("Underhand barbell row", "upper_pull", "back", "horizontal-pull", "barbell", 3, "8", 75, L, "Palms up. Pull the bar to the stomach."),
  row("Yates row", "upper_pull", "back", "horizontal-pull", "barbell", 3, "8", 75, L, "Torso closer to upright than a Pendlay. Pull to the belly."),
  row("Helms row", "upper_pull", "back", "horizontal-pull", "dumbbell", 3, "10", 60, L, "Chest on an incline bench. Row the bells toward the hips."),
  row("Wide-grip seated cable row", "upper_pull", "back", "horizontal-pull", "cable", 3, "10", 60, L, "Wide bar. Pull to the lower chest. Do not lean back."),
  row("Single-arm cable row", "upper_pull", "back", "horizontal-pull", "cable", 3, "10 / side", 45, L, "One handle. Pull the elbow past the ribs."),
  row("Plate-loaded machine row", "upper_pull", "back", "horizontal-pull", "machine", 3, "8", 75, L, "Chest supported. Pull until the elbows pass the torso."),
  row("Archer pull-up", "upper_pull", "back", "vertical-pull", "bodyweight", 3, "4 / side", 75, R, "Pull toward one hand. The other arm stays long."),
  row("Sternum pull-up", "upper_pull", "back", "vertical-pull", "bodyweight", 3, "5", 75, R, "Pull until the lower chest meets the bar. Lean back a little."),
  row("Band-assisted pull-up", "upper_pull", "back", "vertical-pull", "band", 3, "6", 60, R, "Band under a foot or knee. Full hang between reps."),
  row("Negative pull-up", "upper_pull", "back", "vertical-pull", "bodyweight", 3, "4", 75, R, "Jump to the top. Lower for three seconds."),
  row("Cable pull-apart", "upper_pull", "shoulders", "shoulder-raise", "cable", 3, "15", 45, L, "Light cable at chest height. Open the arms."),
  row("Chest-supported rear-delt row", "upper_pull", "shoulders", "shoulder-raise", "dumbbell", 3, "12", 45, L, "Elbows out. Pull wide, not to the hips."),
  row("Incline chest-supported row", "upper_pull", "back", "horizontal-pull", "dumbbell", 3, "8", 60, L, "Chest on the incline. Row both bells together."),

  row("Barbell curl", "upper_pull", "biceps", "curl", "barbell", 3, "8", 60, L, "Elbows stay under the shoulders. No swing."),
  row("Dumbbell curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "10", 45, L, "Palms up. Squeeze at the top."),
  row("EZ-bar curl", "upper_pull", "biceps", "curl", "ez-bar", 3, "8", 60, L, "Angled grip. Elbows pinned."),
  row("Incline dumbbell curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "8", 60, L, "Arms hang behind the torso. Stretch, then curl."),
  row("Preacher curl", "upper_pull", "biceps", "curl", "ez-bar", 3, "8", 60, L, "Upper arms on the pad. Do not bounce the bottom."),
  row("Cable curl", "upper_pull", "biceps", "curl", "cable", 3, "12", 45, L, "Bar or handle from low. Constant tension."),
  row("Concentration curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "10 / side", 45, L, "Elbow braced on the thigh. Curl without rocking."),
  row("Spider curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "10", 45, L, "Chest on an incline, arms hanging. Curl from a dead hang."),
  row("Bayesian cable curl", "upper_pull", "biceps", "curl", "cable", 3, "10", 45, L, "Cable behind you. The arm starts back and curls forward."),
  row("Dumbbell reverse curl", "upper_pull", "forearms", "curl", "dumbbell", 3, "10", 45, L, "Palms down. The elbows stay still."),
  row("EZ-bar reverse curl", "upper_pull", "forearms", "curl", "ez-bar", 3, "10", 45, L, "Overhand grip. Curl without swinging the bar."),
  row("Cable reverse curl", "upper_pull", "forearms", "curl", "cable", 3, "12", 45, L, "Palms down on the bar. Slow lower."),
  row("Cross-body hammer curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "10 / side", 45, L, "Curl the bell across the body toward the opposite shoulder."),
  row("Rope hammer curl", "upper_pull", "biceps", "curl", "cable", 3, "12", 45, L, "Neutral rope. Keep the thumbs up."),
  row("Zottman curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "8", 45, L, "Curl palms up. Rotate and lower palms down."),
  row("Drag curl", "upper_pull", "biceps", "curl", "barbell", 3, "8", 60, L, "Drag the bar up the torso. Elbows travel back."),
  row("Machine preacher curl", "upper_pull", "biceps", "curl", "machine", 3, "10", 45, L, "Pad supports the arms. Full lower, no bounce."),
  row("Seated alternating dumbbell curl", "upper_pull", "biceps", "curl", "dumbbell", 3, "8 / side", 45, L, "Sit tall. Alternate arms. No lean."),

  row("Dumbbell wrist curl", "upper_pull", "forearms", "wrist", "dumbbell", 3, "12", 45, L, "Forearm braced. Curl the wrist, not the elbow."),
  row("Barbell wrist curl", "upper_pull", "forearms", "wrist", "barbell", 3, "12", 45, L, "Forearms on the thighs or a bench. Palms up."),
  row("Behind-the-back wrist curl", "upper_pull", "forearms", "wrist", "barbell", 3, "12", 45, L, "Bar behind the hips. Curl the wrists up."),
  row("Reverse wrist curl", "upper_pull", "forearms", "wrist", "barbell", 3, "12", 45, L, "Palms down. Lift the back of the hands."),
  row("Dumbbell reverse wrist curl", "upper_pull", "forearms", "wrist", "dumbbell", 3, "12", 45, L, "Palms down. Small range. Control it."),
  row("Cable wrist curl", "upper_pull", "forearms", "wrist", "cable", 3, "12", 45, L, "Forearm braced. Cable stays light."),
  row("Standing wrist roller", "upper_pull", "forearms", "wrist", "plate", 3, "1", 60, L, "Roll the plate up, then back down. Count one trip as the set."),
  row("One-arm dead hang", "upper_pull", "grip", "grip", "bodyweight", 3, "15 sec / side", 45, T, "One hand. Shoulder packed. Switch sides."),
  row("Active dead hang", "upper_pull", "grip", "grip", "bodyweight", 3, "20 sec", 45, T, "Pull the shoulders down while you hang. Not a passive sag."),
  row("Dumbbell farmer carry", "conditioning", "grip", "carry", "dumbbell", 3, "30 sec", 60, LT, "Heavy bells at the sides. Walk tall."),
  row("Kettlebell farmer carry", "conditioning", "grip", "carry", "kettlebell", 3, "30 sec", 60, LT, "Bells in a hook grip. Quiet steps."),
  row("Dumbbell suitcase carry", "conditioning", "grip", "carry", "dumbbell", 3, "20 sec / side", 45, LT, "One bell. Do not lean away from it."),
  row("Kettlebell suitcase carry", "conditioning", "grip", "carry", "kettlebell", 3, "20 sec / side", 45, LT, "One bell. The free arm stays quiet."),
  row("Plate pinch", "upper_pull", "grip", "grip", "plate", 3, "20 sec", 45, LT, "Smooth sides out. Pinch and hold."),
  row("Finger curl", "upper_pull", "forearms", "wrist", "barbell", 3, "10", 45, L, "Let the bar roll to the fingers, then close the hand."),
  row("Two-towel dead hang", "upper_pull", "grip", "grip", "bodyweight", 3, "15 sec", 45, T, "A towel in each hand. Hang without shrugging into the ears."),
  row("Hex dumbbell hold", "upper_pull", "grip", "grip", "dumbbell", 3, "20 sec", 45, LT, "Pinch the hex ends. Elbows straight."),
  row("Rack carry", "conditioning", "grip", "carry", "barbell", 3, "30 sec", 60, LT, "Bar in the front rack. Elbows high. Short steps."),
  row("Single-arm waiter carry", "conditioning", "grip", "carry", "kettlebell", 3, "20 sec / side", 45, LT, "Bell locked overhead. Ribs down."),

  row("High-bar back squat", "lower", "lower", "squat", "barbell", 4, "5", 90, L, "Bar on the traps. Upright torso. Full depth you can own."),
  row("Low-bar back squat", "lower", "lower", "squat", "barbell", 4, "5", 90, L, "Bar lower on the back. Hips travel back."),
  row("Pause back squat", "lower", "lower", "squat", "barbell", 4, "3", 90, L, "Two-count pause in the hole. Stand without a bounce."),
  row("Tempo back squat", "lower", "lower", "squat", "barbell", 3, "5", 90, L, "Three seconds down. No dive."),
  row("Hack squat machine", "lower", "lower", "squat", "machine", 3, "8", 75, L, "Back on the pad. Knees track over the toes."),
  row("Pendulum squat machine", "lower", "lower", "squat", "machine", 3, "8", 75, L, "Let the machine set the path. Own the bottom."),
  row("Smith machine squat", "lower", "lower", "squat", "smith", 3, "8", 75, L, "Feet slightly forward. Sit between the hips."),
  row("Heels-elevated squat", "lower", "lower", "squat", "barbell", 3, "6", 90, L, "Heels on a small plate. Knees travel forward."),
  row("Goblet cyclist squat", "lower", "lower", "squat", "dumbbell", 3, "8", 60, L, "Heels up, narrow stance. Bell at the chest."),
  row("Leg press", "lower", "lower", "squat", "machine", 4, "8", 75, L, "Low back stays on the pad. Do not lock the knees hard."),
  row("Single-leg leg press", "lower", "lower", "squat", "machine", 3, "8 / leg", 60, L, "One foot. Control the depth."),
  row("Narrow-stance leg press", "lower", "lower", "squat", "machine", 3, "8", 75, L, "Feet low and close. Knees track over the toes."),
  row("Pause front squat", "lower", "lower", "squat", "barbell", 3, "3", 90, L, "Elbows high. Pause in the bottom."),
  row("Sissy squat", "lower", "lower", "squat", "bodyweight", 3, "8", 45, R, "Knees travel forward. Torso leans back with them. Use a support if you need it."),

  row("Barbell stiff-leg deadlift", "lower", "lower", "hinge", "barbell", 3, "6", 90, L, "Soft knees that stay soft. Hamstrings load the hinge."),
  row("Dumbbell stiff-leg deadlift", "lower", "lower", "hinge", "dumbbell", 3, "8", 75, L, "Bells stay close to the legs. Flat back."),
  row("Deficit conventional deadlift", "lower", "lower", "hinge", "barbell", 3, "4", 90, L, "Stand on a small plate. Same pull, longer range."),
  row("Pause Romanian deadlift", "lower", "lower", "hinge", "barbell", 3, "5", 90, L, "Pause just below the knees. Then stand."),
  row("Cable Romanian deadlift", "lower", "lower", "hinge", "cable", 3, "10", 60, L, "Cable from low. Hinge until the hamstrings load."),
  row("Kettlebell Romanian deadlift", "lower", "lower", "hinge", "kettlebell", 3, "8", 60, L, "Bells in front. Shins stay nearly vertical."),
  row("Snatch-grip deadlift", "lower", "lower", "hinge", "barbell", 3, "4", 90, L, "Wide grip. Hips stay close to the bar."),
  row("Block pull", "lower", "lower", "hinge", "barbell", 3, "4", 90, L, "Bar starts on blocks, just below the knee. Pull to the lockout."),
  row("Seated good morning", "lower", "lower", "hinge", "barbell", 3, "8", 60, L, "Sit on a bench. Hinge the chest toward the floor."),
  row("Safety-bar good morning", "lower", "lower", "hinge", "barbell", 3, "6", 75, L, "Safety bar on the back. Hinge, do not squat it."),
  row("Single-leg cable pull-through", "lower", "lower", "hinge", "cable", 3, "8 / leg", 45, L, "One leg. Hips push the cable through."),
  row("Pause barbell hip thrust", "lower", "lower", "hip-thrust", "barbell", 3, "6", 75, L, "Squeeze and pause at the top. Chin stays tucked."),
  row("Machine hip thrust", "lower", "lower", "hip-thrust", "machine", 3, "8", 60, L, "Back on the pad. Ribs down at the lockout."),
  row("Feet-elevated hip thrust", "lower", "lower", "hip-thrust", "barbell", 3, "8", 75, L, "Feet on a bench or plates. Deeper hip flexion."),
  row("Barbell glute bridge", "lower", "lower", "hip-thrust", "barbell", 3, "8", 60, L, "Shoulders on the floor. Drive through the heels."),
  row("Barbell frog pump", "lower", "lower", "hip-thrust", "barbell", 3, "12", 45, L, "Soles together. Small range. Squeeze the glutes."),
  row("Banded barbell hip thrust", "lower", "lower", "hip-thrust", "barbell", 3, "8", 60, L, "A band above the knees plus the bar. Knees stay out."),

  row("Seated machine leg curl", "lower", "lower", "knee-flexion", "machine", 3, "10", 45, L, "Pad on the lower leg. Curl without lifting the hips."),
  row("Lying machine leg curl", "lower", "lower", "knee-flexion", "machine", 3, "10", 45, L, "Hips stay down. Squeeze at the top."),
  row("Standing machine leg curl", "lower", "lower", "knee-flexion", "machine", 3, "10 / leg", 45, L, "One leg. The hip stays still."),
  row("Stability-ball leg curl", "lower", "lower", "knee-flexion", "bodyweight", 3, "8", 45, R, "Heels on the ball. Bridge, then curl the ball in."),
  row("Leg extension machine", "lower", "lower", "knee-extension", "machine", 3, "10", 45, L, "Pad above the ankles. Squeeze the quads. Do not slam the lockout."),
  row("Single-leg extension machine", "lower", "lower", "knee-extension", "machine", 3, "10 / leg", 45, L, "One leg. Control the lower."),
  row("Reverse Nordic curl", "lower", "lower", "knee-extension", "bodyweight", 3, "6", 60, R, "Kneel. Lean back with a straight line from knees to shoulders."),

  row("Barbell walking lunge", "lower", "lower", "lunge", "barbell", 3, "8 / leg", 75, L, "Bar on the back. Short steps. Tall torso."),
  row("Barbell reverse lunge", "lower", "lower", "lunge", "barbell", 3, "6 / leg", 75, L, "Step back. Front heel stays down."),
  row("Dumbbell Bulgarian split squat", "lower", "lower", "lunge", "dumbbell", 3, "8 / leg", 60, L, "Rear foot on the bench. Drop straight down."),
  row("Barbell Bulgarian split squat", "lower", "lower", "lunge", "barbell", 3, "6 / leg", 75, L, "Bar on the back. Front knee tracks over the mid-foot."),
  row("Front-rack reverse lunge", "lower", "lower", "lunge", "barbell", 3, "6 / leg", 75, L, "Bar in the front rack. Elbows high."),
  row("Poliquin step-up", "lower", "lower", "lunge", "dumbbell", 3, "8 / leg", 60, L, "Heel on the box, toes up. Drive the front heel."),
  row("Petersen step-up", "lower", "lower", "lunge", "dumbbell", 3, "8 / leg", 60, L, "High box. The thigh gets past parallel before you stand."),
  row("Walking overhead lunge", "lower", "lower", "lunge", "dumbbell", 3, "6 / leg", 60, L, "Bells locked overhead. Ribs down while you step."),
  row("Clock lunge", "lower", "lower", "lunge", "dumbbell", 3, "3 / side", 60, L, "Lunge forward, side, and back. One set is the clock."),
  row("Deficit walking lunge", "lower", "lower", "lunge", "dumbbell", 3, "6 / leg", 60, L, "Front foot steps up onto a low plate. Longer range."),

  row("Standing machine calf raise", "lower", "lower", "calf", "machine", 3, "10", 45, L, "Pause at the top. Lower the heels under control."),
  row("Seated machine calf raise", "lower", "lower", "calf", "machine", 3, "12", 45, L, "Knees bent. This biases the soleus."),
  row("Leg-press calf raise", "lower", "lower", "calf", "machine", 3, "12", 45, L, "Balls of the feet on the edge of the sled. Full range."),
  row("Donkey calf raise", "lower", "lower", "calf", "machine", 3, "12", 45, L, "Hinge at the hips. Raise the heels, not the hips."),
  row("Smith machine calf raise", "lower", "lower", "calf", "smith", 3, "10", 45, L, "Bar on the back. Balls of the feet on a plate."),
  row("Dumbbell single-leg calf raise", "lower", "lower", "calf", "dumbbell", 3, "10 / leg", 45, L, "One bell. Hold a rack for balance."),
  row("Adductor machine", "lower", "lower", "hip-adduction", "machine", 3, "12", 45, L, "Squeeze the pads together. Do not yank."),
  row("Abductor machine", "lower", "lower", "hip-abduction", "machine", 3, "12", 45, L, "Push the knees out. Pause."),
  row("Cable hip abduction", "lower", "lower", "hip-abduction", "cable", 3, "12 / side", 45, L, "Ankle cuff. Lift the leg out without leaning."),
  row("Cable hip adduction", "lower", "lower", "hip-adduction", "cable", 3, "12 / side", 45, L, "Ankle cuff. Pull the leg across."),
  row("Back extension", "lower", "lower", "hinge", "bodyweight", 3, "10", 45, R, "Hips on the pad. Hinge, do not throw the head back."),
  row("Machine back extension", "lower", "lower", "hinge", "machine", 3, "10", 45, L, "Pad across the hips. Add a plate only when the hinge is clean."),

  row("High-to-low cable woodchop", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Cable starts high. Turn the hips. Arms stay long."),
  row("Low-to-high cable woodchop", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Cable starts low. Finish over the far shoulder."),
  row("Kneeling cable woodchop", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Both knees down so the hips cannot cheat as much."),
  row("Half-kneeling high-to-low woodchop", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Inside knee down. Chop down across the body."),
  row("Dumbbell woodchop", "rotational", "core", "rotation", "dumbbell", 3, "8 / side", 45, L, "One bell. High to low. The hips turn, the spine stays quiet."),
  row("Kettlebell woodchop", "rotational", "core", "rotation", "kettlebell", 3, "8 / side", 45, L, "Bell in both hands. Same arc as the dumbbell chop."),
  row("High-to-low band woodchop", "rotational", "core", "rotation", "band", 3, "8 / side", 45, R, "Anchor the band high. Turn through the hips."),
  row("Low-to-high band woodchop", "rotational", "core", "rotation", "band", 3, "8 / side", 45, R, "Anchor the band low. Finish tall."),
  row("Kneeling landmine rotation", "rotational", "core", "rotation", "landmine", 3, "6 / side", 45, L, "Tall kneeling. Sweep the bar in an arc."),
  row("Split-stance landmine rotation", "rotational", "core", "rotation", "landmine", 3, "6 / side", 60, L, "Split stance. The bar travels from hip to hip."),
  row("Kneeling landmine 180", "rotational", "core", "rotation", "landmine", 3, "6 / side", 60, L, "Sweep the bar from one hip, overhead, to the other hip."),
  row("Landmine rainbow", "rotational", "core", "rotation", "landmine", 3, "6 / side", 45, L, "Arms long. The bar paints a rainbow."),
  row("Standing cable rotation", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Handle at chest height. Rotate away from the stack."),
  row("Half-kneeling cable rotation", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Inside knee down. Rotate the handle across."),
  row("Band standing rotation", "rotational", "core", "rotation", "band", 3, "8 / side", 45, L, "Band at chest height. Turn the hips, not the low back."),
  row("Half-kneeling band rotation", "rotational", "core", "rotation", "band", 3, "8 / side", 45, L, "Band at chest height. Inside knee down."),
  row("Split-stance Pallof press", "rotational", "core", "anti-rotation", "cable", 3, "8 / side", 45, L, "Press out and hold. Do not let the cable turn you."),
  row("Tall-kneeling Pallof press", "rotational", "core", "anti-rotation", "cable", 3, "8 / side", 45, L, "Both knees down. Press and pause."),
  row("Pallof press walkout", "rotational", "core", "anti-rotation", "cable", 3, "6 / side", 45, L, "Press out, then walk away from the stack. Resist the twist."),
  row("Band Pallof walkout", "rotational", "core", "anti-rotation", "band", 3, "6 / side", 45, L, "Press the band out and step away from the anchor."),
  row("Kneeling med-ball rotational throw", "rotational", "core", "throw", "medball", 3, "6 / side", 45, L, "Both knees down. Throw the ball into a wall."),
  row("Seated med-ball rotational throw", "rotational", "core", "throw", "medball", 3, "6 / side", 45, L, "Sit tall. Rotate and throw. The feet stay down."),
  row("Step-in med-ball scoop toss", "rotational", "core", "throw", "medball", 3, "6 / side", 45, L, "Scoop the ball from the hip and throw as you step."),
  row("Wall med-ball shot-put", "rotational", "core", "throw", "medball", 3, "6 / side", 45, L, "Ball at the shoulder. Push-throw into the wall."),
  row("Weighted Russian twist", "rotational", "core", "rotation", "plate", 3, "8 / side", 45, L, "Feet down or hovering. Rotate the plate, not the neck."),
  row("Decline Russian twist", "rotational", "core", "rotation", "bodyweight", 3, "8 / side", 45, R, "On a decline bench. Rotate side to side."),
  row("Cable Russian twist", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Cable from the side. Rotate away from the stack."),
  row("Medicine-ball Russian twist", "rotational", "core", "rotation", "medball", 3, "8 / side", 45, L, "Ball in both hands. Tap the floor each side."),
  row("Standing cable lift", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Low cable. Lift diagonally across the body."),
  row("Rotational cable press", "rotational", "core", "rotation", "cable", 3, "8 / side", 45, L, "Press the handle out as the hips turn."),

  row("Cable crunch", "core", "core", "core-flexion", "cable", 3, "12", 45, L, "Kneel at the stack. Curl the ribs toward the hips."),
  row("Kneeling cable crunch", "core", "core", "core-flexion", "cable", 3, "12", 45, L, "Hips stay put. Round the spine a little on purpose."),
  row("Machine crunch", "core", "core", "core-flexion", "machine", 3, "12", 45, L, "Pad on the chest. Curl, do not yank the handles."),
  row("Decline sit-up", "core", "core", "core-flexion", "bodyweight", 3, "10", 45, R, "Feet locked. Sit up without throwing the neck."),
  row("Weighted crunch", "core", "core", "core-flexion", "plate", 3, "10", 45, L, "Plate on the chest. Curl the ribs down."),
  row("Hanging knee raise", "core", "core", "core-flexion", "bodyweight", 3, "8", 45, R, "Hang from the bar. Knees toward the chest. No swing."),
  row("Captain's chair knee raise", "core", "core", "core-flexion", "bodyweight", 3, "10", 45, R, "Forearms on the pads. Lift the knees. Do not rock."),
  row("Hanging windshield wiper", "core", "core", "rotation", "bodyweight", 3, "6 / side", 60, R, "Hang. Knees bent. Sweep them side to side."),
  row("V-up", "core", "core", "core-flexion", "bodyweight", 3, "8", 45, R, "Arms and legs meet. Low back returns to the floor."),
  row("Reverse crunch", "core", "core", "core-flexion", "bodyweight", 3, "10", 45, R, "Curl the hips off the floor. The knees stay bent."),
  row("Bicycle crunch", "core", "core", "core-flexion", "bodyweight", 3, "8 / side", 45, R, "Opposite elbow toward the knee. Slow enough to stay honest."),
  row("Dead bug with dumbbell", "core", "core", "core-anti", "dumbbell", 3, "6 / side", 45, L, "Bell over the chest. Reach the free arm and the opposite leg."),
  row("Dumbbell side bend", "core", "core", "core-flexion", "dumbbell", 3, "10 / side", 45, L, "One bell. Bend straight to the side. Do not twist."),
  row("Cable side bend", "core", "core", "core-flexion", "cable", 3, "10 / side", 45, L, "Cable from low. Bend away, then return."),
  row("Landmine side bend", "core", "core", "core-flexion", "landmine", 3, "8 / side", 45, L, "Hold the end of the bar. Bend to the side."),
  row("Plank shoulder tap", "core", "core", "core-anti", "bodyweight", 3, "8 / side", 45, R, "Hips stay quiet while the hand taps the shoulder."),
  row("Weighted front plank", "core", "core", "core-anti", "plate", 3, "20 sec", 45, LT, "A light plate on the back. Ribs down."),
  row("Long-lever plank", "core", "core", "core-anti", "bodyweight", 3, "20 sec", 45, T, "Hands further forward than a normal plank. Keep the hips up."),
  row("McGill curl-up", "core", "core", "core-flexion", "bodyweight", 3, "6", 45, R, "One knee bent, one leg long. Curl the head and shoulders only."),
  row("Swiss-ball crunch", "core", "core", "core-flexion", "bodyweight", 3, "10", 45, R, "Low back on the ball. Curl over it."),
  row("Ab wheel from the knees", "core", "core", "core-anti", "bodyweight", 3, "6", 45, R, "Knees down. Roll out only as far as the low back stays quiet."),
  row("Garhammer raise", "core", "core", "core-flexion", "bodyweight", 3, "8", 45, R, "On the captain's chair. Curl the pelvis up after the knees lift."),

  row("Neck harness flexion", "mobility", "neck", "neck", "band", 2, "10", 30, L, "Harness or band. Nod the chin. Light load."),
  row("Neck harness lateral flexion", "mobility", "neck", "neck", "band", 2, "8 / side", 30, L, "Bend the ear toward the shoulder. Do not twist."),
  row("Plate neck extension", "mobility", "neck", "neck", "plate", 2, "8", 30, L, "Face down. Plate on the back of the head. Small range."),
  row("Band neck extension", "mobility", "neck", "neck", "band", 2, "10", 30, L, "Band behind the head. Look up a little against the band."),
  row("Band neck lateral raise", "mobility", "neck", "neck", "band", 2, "8 / side", 30, L, "Band at the side of the head. Ear toward the shoulder."),
  row("Prone neck extension", "mobility", "neck", "neck", "bodyweight", 2, "8", 30, R, "Face down. Lift the head a few inches. No yank."),
  row("Isometric neck extension", "mobility", "neck", "neck", "bodyweight", 2, "8 sec", 30, T, "Hand on the back of the head. Push gently. Hold."),
  row("Supine neck flexion", "mobility", "neck", "neck", "bodyweight", 2, "8", 30, R, "On your back. Nod and lift the head. The shoulders stay down."),

  row("Box jump step-down", "explosive", "full", "plyo", "bodyweight", 3, "4", 60, R, "Jump up. Step down. Quiet landing."),
  row("Continuous box jump", "explosive", "full", "plyo", "bodyweight", 3, "5", 60, R, "Rebound only if the landing stays quiet."),
  row("Single-leg box jump", "explosive", "full", "plyo", "bodyweight", 3, "3 / leg", 60, R, "Low box. Stick it. Step down."),
  row("Depth drop", "explosive", "full", "plyo", "bodyweight", 3, "4", 60, R, "Step off a low box. Stick the landing. Do not rebound yet."),
  row("Skater hop", "explosive", "full", "plyo", "bodyweight", 3, "6 / side", 45, R, "Hop side to side. Stick each landing."),
  row("Med-ball vertical throw", "explosive", "full", "throw", "medball", 3, "5", 45, L, "Scoop the ball from the hip and throw it straight up."),
  row("Med-ball squat-jump throw", "explosive", "full", "throw", "medball", 3, "5", 60, L, "Squat, jump, and throw the ball up. Light ball."),
  row("Kneeling med-ball chest pass", "explosive", "full", "throw", "medball", 3, "6", 45, L, "Both knees down. Pass the ball into the wall."),
  row("Overhead med-ball slam", "explosive", "full", "throw", "medball", 4, "6", 45, L, "Ball overhead. Slam it just in front of the feet."),
  row("Wall ball", "explosive", "full", "throw", "medball", 3, "8", 60, L, "Squat, then throw the ball to a target on the wall."),
  row("Dumbbell thruster", "explosive", "full", "olympic", "dumbbell", 3, "6", 75, L, "Front squat the bells, then drive them overhead."),
  row("Barbell thruster", "explosive", "full", "olympic", "barbell", 3, "6", 90, L, "Front squat into a push press. One motion."),
  row("Kettlebell thruster", "explosive", "full", "olympic", "kettlebell", 3, "6", 60, L, "Bells in the rack. Squat, then punch them overhead."),
  row("Barbell push jerk", "explosive", "full", "olympic", "barbell", 4, "3", 90, L, "Dip, drive, and catch the bar with a second dip."),
  row("Barbell split jerk", "explosive", "full", "olympic", "barbell", 4, "3", 90, L, "Drive the bar and split the feet to catch it."),
  row("Barbell hang high pull", "explosive", "full", "olympic", "barbell", 4, "3", 90, L, "From the hang. Elbows high and fast. Do not catch it."),
  row("Jumping pull-up", "explosive", "full", "plyo", "bodyweight", 3, "4", 60, R, "A small jump into the pull. Control the lower."),
  row("Clap pull-up", "explosive", "full", "plyo", "bodyweight", 3, "3", 75, R, "Pull high enough to clap. Bail out if the bar is close."),
  row("Plyo Bulgarian split squat", "explosive", "full", "plyo", "bodyweight", 3, "4 / leg", 60, R, "Switch or rebound off the front foot. Soft landing."),
  row("Med-ball sit-up throw", "explosive", "full", "throw", "medball", 3, "6", 45, L, "Partner or wall. Sit up and throw the ball."),
  row("Bounding", "explosive", "full", "plyo", "bodyweight", 3, "6", 60, R, "Exaggerated running bounds. Stick the last one."),
  row("A-skip", "explosive", "full", "plyo", "bodyweight", 3, "20", 30, R, "Skip with a high knee. Quiet feet."),

  row("Double-under jump rope", "conditioning", "full", "conditioning", "bodyweight", 6, "20 sec", 30, T, "The rope passes twice per jump. Misses mean slow down."),
  row("High knees", "conditioning", "full", "conditioning", "bodyweight", 4, "20 sec", 30, T, "Knees up. Stay tall."),
  row("Butt kicks", "conditioning", "full", "conditioning", "bodyweight", 4, "20 sec", 30, T, "Heels toward the glutes. Quick, not a lean."),
  row("Mountain climber", "conditioning", "full", "conditioning", "bodyweight", 4, "20 sec", 30, T, "Hips stay low. Drive the knees."),
  row("Jumping jack", "conditioning", "full", "conditioning", "bodyweight", 4, "30 sec", 20, T, "Soft landing. Arms finish overhead."),
  row("Devil press", "conditioning", "full", "conditioning", "dumbbell", 4, "6", 60, L, "Burpee the bells, then swing them overhead."),
  row("Man maker", "conditioning", "full", "conditioning", "dumbbell", 3, "5", 75, L, "Push-up, row each arm, then a thruster. One rep is the whole chain."),
  row("Lateral bear crawl", "conditioning", "full", "conditioning", "bodyweight", 3, "20 sec", 30, T, "Hips low. Step the hands and feet sideways."),
  row("Sled row", "conditioning", "full", "conditioning", "sled", 4, "20 sec", 60, T, "Rope or straps. Sit back and row the sled in."),
  row("Prowler sprint", "conditioning", "full", "conditioning", "sled", 6, "15 sec", 60, T, "Low handles. Short, hard pushes."),
  row("Battle rope circles", "conditioning", "full", "conditioning", "rope", 4, "20 sec", 30, T, "Arms make circles. The ropes stay moving."),
  row("Rowing machine pieces", "conditioning", "full", "conditioning", "machine", 4, "45 sec", 45, T, "Hard pieces. Legs, then hips, then arms."),
  row("Stair-climber bout", "conditioning", "full", "conditioning", "machine", 4, "45 sec", 45, T, "Steady steps. Do not lean on the rails."),
  row("Fan-bike sprint", "conditioning", "full", "conditioning", "machine", 8, "15 sec", 45, T, "Hard sprint, then easy pedal. Not the assault-bike menu."),

  row("Open-book thoracic rotation", "mobility", "t-spine", "thoracic", "bodyweight", 2, "6 / side", 20, R, "Side-lying. Open the top arm toward the floor behind you."),
  row("Quadruped thoracic rotation", "mobility", "t-spine", "thoracic", "bodyweight", 2, "6 / side", 20, R, "Hands and knees. One hand behind the head. Rotate up."),
  row("World's greatest stretch", "mobility", "hip", "hip-opener", "bodyweight", 2, "4 / side", 20, R, "Lunge, elbow to instep, then reach up."),
  row("Thread the needle", "mobility", "t-spine", "thoracic", "bodyweight", 2, "6 / side", 20, R, "From all fours. Reach one arm under the body."),
  row("Sleeper stretch", "mobility", "t-spine", "shoulder-stretch", "bodyweight", 2, "30 sec / side", 20, T, "Side-lying. Gently press the forearm toward the floor."),
  row("Doorway pec stretch", "mobility", "t-spine", "shoulder-stretch", "bodyweight", 2, "30 sec / side", 20, T, "Forearm on the frame. Step through until the chest opens."),
  row("Hip airplane", "mobility", "hip", "hip-opener", "bodyweight", 2, "4 / side", 20, R, "Hinge on one leg. Rotate the hips open, then closed."),
  row("Hamstring floss", "mobility", "posterior", "hamstring-floss", "bodyweight", 2, "8 / side", 20, R, "Foot on a low box. Rock the hips, do not bounce the knee."),
  row("Cat-camel", "mobility", "t-spine", "thoracic", "bodyweight", 1, "6", 15, R, "Round, then arch. Move the spine, not the elbows."),
  row("Ankle dorsiflexion rock", "mobility", "foot", "ankle-rock", "bodyweight", 2, "8 / side", 15, R, "Knee tracks over the toes. Heel stays down."),
  row("Supine belly breathing", "mobility", "t-spine", "breathing", "bodyweight", 1, "6", 15, R, "One hand on the belly. The breath moves the hand, not the neck."),
  row("Lat doorway stretch", "mobility", "t-spine", "shoulder-stretch", "bodyweight", 2, "30 sec / side", 20, T, "Hand on the frame overhead. Lean until the lat lengthens."),
];

function queriesFor(exercise) {
  return [
    `NASM ${exercise.name}`,
    `PureGym how to ${exercise.name}`,
    `OPEX ${exercise.name}`,
    `Renaissance Periodization ${exercise.name}`,
    `${exercise.name} proper form`,
  ];
}

function scoreClip(clip, exercise) {
  if (!clip.videoId || clip.seconds == null || clip.seconds < 8 || clip.seconds > 90) return -1;
  if (!titleFits(exercise.name, clip.title, exercise.need)) return -1;
  const known = reputable(clip.channel);
  if (!known && !(clip.seconds <= 60 && demoTitle(clip.title))) return -1;
  let score = known ? 50 : 10;
  if (clip.seconds <= 40) score += 8;
  if (demoTitle(clip.title)) score += 4;
  return score;
}

async function pickClip(exercise, used) {
  let best = null;
  for (const query of queriesFor(exercise)) {
    let clips = [];
    try {
      clips = await search(query);
    } catch (error) {
      console.error("search failed", query, error.message);
      continue;
    }
    const ranked = clips
      .map((clip) => ({ clip, score: scoreClip(clip, exercise) }))
      .filter((row) => row.score > 0 && !used.has(row.clip.videoId))
      .sort((a, b) => b.score - a.score || a.clip.seconds - b.clip.seconds);
    for (const candidate of ranked.slice(0, 4)) {
      const embed = await oembed(candidate.clip.videoId);
      if (!embed) continue;
      if (!titleFits(exercise.name, embed.title, exercise.need)) continue;
      const channel = embed.channel || candidate.clip.channel;
      if (!reputable(channel) && !(candidate.clip.seconds <= 60 && demoTitle(embed.title))) continue;
      best = {
        videoId: candidate.clip.videoId,
        seconds: candidate.clip.seconds,
        channel,
        videoTitle: embed.title,
      };
      return best;
    }
  }
  return best;
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => run()));
  return results;
}

const taken = existingNames();
const used = existingVideoIds();
let done = [];
try {
  done = JSON.parse(fs.readFileSync(OUT, "utf8"));
} catch {
  done = [];
}
if (!Array.isArray(done)) done = [];
const doneNames = new Set(done.map((row) => row.name));
for (const row of done) used.add(row.videoId);

const pending = EXERCISES.filter((exercise) => {
  if (taken.has(exercise.name.toLowerCase())) {
    console.error("NAME CLASH", exercise.name);
    return false;
  }
  return !doneNames.has(exercise.name);
});

console.log(`catalog ${EXERCISES.length} pending ${pending.length} already ${done.length}`);

await mapPool(pending, 4, async (exercise) => {
  const clip = await pickClip(exercise, used);
  if (!clip) {
    console.error("NO CLIP", exercise.name);
    return null;
  }
  used.add(clip.videoId);
  const saved = { ...exercise, ...clip };
  delete saved.need;
  done.push(saved);
  fs.writeFileSync(OUT, JSON.stringify(done, null, 2));
  console.log("OK", done.length, exercise.name, clip.seconds, clip.channel, clip.videoId);
  return saved;
});

fs.writeFileSync(CACHE, JSON.stringify(cache));
fs.writeFileSync(OUT, JSON.stringify(done, null, 2));
const missed = pending.filter((exercise) => !done.some((row) => row.name === exercise.name));
console.log(`wrote ${done.length} missed ${missed.length}`);
if (missed.length) console.log(missed.map((row) => row.name).join("\n"));
