import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

/**
 * Circular crown sized to the Orbitron figure, not the unit.
 * The arc line clears the ink, and ticks point only outward.
 */
const CLEAR = 14;
const DIGIT_HALF = 72;
const INK_RISE = 30;
const TICK = 4.5;
const STROKE = 2;
const PAD = 6;
const HALF = DIGIT_HALF + CLEAR;
const RISE = INK_RISE + CLEAR;
const DROP = (HALF * HALF - RISE * RISE) / (2 * RISE);
const R = DROP + RISE;
const CX = PAD + STROKE + TICK + HALF;
const BASELINE = PAD + STROKE + TICK + RISE;
const CY = BASELINE + DROP;
const ALPHA = (Math.acos(DROP / R) * 180) / Math.PI;
const START = 90 + ALPHA;
const SWEEP = ALPHA * 2;

export const MASS_DIAL = {
  width: CX + HALF + TICK + STROKE + PAD,
  height: BASELINE + PAD,
  baseline: BASELINE / (BASELINE + PAD),
};

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function outwardTick(deg: number, length: number) {
  const rim = polar(R + STROKE, deg);
  const a = (deg * Math.PI) / 180;
  return {
    x1: round2(rim.x),
    y1: round2(rim.y),
    x2: round2(rim.x + Math.cos(a) * length),
    y2: round2(rim.y - Math.sin(a) * length),
  };
}

function arcPath() {
  const r = R + STROKE / 2;
  const start = polar(r, START);
  const end = polar(r, START - SWEEP);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** One white arch over the figure. Ticks sit on the outside of the line. */
export function MassGauge({ gauge }: { gauge: MassGaugeScale; live: boolean }) {
  const ticks = Array.from({ length: 11 }, (_, index) => START - (index / 10) * SWEEP);
  const goal = gauge.goalT == null ? null : outwardTick(START - gauge.goalT * SWEEP, TICK + 3);
  return (
    <svg
      viewBox={`0 0 ${MASS_DIAL.width} ${MASS_DIAL.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <path d={arcPath()} fill="none" stroke="#ffffff" strokeWidth={STROKE} strokeLinecap="round" />
      {ticks.map((deg) => {
        const tick = outwardTick(deg, TICK);
        return (
          <line
            key={deg}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#ffffff"
            strokeWidth="1.35"
            strokeLinecap="butt"
          />
        );
      })}
      {goal ? (
        <line x1={goal.x1} y1={goal.y1} x2={goal.x2} y2={goal.y2} stroke="#CBF805" strokeWidth="1.6" />
      ) : null}
    </svg>
  );
}
