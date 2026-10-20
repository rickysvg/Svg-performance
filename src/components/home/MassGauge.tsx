import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

/** Snug circular crown. Radius is equal on both axes so the arch cannot squash. */
const R = 146;
const SAGITTA = 36;
const HALF = 96;
const PAD = 8;
const CX = PAD + HALF;
const CROWN = 8;
const CY = CROWN + R;
const ALPHA = Math.acos((R - SAGITTA) / R);
const START = 90 + (ALPHA * 180) / Math.PI;
const SWEEP = ((ALPHA * 180) / Math.PI) * 2;
const BASELINE = CY - (R - SAGITTA);

export const MASS_DIAL = {
  width: PAD + HALF * 2 + PAD,
  height: BASELINE + PAD,
  baseline: BASELINE / (BASELINE + PAD),
};

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

function tickEnds(deg: number, inward: number, outward: number) {
  const rim = polar(R, deg);
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  return {
    inner: { x: rim.x - dx * inward, y: rim.y - dy * inward },
    outer: { x: rim.x + dx * outward, y: rim.y + dy * outward },
  };
}

/** Short arc over the top. Sweep flag 0 takes the minor path through the crown. */
function sweep(r: number, from: number, to: number) {
  const start = polar(r, from);
  const end = polar(r, to);
  const large = Math.abs(from - to) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** White crown sized to the readout. No needle. */
export function MassGauge({ gauge, live }: { gauge: MassGaugeScale; live: boolean }) {
  const ticks = Array.from({ length: 13 }, (_, i) => i / 12);
  const angle = START - gauge.t * SWEEP;
  const goal = gauge.goalT == null ? null : tickEnds(START - gauge.goalT * SWEEP, 8, 5);
  return (
    <svg
      viewBox={`0 0 ${MASS_DIAL.width} ${MASS_DIAL.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <path d={sweep(R, START, START - SWEEP)} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="1.6" />
      {live ? <path d={sweep(R, START, angle)} fill="none" stroke="#ffffff" strokeWidth="2.2" /> : null}
      {ticks.map((tick, index) => {
        const major = index % 2 === 0;
        const ends = tickEnds(START - tick * SWEEP, major ? 6 : 3.5, major ? 5 : 3);
        const passed = live && tick <= gauge.t + 0.001;
        return (
          <line
            key={tick}
            x1={ends.inner.x}
            y1={ends.inner.y}
            x2={ends.outer.x}
            y2={ends.outer.y}
            stroke={passed || major ? "#ffffff" : "rgba(255,255,255,0.78)"}
            strokeWidth={major ? 2 : 1.25}
            strokeLinecap="butt"
          />
        );
      })}
      {goal ? (
        <line
          x1={goal.inner.x}
          y1={goal.inner.y}
          x2={goal.outer.x}
          y2={goal.outer.y}
          stroke="#CBF805"
          strokeWidth="1.8"
        />
      ) : null}
    </svg>
  );
}
