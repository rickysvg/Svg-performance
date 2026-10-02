import { figureForBlock, figureForDrill, type FigureProp, type FigureSpec, type XY } from "@/lib/mobility-poses";

function points(a: XY, b: XY, c: XY) {
  return `${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`;
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 9;
  const x3 = x2 - size * Math.cos(angle - 0.45);
  const y3 = y2 - size * Math.sin(angle - 0.45);
  const x4 = x2 - size * Math.cos(angle + 0.45);
  const y4 = y2 - size * Math.sin(angle + 0.45);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CBF805" strokeWidth={3} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${x3},${y3} ${x4},${y4}`} fill="#CBF805" />
    </g>
  );
}

function Prop({ prop }: { prop: FigureProp }) {
  if (prop.kind === "wall") {
    return (
      <g>
        <rect x={prop.x} y={prop.y} width={10} height={prop.h} rx={2} fill="#2a2a2a" />
        <rect x={prop.x} y={prop.y} width={3} height={prop.h} fill="#CBF805" />
      </g>
    );
  }
  if (prop.kind === "box") {
    return (
      <rect
        x={prop.x}
        y={prop.y}
        width={prop.w}
        height={prop.h}
        rx={4}
        fill="#242424"
        stroke="#CBF805"
        strokeWidth={2}
      />
    );
  }
  if (prop.kind === "bar") {
    return <rect x={prop.x1} y={prop.y - 4} width={prop.x2 - prop.x1} height={8} rx={4} fill="#CBF805" />;
  }
  if (prop.kind === "arc") {
    return (
      <circle
        cx={prop.cx}
        cy={prop.cy}
        r={prop.r}
        fill="none"
        stroke="#CBF805"
        strokeWidth={2.5}
        strokeDasharray="5 4"
      />
    );
  }
  return <Arrow x1={prop.x1} y1={prop.y1} x2={prop.x2} y2={prop.y2} />;
}

function FigureSvg({ spec, title }: { spec: FigureSpec; title: string }) {
  const accent = new Set(spec.accent ?? []);
  const limb = (id: "armL" | "armR" | "legL" | "legR", a: XY, b: XY, c: XY) => (
    <polyline
      points={points(a, b, c)}
      fill="none"
      stroke={accent.has(id) ? "#CBF805" : "#f4f4f4"}
      strokeWidth={accent.has(id) ? 11 : 8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  const order: Array<"armL" | "armR" | "legL" | "legR"> = ["armL", "legL", "armR", "legR"];
  const chains = {
    armL: [spec.shoulder, spec.elbowL, spec.handL] as const,
    armR: [spec.shoulder, spec.elbowR, spec.handR] as const,
    legL: [spec.hip, spec.kneeL, spec.footL] as const,
    legR: [spec.hip, spec.kneeR, spec.footR] as const,
  };

  return (
    <svg viewBox="0 0 240 180" role="img" aria-label={`${title}. ${spec.caption}`} className="h-full w-full">
      <rect width="240" height="180" fill="#101010" />
      <line x1="16" y1="168" x2="224" y2="168" stroke="#CBF805" strokeWidth="3" strokeLinecap="round" />
      {(spec.props ?? []).map((prop, index) => (
        <Prop key={`${prop.kind}-${index}`} prop={prop} />
      ))}
      {order
        .filter((id) => !accent.has(id))
        .map((id) => {
          const [a, b, c] = chains[id];
          return <g key={id}>{limb(id, a, b, c)}</g>;
        })}
      <line
        x1={spec.shoulder[0]}
        y1={spec.shoulder[1]}
        x2={spec.hip[0]}
        y2={spec.hip[1]}
        stroke="#f4f4f4"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {order
        .filter((id) => accent.has(id))
        .map((id) => {
          const [a, b, c] = chains[id];
          return <g key={id}>{limb(id, a, b, c)}</g>;
        })}
      <circle cx={spec.head[0]} cy={spec.head[1]} r={12} fill="#f4f4f4" />
    </svg>
  );
}

export function MobilityFigure({
  blockKey,
  drillId,
  title,
  variant = "thumb",
  mirror = false,
}: {
  blockKey?: string;
  drillId?: string;
  title: string;
  variant?: "thumb" | "hero";
  mirror?: boolean;
}) {
  const spec = blockKey ? figureForBlock(blockKey) : drillId ? figureForDrill(drillId) : null;
  if (!spec) return null;
  const hero = variant === "hero";
  return (
    <figure
      data-mobility-figure={blockKey ?? drillId}
      data-mobility-caption={spec.caption}
      className={
        hero
          ? "w-full overflow-hidden rounded-2xl bg-black"
          : "h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black"
      }
    >
      <div className={hero ? "aspect-[4/3] w-full" : "h-full"} style={mirror ? { transform: "scaleX(-1)" } : undefined}>
        <FigureSvg spec={spec} title={title} />
      </div>
      {hero ? (
        <figcaption className="px-3 pb-3 text-sm leading-snug text-white/80">
          {spec.caption}
          <span className="mt-1 block text-[11px] uppercase tracking-[0.12em] text-highlighter">
            Position demo
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}
