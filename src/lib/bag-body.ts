/** Anatomical regions a bag workout can emphasize. */
export const BAG_REGIONS = [
  "neck",
  "traps",
  "shoulders",
  "chest",
  "arms",
  "core",
  "obliques",
  "lats",
  "hips",
  "hip-flexors",
  "glutes",
  "legs",
  "knees",
  "shins",
  "feet",
] as const;

export type BagRegion = (typeof BAG_REGIONS)[number];
export type BagSide = "both" | "left" | "right";
export type FigureView = "front" | "back";

export const BAG_REGION_LABELS: Record<BagRegion, string> = {
  neck: "Neck",
  traps: "Traps",
  shoulders: "Shoulders",
  chest: "Chest",
  arms: "Arms",
  core: "Core",
  obliques: "Obliques",
  lats: "Lats",
  hips: "Hips",
  "hip-flexors": "Hip flexors",
  glutes: "Glutes",
  legs: "Legs",
  knees: "Knees",
  shins: "Shins",
  feet: "Feet",
};

const REGION_SET = new Set<string>(BAG_REGIONS);

export function isBagRegion(value: string): value is BagRegion {
  return REGION_SET.has(value);
}

export function parseBagRegions(raw: string | null | undefined): BagRegion[] {
  const seen = new Set<BagRegion>();
  const out: BagRegion[] = [];
  for (const part of (raw ?? "").split(/[,\s]+/)) {
    const token = part.trim().toLowerCase();
    if (!isBagRegion(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

export function formatBagRegions(regions: readonly BagRegion[]) {
  return regions.map((region) => BAG_REGION_LABELS[region]).join(", ");
}

/**
 * Reflect an absolute SVG path across x = center.
 * Source paths use M, L, H, V, C, and Z only.
 */
export function mirrorPath(d: string, center = 100) {
  const tokens = d.trim().match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) return d;
  const out: string[] = [];
  let index = 0;
  let command = "";
  const read = () => Number(tokens[index++]);
  const flip = (x: number) => center * 2 - x;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      index += 1;
      if (command.toUpperCase() === "Z") {
        out.push("Z");
        continue;
      }
    }
    const upper = command.toUpperCase();
    if (upper === "M" || upper === "L") {
      const x = read();
      const y = read();
      out.push(`${command}${flip(x)} ${y}`);
      if (upper === "M") command = command === "M" ? "L" : "l";
    } else if (upper === "H") {
      out.push(`${command}${flip(read())}`);
    } else if (upper === "V") {
      out.push(`${command}${read()}`);
    } else if (upper === "C") {
      const x1 = read();
      const y1 = read();
      const x2 = read();
      const y2 = read();
      const x = read();
      const y = read();
      out.push(`${command}${flip(x1)} ${y1} ${flip(x2)} ${y2} ${flip(x)} ${y}`);
    } else {
      throw new Error(`Unsupported path command ${command}`);
    }
  }
  return out.join(" ");
}

export type FigurePart = {
  id: string;
  region: BagRegion;
  side: "left" | "right" | "mid";
  view: FigureView;
  d: string;
};

type Seed = {
  region: BagRegion;
  side: "right" | "mid";
  view: FigureView;
  d: string;
};

/**
 * 8-head figure. Head top near y=18, sole near y=432.
 * Right-side paths are the figure's right (viewer's left on the front).
 * A silhouette is drawn over the regions so the body still reads when a part is dark.
 */
export const HEAD_PATH =
  "M100 18 C120 18 128 34 126 50 C124 64 114 74 100 74 C86 74 76 64 74 50 C72 34 80 18 100 18 Z";

export const SILHOUETTE: Record<FigureView, string> = {
  front:
    "M96 72 C88 84 74 90 62 96 C50 102 42 114 40 130 C38 150 42 174 44 194 C46 212 42 228 38 242 C34 254 42 262 52 258 C60 254 62 238 64 220 C66 200 68 180 72 166 L76 180 C74 208 72 240 74 270 C76 300 74 330 78 354 C80 378 78 400 82 414 C74 418 54 422 44 432 C52 440 84 438 94 424 L98 410 L100 416 L102 410 L106 424 C116 438 148 440 156 432 C146 422 126 418 118 414 C122 400 120 378 122 354 C126 330 124 300 126 270 C128 240 126 208 124 180 L128 166 C132 180 134 200 136 220 C138 238 140 254 148 258 C158 262 166 254 162 242 C158 228 154 212 156 194 C158 174 162 150 160 130 C158 114 150 102 138 96 C126 90 112 84 104 72 C102 76 98 76 96 72 Z",
  back:
    "M96 72 C88 84 72 92 60 100 C48 108 42 120 40 136 C38 156 42 178 44 198 C46 216 42 230 38 244 C34 256 42 264 52 260 C60 256 62 240 64 222 C66 202 68 182 74 168 L78 182 C76 210 74 242 76 272 C78 302 76 332 80 356 C82 380 80 402 84 416 C76 420 56 424 46 434 C54 442 86 440 96 426 L100 412 L104 426 C114 440 146 442 154 434 C144 424 124 420 116 416 C120 402 118 380 120 356 C124 332 122 302 124 272 C126 242 124 210 122 182 L126 168 C132 182 134 202 136 222 C138 240 140 256 148 260 C158 264 166 256 162 244 C158 230 154 216 156 198 C158 178 162 156 160 136 C158 120 152 108 140 100 C128 92 112 84 104 72 C102 76 98 76 96 72 Z",
};

const SEEDS: Seed[] = [
  {
    region: "neck",
    side: "mid",
    view: "front",
    d: "M93 74 H107 C108 84 106 94 104 100 H96 C94 94 92 84 93 74 Z",
  },
  {
    region: "neck",
    side: "mid",
    view: "back",
    d: "M93 74 H107 C108 84 106 94 104 100 H96 C94 94 92 84 93 74 Z",
  },
  {
    region: "traps",
    side: "mid",
    view: "front",
    d: "M72 98 C84 90 116 90 128 98 L118 114 C108 106 92 106 82 114 Z",
  },
  {
    region: "traps",
    side: "mid",
    view: "back",
    d: "M64 102 C80 88 120 88 136 102 L122 128 C110 116 90 116 78 128 Z",
  },
  {
    region: "chest",
    side: "mid",
    view: "front",
    d: "M80 112 C90 104 110 104 120 112 C126 128 122 150 114 160 H86 C78 150 74 128 80 112 Z",
  },
  {
    region: "core",
    side: "mid",
    view: "front",
    d: "M88 158 H112 C114 178 110 200 104 212 H96 C90 200 86 178 88 158 Z",
  },
  {
    region: "core",
    side: "mid",
    view: "back",
    d: "M86 160 H114 C116 182 110 206 100 216 C90 206 84 182 86 160 Z",
  },
  {
    region: "shoulders",
    side: "right",
    view: "front",
    d: "M46 108 C40 98 56 92 70 100 C76 108 74 124 64 130 C52 132 42 120 46 108 Z",
  },
  {
    region: "shoulders",
    side: "right",
    view: "back",
    d: "M46 112 C40 102 56 96 70 104 C76 114 74 130 64 136 C52 138 42 124 46 112 Z",
  },
  {
    region: "arms",
    side: "right",
    view: "front",
    d: "M50 128 C42 148 40 174 46 196 C42 214 40 232 50 246 C58 252 66 242 62 226 C66 206 64 184 70 164 C74 146 66 130 58 124 Z",
  },
  {
    region: "arms",
    side: "right",
    view: "back",
    d: "M50 132 C42 152 40 178 46 200 C42 218 40 236 50 250 C58 256 66 246 62 230 C66 210 64 188 70 168 C74 150 66 134 58 128 Z",
  },
  {
    region: "obliques",
    side: "right",
    view: "front",
    d: "M74 160 C82 154 90 160 90 174 C90 196 82 210 74 214 C66 204 66 174 74 160 Z",
  },
  {
    region: "lats",
    side: "right",
    view: "back",
    d: "M70 124 C58 136 58 162 68 182 C78 192 90 180 90 160 C90 140 82 124 74 118 Z",
  },
  {
    region: "hips",
    side: "right",
    view: "front",
    d: "M74 206 C66 212 66 228 76 236 C88 242 98 232 96 216 C94 206 84 200 74 206 Z",
  },
  {
    region: "hips",
    side: "right",
    view: "back",
    d: "M74 208 C66 214 66 230 76 238 C88 244 98 234 96 218 C94 208 84 202 74 208 Z",
  },
  {
    region: "hip-flexors",
    side: "right",
    view: "front",
    d: "M82 198 C90 192 100 198 100 212 C98 224 88 228 80 218 C74 210 76 200 82 198 Z",
  },
  {
    region: "glutes",
    side: "right",
    view: "back",
    d: "M76 188 C86 178 100 186 100 206 C100 226 88 236 76 226 C66 216 68 196 76 188 Z",
  },
  {
    region: "legs",
    side: "right",
    view: "front",
    d: "M76 234 C86 226 98 234 98 254 C100 286 94 314 84 322 C72 326 66 310 66 278 C64 250 68 238 76 234 Z",
  },
  {
    region: "legs",
    side: "right",
    view: "back",
    d: "M78 236 C88 228 100 236 100 256 C102 288 96 316 86 324 C74 328 68 312 68 280 C66 252 70 240 78 236 Z",
  },
  {
    region: "knees",
    side: "right",
    view: "front",
    d: "M74 316 C84 310 96 314 96 326 C96 338 86 344 76 340 C66 334 66 322 74 316 Z",
  },
  {
    region: "knees",
    side: "right",
    view: "back",
    d: "M76 318 C86 312 98 316 98 328 C98 340 88 346 78 342 C68 336 68 324 76 318 Z",
  },
  {
    region: "shins",
    side: "right",
    view: "front",
    d: "M76 340 C86 336 94 344 92 360 C90 384 86 404 78 410 C68 408 66 382 68 360 C68 348 72 340 76 340 Z",
  },
  {
    region: "shins",
    side: "right",
    view: "back",
    d: "M78 342 C88 338 96 346 94 362 C92 386 88 406 80 412 C70 410 68 384 70 362 C70 350 74 342 78 342 Z",
  },
  {
    region: "feet",
    side: "right",
    view: "front",
    d: "M80 408 C68 406 46 412 44 424 C48 434 86 434 92 422 C94 414 88 408 80 408 Z",
  },
  {
    region: "feet",
    side: "right",
    view: "back",
    d: "M72 410 H90 C94 420 92 432 80 432 H68 C60 428 62 416 72 410 Z",
  },
];

function seedId(seed: Seed) {
  return `${seed.view}-${seed.region}-${seed.side}`;
}

export const FIGURE_PARTS: FigurePart[] = SEEDS.flatMap((seed) => {
  const base: FigurePart = {
    id: seedId(seed),
    region: seed.region,
    side: seed.side,
    view: seed.view,
    d: seed.d,
  };
  if (seed.side === "mid") return [base];
  const left: FigurePart = {
    id: `${seed.view}-${seed.region}-left`,
    region: seed.region,
    side: "left",
    view: seed.view,
    d: mirrorPath(seed.d),
  };
  return [base, left];
});

export function figureParts(view: FigureView) {
  return FIGURE_PARTS.filter((part) => part.view === view);
}

export function partIsLit(
  part: Pick<FigurePart, "region" | "side">,
  regions: readonly BagRegion[],
  emphasis: BagSide,
) {
  if (!regions.includes(part.region)) return false;
  if (part.side === "mid" || emphasis === "both") return true;
  return part.side === emphasis;
}
