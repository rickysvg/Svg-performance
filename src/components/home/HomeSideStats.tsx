import Link from "next/link";
import {
  formatBodyFatDelta,
  type BodyFatReadout,
  type HomeTrainingReadout,
} from "@/lib/home-side-stats";

const chip =
  "touch-target flex min-h-11 w-[6.35rem] min-w-0 shrink-0 flex-col justify-center rounded-md border border-white/10 bg-black/70 px-1.5 py-1 leading-none";

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

  return (
    <div className="flex shrink-0 flex-col gap-1" data-home-side-stats>
      <Link
        href={fatEmpty ? "/progress#log-body-fat" : "/progress"}
        data-home-body-fat={fatEmpty ? "empty" : "filled"}
        aria-label={fatLabel(bodyFat)}
        className={chip}
      >
        <span className="block max-w-full font-telemetry text-[9px] uppercase leading-tight tracking-[0.12em] text-white/60">
          Body fat
        </span>
        <span
          className={`mt-1 block max-w-full font-telemetry text-lg leading-none ${fatEmpty ? "text-white/80" : "text-[#CBF805]"}`}
        >
          {fatEmpty ? (
            "—"
          ) : (
            <>
              {bodyFat.value!.toFixed(1)}
              <span className="ml-0.5 text-[10px] tracking-normal">%</span>
            </>
          )}
        </span>
        <span
          className={`mt-1 block max-w-full whitespace-normal font-telemetry text-[9px] uppercase leading-tight tracking-[0.04em] ${
            fatEmpty ? "text-[#CBF805]" : deltaClass(bodyFat.direction)
          }`}
        >
          {fatEmpty ? "Tap to add" : bodyFat.delta == null ? "Logged" : formatBodyFatDelta(bodyFat.delta)}
        </span>
      </Link>
      <Link
        href="/progress"
        data-home-training={training.mode}
        aria-label={trainingLabel(training)}
        className={chip}
      >
        <span className="block max-w-full whitespace-normal font-telemetry text-[9px] uppercase leading-tight tracking-[0.08em] text-white/60">
          {fight ? "Days to fight" : "Streak"}
        </span>
        <span className="mt-1 block font-telemetry text-lg leading-none text-[#CBF805]">{training.days}</span>
        <span className="mt-1 block font-telemetry text-[9px] uppercase leading-none tracking-[0.06em] text-white/55">
          {trainingUnit}
        </span>
      </Link>
    </div>
  );
}
