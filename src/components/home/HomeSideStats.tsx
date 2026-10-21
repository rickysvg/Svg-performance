import Link from "next/link";
import {
  formatBodyFatDelta,
  type BodyFatReadout,
  type HomeTrainingReadout,
} from "@/lib/home-side-stats";

function fatLabel(bodyFat: BodyFatReadout) {
  if (bodyFat.value == null) {
    return "Body fat not logged. Tap to add. Opens Progress.";
  }
  const value = `${bodyFat.value.toFixed(1)} percent`;
  if (bodyFat.delta == null || bodyFat.direction === "none") {
    return `Body fat ${value}. Opens Progress.`;
  }
  const change =
    bodyFat.direction === "up" ? "up" : bodyFat.direction === "down" ? "down" : "unchanged";
  return `Body fat ${value}, ${change} ${Math.abs(bodyFat.delta).toFixed(1)} from the previous entry. Opens Progress.`;
}

function trainingLabel(training: HomeTrainingReadout) {
  if (training.mode === "fight") {
    if (training.days === 0) return "Fight day. Opens Progress.";
    const unit = training.days === 1 ? "day" : "days";
    return `${training.days} ${unit} to fight. Opens Progress.`;
  }
  const unit = training.days === 1 ? "day" : "days";
  return `Training streak ${training.days} ${unit}. Opens Progress.`;
}

function deltaClass(direction: BodyFatReadout["direction"]) {
  if (direction === "up") return "text-[#FF3B3B]";
  if (direction === "down") return "text-[#CBF805]";
  return "text-white/55";
}

export function HomeSideStats({
  bodyFat,
  training,
}: {
  bodyFat: BodyFatReadout;
  training: HomeTrainingReadout;
}) {
  const fatEmpty = bodyFat.value == null;
  const fight = training.mode === "fight";
  const trainingUnit =
    fight && training.days === 0 ? "today" : training.days === 1 ? "day" : "days";
  const fatDelta =
    fatEmpty ? "Tap to add" : bodyFat.delta == null ? "Logged" : formatBodyFatDelta(bodyFat.delta);

  const labelClass =
    "line-clamp-2 block min-h-[1.35rem] font-telemetry text-[8px] uppercase leading-tight tracking-[0.08em] text-signal";

  return (
    <div className="flex w-full min-w-0 items-stretch" data-home-side-stats>
      <Link
        href={fatEmpty ? "/progress#log-body-fat" : "/progress"}
        data-home-body-fat={fatEmpty ? "empty" : "filled"}
        aria-label={fatLabel(bodyFat)}
        className="min-w-0 flex-1"
      >
        <span className={labelClass}>Body fat</span>
        <span className="mt-0.5 flex items-baseline gap-0.5">
          <span
            className={`font-display text-lg leading-none tracking-normal ${fatEmpty ? "text-white/75" : "text-[#CBF805]"}`}
          >
            {fatEmpty ? "—" : bodyFat.value!.toFixed(1)}
          </span>
          {fatEmpty ? null : (
            <span className="font-telemetry text-[9px] leading-none text-[#CBF805]">%</span>
          )}
        </span>
        <span
          className={`mt-0.5 block font-telemetry text-[8px] uppercase leading-tight tracking-[0.04em] ${
            fatEmpty ? "text-[#CBF805]" : deltaClass(bodyFat.direction)
          }`}
        >
          {fatDelta}
        </span>
      </Link>
      <div className="mx-1.5 w-px shrink-0 self-stretch bg-white/30" aria-hidden />
      <Link
        href="/progress"
        data-home-training={training.mode}
        aria-label={trainingLabel(training)}
        className="min-w-0 flex-1"
      >
        <span className={labelClass}>{fight ? "Days to fight" : "Streak"}</span>
        <span className="mt-0.5 block font-display text-lg leading-none tracking-normal text-[#CBF805]">
          {training.days}
        </span>
        <span className="mt-0.5 block font-telemetry text-[8px] uppercase leading-none tracking-[0.08em] text-white/55">
          {trainingUnit}
        </span>
      </Link>
    </div>
  );
}
