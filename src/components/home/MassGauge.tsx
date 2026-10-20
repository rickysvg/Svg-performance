import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

const CX = 100;
const CY = 86;
const R = 72;
const START = 206;
const SWEEP = 232;

function polar(radius: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY - radius * Math.sin(a) };
}

function arc(from: number, to: number) {
  const start = polar(R, from);
  const end = polar(R, to);
  const large = Math.abs(from - to) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function MassGauge({
  gauge,
  variant,
  live,
}: {
  gauge: MassGaugeScale;
  variant: 1 | 2;
  live: boolean;
}) {
  const ticks = Array.from({ length: 17 }, (_, i) => i / 16);
  const angle = START - gauge.t * SWEEP;
  const tip = polar(R - 1, angle);
  const hub = polar(22, angle);
  return (
    <svg
      viewBox="0 6 200 62"
      className="pointer-events-none absolute inset-x-0 top-0 h-14 w-full"
      aria-hidden
    >
      {variant === 1 ? (
        <>
          <path d={arc(START, START - SWEEP)} fill="none" stroke="rgba(203,248,5,0.16)" strokeWidth="4" strokeLinecap="butt" />
          {live && gauge.t > 0.01 ? (
            <path d={arc(START, angle)} fill="none" stroke="#CBF805" strokeWidth="4" strokeLinecap="butt" />
          ) : null}
        </>
      ) : null}
      {ticks.map((tick) => {
        const deg = START - tick * SWEEP;
        const outer = polar(R + 1, deg);
        const inner = polar(tick % 2 === 0 ? R - 7 : R - 4, deg);
        const passed = live && tick <= gauge.t + 0.001;
        return (
          <line
            key={tick}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={passed ? "#CBF805" : "rgba(203,248,5,0.28)"}
            strokeWidth={tick % 4 === 0 ? 1.6 : 1}
          />
        );
      })}
      {gauge.goalT != null ? (
        <line
          x1={polar(R - 11, START - gauge.goalT * SWEEP).x}
          y1={polar(R - 11, START - gauge.goalT * SWEEP).y}
          x2={polar(R + 3, START - gauge.goalT * SWEEP).x}
          y2={polar(R + 3, START - gauge.goalT * SWEEP).y}
          stroke="#f3f4ef"
          strokeWidth="1.4"
        />
      ) : null}
      {live ? (
        <line x1={hub.x} y1={hub.y} x2={tip.x} y2={tip.y} stroke="#CBF805" strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

const SEGMENT: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abcgd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgecd",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
};

export function Digit({ char, ghost }: { char: string; ghost?: boolean }) {
  if (char === ".") {
    return (
      <svg viewBox="0 0 8 32" className="h-8 w-2" aria-hidden>
        <circle cx="4" cy="28" r="2" className={ghost ? "mass-seg-off" : "mass-seg-on"} />
      </svg>
    );
  }
  const on = ghost ? "" : (SEGMENT[char] ?? "");
  const seg = (id: string, d: string) => (
    <path key={id} d={d} className={on.includes(id) ? "mass-seg-on" : "mass-seg-off"} />
  );
  return (
    <svg viewBox="0 0 20 32" className="h-8 w-[1.15rem]" aria-hidden>
      {seg("a", "M4 1 H16 L14 3.2 H6 Z")}
      {seg("b", "M17 4 L19 6 V14 L17 15.2 L15 14 V6 Z")}
      {seg("c", "M17 16.8 L19 18 V26 L17 28 L15 26 V18 Z")}
      {seg("d", "M4 31 H16 L14 28.8 H6 Z")}
      {seg("e", "M3 16.8 L5 18 V26 L3 28 L1 26 V18 Z")}
      {seg("f", "M3 4 L5 6 V14 L3 15.2 L1 14 V6 Z")}
      {seg("g", "M4 14.4 H16 L14.2 16 H5.8 Z")}
    </svg>
  );
}

export function segmentGlyphs(raw: string) {
  const text = raw.trim();
  if (!text) return "----".split("").map((char) => ({ char, ghost: true }));
  return text
    .slice(0, 6)
    .split("")
    .map((char) => ({ char, ghost: false }));
}
