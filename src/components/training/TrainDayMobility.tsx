import Link from "next/link";
import type { MobilityBookend, MobilityLink } from "@/lib/mobility-train";

function EndLink({
  role,
  label,
  item,
  inverted,
}: {
  role: "activate" | "recover";
  label: string;
  item: MobilityLink;
  inverted: boolean;
}) {
  return (
    <Link
      href={`/mobility/${item.id}/play`}
      data-mobility-role={role}
      data-mobility-routine={item.id}
      className={`rounded-2xl border px-3 py-2 ${
        inverted ? "border-white/25 text-white" : "border-line bg-background text-foreground"
      }`}
    >
      <span
        className={`font-display text-[11px] uppercase tracking-[0.12em] ${
          inverted ? "text-highlighter" : "text-accent"
        }`}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-sm leading-tight">{item.title}</span>
      <span className={`mt-0.5 block text-[11px] ${inverted ? "text-white/65" : "text-muted"}`}>
        {item.hint}
      </span>
    </Link>
  );
}

export function TrainDayMobility({
  bookend,
  inverted = false,
}: {
  bookend: MobilityBookend;
  inverted?: boolean;
}) {
  return (
    <div data-train-mobility className="mt-3 grid grid-cols-2 gap-2">
      <EndLink role="activate" label="Activate" item={bookend.activate} inverted={inverted} />
      <EndLink role="recover" label="Recover" item={bookend.recover} inverted={inverted} />
    </div>
  );
}
