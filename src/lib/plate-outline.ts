export const PLATE_OUTLINE_VIEWBOX = "0 0 512 464";

/** Outer silhouette of the photoreal plate (octagon + side tabs), from the cutout alpha. */
export const PLATE_OUTLINE_PATH =
  "M4 134 L4 319 L12 332 L54 337 L160 458 L346 459 L457 337 L497 333 L506 323 L507 137 L501 125 L456 119 L359 11 L351 5 L169 4 L55 119 L18 122 L8 127 Z";

const CORNERS: Array<[number, number]> = [
  [4, 134],
  [4, 319],
  [12, 332],
  [54, 337],
  [160, 458],
  [346, 459],
  [457, 337],
  [497, 333],
  [506, 323],
  [507, 137],
  [501, 125],
  [456, 119],
  [359, 11],
  [351, 5],
  [169, 4],
  [55, 119],
  [18, 122],
  [8, 127],
];

function sampleOutline(count: number): Array<[number, number]> {
  const segs: Array<{ x0: number; y0: number; x1: number; y1: number; len: number }> = [];
  let total = 0;
  for (let i = 0; i < CORNERS.length; i += 1) {
    const [x0, y0] = CORNERS[i]!;
    const [x1, y1] = CORNERS[(i + 1) % CORNERS.length]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    segs.push({ x0, y0, x1, y1, len });
    total += len;
  }
  const points: Array<[number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    let dist = (i / count) * total;
    for (const seg of segs) {
      if (dist <= seg.len) {
        const t = seg.len ? dist / seg.len : 0;
        points.push([
          (seg.x0 + (seg.x1 - seg.x0) * t) / 512,
          (seg.y0 + (seg.y1 - seg.y0) * t) / 464,
        ]);
        break;
      }
      dist -= seg.len;
    }
  }
  return points;
}

export const PLATE_OUTLINE_POINTS = sampleOutline(64);
