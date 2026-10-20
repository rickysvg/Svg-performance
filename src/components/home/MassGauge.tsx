import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

/** Circular tach. Same radius on both axes so the arch cannot squash. */
const CX = 140;
const CY = 118;
const R = 100;
const START = 190;
const SWEEP = 200;
export const MASS_DIAL = {
  width: 280,
  height: 148,
  /** Arc ends, where the readout baseline sits. */
  baseline: (CY + R * Math.sin((10 * Math.PI) / 180)) / 148,
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

function sweep(r: number, from: number, to: number) {
  const start = polar(r, from);
  const end = polar(r, to);
  const large = Math.abs(from - to) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** 200° tach arch. The hub is the circle center; the needle rises to the rim. */
export function MassGauge({ gauge, live }: { gauge: MassGaugeScale; live: boolean }) {
  const ticks = Array.from({ length: 21 }, (_, i) => i / 20);
  const angle = START - gauge.t * SWEEP;
  const tip = polar(R - 1, angle);
  const tail = polar(14, angle + 180);
  const goal = gauge.goalT == null ? null : tickEnds(START - gauge.goalT * SWEEP, 14, 8);
  return (
    <svg
      viewBox={`0 0 ${MASS_DIAL.width} ${MASS_DIAL.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <path d={sweep(R, START, START - SWEEP)} fill="none" stroke="rgba(203,248,5,0.45)" strokeWidth="1.6" />
      {live ? <path d={sweep(R, START, angle)} fill="none" stroke="#CBF805" strokeWidth="2.4" /> : null}
      {ticks.map((tick, index) => {
        const major = index % 2 === 0;
        const ends = tickEnds(START - tick * SWEEP, major ? 11 : 6, major ? 7 : 4);
        const passed = live && tick <= gauge.t + 0.001;
        return (
          <line
            key={tick}
            x1={ends.inner.x}
            y1={ends.inner.y}
            x2={ends.outer.x}
            y2={ends.outer.y}
            stroke={passed || major ? "#CBF805" : "rgba(203,248,5,0.8)"}
            strokeWidth={major ? 2.2 : 1.35}
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
          stroke="#f3f4ef"
          strokeWidth="1.8"
        />
      ) : null}
      {live ? (
        <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke="#CBF805" strokeWidth="2.2" strokeLinecap="round" />
      ) : null}
      <circle cx={CX} cy={CY} r="3.2" fill="#07080a" stroke="#CBF805" strokeWidth="1.4" />
    </svg>
  );
}
