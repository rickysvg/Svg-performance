import { exerciseCountLabel } from "@/lib/exercise-media";

function MetaIcon({ kind }: { kind: "kind" | "time" | "count" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4 shrink-0",
    "aria-hidden": true,
  };
  if (kind === "time") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }
  if (kind === "count") {
    return (
      <svg {...common}>
        <path d="M7 10v4M17 10v4M4 9v6M20 9v6M7 12h10" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 5v10M8 11l4 4 4-4" />
    </svg>
  );
}

export function DaySessionMeta({
  kind,
  minutes,
  exerciseCount,
}: {
  kind: string;
  minutes: number;
  exerciseCount: number;
}) {
  const rows = [
    { icon: "kind" as const, label: kind },
    { icon: "time" as const, label: minutes > 0 ? `est. ${minutes} min` : "est. —" },
    { icon: "count" as const, label: exerciseCountLabel(exerciseCount) },
  ];

  return (
    <ul className="space-y-2.5 text-sm text-muted">
      {rows.map((row) => (
        <li key={row.icon} className="flex items-center gap-2.5">
          <MetaIcon kind={row.icon} />
          <span>{row.label}</span>
        </li>
      ))}
    </ul>
  );
}
