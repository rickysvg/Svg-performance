/**
 * Training tags for plan exercises. The workout-complete recap reads these
 * so the copy names the actual work (rotational power, jab rounds) instead
 * of a generic "you trained" line.
 */

const EXACT: Record<string, readonly string[]> = {
  "Cable or band woodchop": ["rotational power"],
  "Cable woodchop": ["rotational power"],
  "Landmine rotation": ["rotational power"],
  "Rotational med-ball throw": ["rotational power", "explosive hips"],
  "Cable or band Pallof press": ["anti-rotation", "trunk brace"],
  "Squat jump or box step-up": ["explosive hips"],
  "Squat jump": ["explosive hips"],
  "Broad jump": ["explosive hips"],
  "Kettlebell swing or hip hinge": ["explosive hips", "posterior chain"],
  "Banded kettlebell swing": ["explosive hips"],
  "Dumbbell hip thrust": ["explosive hips"],
  "Trap-bar deadlift": ["posterior chain", "explosive hips"],
  "Romanian deadlift": ["posterior chain"],
  "Dumbbell Romanian deadlift": ["posterior chain"],
  "Single-leg RDL": ["posterior chain", "single-leg strength"],
  "Goblet squat": ["squat strength"],
  "Pause goblet squat": ["squat strength"],
  "Walking lunge": ["single-leg strength"],
  "Reverse lunge": ["single-leg strength"],
  "Dumbbell lateral lunge": ["single-leg strength", "lateral power"],
  "Lateral lunge": ["single-leg strength", "lateral power"],
  "Lateral bound or side step-over": ["lateral power", "explosive hips"],
  "Farmer carry": ["grip", "trunk brace"],
  "Farmer's carry": ["grip", "trunk brace"],
  "Suitcase carry": ["grip", "anti-rotation"],
  "Front plank": ["trunk brace"],
  "Side plank": ["trunk brace"],
  "Dead bug": ["trunk brace"],
  "Dumbbell bench press": ["pressing strength"],
  "Floor press": ["pressing strength"],
  "Overhead press": ["pressing strength"],
  "Single-arm overhead press": ["pressing strength"],
  "Plyo push-up": ["explosive pressing"],
  "Push-up": ["pressing strength"],
  "Med-ball chest pass": ["explosive pressing"],
  "Landmine press": ["pressing strength"],
  "Dumbbell high pull": ["explosive pull"],
  "One-arm row": ["upper-back strength"],
  "Chest-supported dumbbell row": ["upper-back strength"],
  "Half-kneeling one-arm row": ["upper-back strength"],
  "Chin-up, band-assist, or lat pulldown": ["pulling strength"],
  "Straight-arm pulldown": ["lat strength"],
  "Band pull-apart or face pull": ["shoulder health"],
  "Dumbbell pullover": ["lat strength"],
  "Dumbbell step-up": ["single-leg strength"],
  "Sled push": ["leg drive", "general conditioning"],
  "Sled hamstring drag": ["posterior chain", "general conditioning"],
  "Neck isometric matrix": ["neck strength"],
  "Neck extension hold": ["neck strength"],
  "Jump rope or easy bike intervals": ["aerobic conditioning"],
  "Assault bike intervals": ["repeat power", "aerobic conditioning"],
  "Daru alactic power bike": ["alactic power", "repeat power"],
  "Jamieson tempo bike": ["aerobic conditioning"],
  "Daru 75% endurance bike": ["aerobic conditioning"],
  "Jamieson cardiac output bike": ["aerobic conditioning"],
  "Leon Edwards 10/20 bike finisher": ["repeat power"],
  "Shadowbox round 1 — empty hands": ["footwork", "hand speed"],
  "Shadowbox round 2 — hand weights": ["hand speed", "shoulder endurance"],
  "Shadowbox round 2 — fists, no weights": ["hand speed", "footwork"],
  "Easy shadow cool-down": ["mobility"],
  "Jab — step and snap": ["jab rounds"],
  "Teep (push kick)": ["teep rounds"],
  "Lead hook": ["hook rounds", "rotational power"],
  "Prone Y raise": ["shoulder mobility"],
  "Prone T raise": ["shoulder mobility"],
  "Bird dog": ["trunk brace", "hip stability"],
  "Hip hinge": ["posterior chain"],
  "Air squat": ["squat strength"],
  "Pause air squat": ["squat strength"],
  "Split squat": ["single-leg strength"],
  "Single-leg glute bridge": ["explosive hips"],
  "Hollow hold": ["trunk brace"],
  "Superman hold": ["posterior chain"],
  "Superman": ["posterior chain"],
  "Banded DB front-rack march": ["trunk brace", "gait strength"],
  "Bent-over DB shrug": ["upper-back strength"],
  "Explosive dumbbell press": ["explosive pressing"],
};

export function parseStoredTags(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(",")) {
    const tag = part.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function formatStoredTags(tags: readonly string[]): string {
  return parseStoredTags(tags.join(", ")).join(", ");
}

function bagRoundTags(name: string): string[] {
  if (/jab/.test(name) && /hook/.test(name)) return ["jab/hook bag rounds"];
  if (/intelligent jab|body jab/.test(name)) return ["jab bag rounds", "range control"];
  if (/hook/.test(name)) return ["hook bag rounds", "rotational power"];
  if (/teep|low kick/.test(name)) return ["teep and low-kick rounds"];
  if (/knee|clinch/.test(name)) return ["clinch knees"];
  if (/elbow/.test(name)) return ["elbow and knee entries"];
  if (/defense|counter/.test(name)) return ["counter defense"];
  if (/pivot/.test(name)) return ["pivot power", "rotational power"];
  if (/level/.test(name)) return ["level changes"];
  if (/switch/.test(name)) return ["switch entries"];
  if (/speed|power/.test(name)) return ["speed and power"];
  if (/flow|combo/.test(name)) return ["combo flow"];
  if (/review/.test(name)) return ["theme review"];
  return ["bag rounds"];
}

/** Tags for one plan or logged exercise. Exact names win; patterns cover the rest. */
export function tagsForExercise(name: string): string[] {
  const exact = EXACT[name];
  if (exact) return [...exact];
  const n = name.toLowerCase();
  if (/bag rounds/.test(n)) return bagRoundTags(n);
  if (/explosive/.test(n) && /press|push/.test(n)) return ["explosive pressing"];
  if (/shadow/.test(n)) return ["footwork", "hand speed"];
  if (/jab/.test(n) && /hook/.test(n)) return ["jab/hook bag rounds"];
  if (/jab/.test(n)) return ["jab rounds"];
  if (/hook/.test(n)) return ["hook rounds", "rotational power"];
  if (/teep|low kick/.test(n)) return ["teep and low-kick rounds"];
  if (/knee|clinch|elbow/.test(n)) return ["clinch entries"];
  if (/bike|jump rope/.test(n)) return ["aerobic conditioning"];
  if (/sled/.test(n)) return ["general conditioning"];
  if (/woodchop|rotational|landmine rotation/.test(n)) return ["rotational power"];
  if (/swing|broad jump|squat jump|hip thrust|\bbound\b/.test(n)) return ["explosive hips"];
  if (/lunge|step-up|split squat/.test(n)) return ["single-leg strength"];
  if (/plank|dead bug|pallof|carry/.test(n)) return ["trunk brace"];
  if (/mobility|stretch|opener|flow/.test(n)) return ["mobility"];
  if (/squat|deadlift|rdl|hinge/.test(n)) return ["lower-body strength"];
  if (/press|push-?up|row|pull|chin-up/.test(n)) return ["upper-body strength"];
  return ["fight conditioning"];
}
