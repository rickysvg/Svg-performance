import { EQUIPMENT_CHIPS, type EquipmentId } from "@/lib/exercise-media";

function Icon({ id }: { id: EquipmentId }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6",
    "aria-hidden": true,
  };

  switch (id) {
    case "barbell":
      return (
        <svg {...common}>
          <path d="M4 12h16M3 9v6M6 8v8M18 8v8M21 9v6" />
        </svg>
      );
    case "bench":
      return (
        <svg {...common}>
          <path d="M4 14h16M6 14v4M18 14v4M5 10h10l4 4" />
        </svg>
      );
    case "cable":
      return (
        <svg {...common}>
          <path d="M8 4h8M12 4v6M7 14h10M8 20h8M9 14l-2 6M15 14l2 6" />
        </svg>
      );
    case "dumbbell":
      return (
        <svg {...common}>
          <path d="M7 10v4M17 10v4M4 9v6M20 9v6M7 12h10" />
        </svg>
      );
    case "machine":
      return (
        <svg {...common}>
          <rect x="6" y="4" width="12" height="16" rx="1.5" />
          <path d="M9 9h6M9 13h6" />
        </svg>
      );
    case "kettlebell":
      return (
        <svg {...common}>
          <path d="M9 8a3 3 0 0 1 6 0" />
          <circle cx="12" cy="15" r="5" />
        </svg>
      );
    case "band":
      return (
        <svg {...common}>
          <path d="M5 12c3-6 11-6 14 0M5 12c3 6 11 6 14 0" />
        </svg>
      );
    case "pull-up":
      return (
        <svg {...common}>
          <path d="M4 6h16M8 6v5l4 3 4-3V6" />
        </svg>
      );
    case "jump-rope":
      return (
        <svg {...common}>
          <path d="M7 18c0-8 10-8 10 0M7 18H5M17 18h2" />
        </svg>
      );
    case "bike":
      return (
        <svg {...common}>
          <circle cx="7" cy="16" r="3" />
          <circle cx="17" cy="16" r="3" />
          <path d="M7 16l5-8h4l1 8M12 8l-2 4h6" />
        </svg>
      );
    case "sled":
      return (
        <svg {...common}>
          <path d="M4 17h16M6 17V9h10l2 4H8" />
          <path d="M8 17v3M16 17v3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="3" />
          <path d="M7 20c0-3 2.2-5 5-5s5 2 5 5" />
        </svg>
      );
  }
}

export function EquipmentRow({
  chips,
}: {
  chips: { id: EquipmentId; label: string }[];
}) {
  if (chips.length === 0) return null;

  return (
    <section>
      <p className="text-sm font-medium text-foreground">Equipment</p>
      <ul className="mt-4 flex gap-5 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <li key={chip.id} className="flex w-16 shrink-0 flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-foreground">
              <Icon id={chip.id} />
            </span>
            <span className="text-center text-[11px] leading-tight text-muted">
              {EQUIPMENT_CHIPS[chip.id]?.label ?? chip.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
