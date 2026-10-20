import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

const CX = 150;
const CY = 40;
const RX = 78;
const RY = 8;
const START = 206;
const SWEEP = 232;

function polar(rx: number, ry: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + rx * Math.cos(a), y: CY - ry * Math.sin(a) };
}

function tickEnds(deg: number, inward: number, outward: number) {
  const rim = polar(RX, RY, deg);
  const a = (deg * Math.PI) / 180;
  const dx = RX * Math.cos(a);
  const dy = -RY * Math.sin(a);
  const len = Math.hypot(dx, dy) || 1;
  return {
    inner: { x: rim.x - (dx / len) * inward, y: rim.y - (dy / len) * inward },
    outer: { x: rim.x + (dx / len) * outward, y: rim.y + (dy / len) * outward },
  };
}

function sweep(rx: number, ry: number, from: number, to: number) {
  const start = polar(rx, ry, from);
  const end = polar(rx, ry, to);
  const large = Math.abs(from - to) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${rx} ${ry} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Wide tick sweep. The hub is the center of the readout, so the needle crosses the digits. */
export function MassGauge({ gauge, live }: { gauge: MassGaugeScale; live: boolean }) {
  const ticks = Array.from({ length: 21 }, (_, i) => i / 20);
  const angle = START - gauge.t * SWEEP;
  const tip = polar(RX + 1, RY + 1, angle);
  const tail = polar(72, 13, angle + 180);
  const passedTo = START - gauge.t * SWEEP;
  const goal = gauge.goalT == null ? null : tickEnds(START - gauge.goalT * SWEEP, 11, 8);
  return (
    <svg viewBox="0 0 300 80" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path d={sweep(RX, RY, START, START - SWEEP)} fill="none" stroke="rgba(203,248,5,0.55)" strokeWidth="1.7" />
      {live ? (
        <path d={sweep(RX, RY, START, passedTo)} fill="none" stroke="#CBF805" strokeWidth="2.2" />
      ) : null}
      {ticks.map((tick) => {
        const deg = START - tick * SWEEP;
        const ends = tickEnds(deg, tick % 2 === 0 ? 9 : 5.5, tick % 5 === 0 ? 7 : 4.5);
        const outer = ends.outer;
        const inner = ends.inner;
        const passed = live && tick <= gauge.t + 0.001;
        return (
          <line
            key={tick}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={passed ? "#CBF805" : "rgba(203,248,5,0.72)"}
            strokeWidth={tick % 5 === 0 ? 2.1 : 1.35}
            strokeLinecap="round"
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
    </svg>
  );
}
