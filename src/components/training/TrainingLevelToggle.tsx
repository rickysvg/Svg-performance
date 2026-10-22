"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ScaleBand } from "@/lib/training-scale";

const LEVELS: { id: ScaleBand; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export function TrainingLevelToggle({
  band,
  dayParam,
  fromProfile,
  basePath = "/training",
}: {
  band: ScaleBand;
  dayParam: string;
  fromProfile: boolean;
  basePath?: string;
}) {
  const search = useSearchParams();
  const day = search.get("day") || dayParam;
  return (
    <section
      data-level-toggle
      className="rounded-2xl border border-line bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-xs uppercase tracking-wide text-accent">Training level</p>
        <p className="text-xs text-muted">
          {fromProfile
            ? "From your profile — tap to preview another level"
            : "No level on your profile yet — default Intermediate"}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {LEVELS.map((level) => {
          const active = level.id === band;
          const href = `${basePath}?day=${day}&level=${level.id}`;
          return (
            <Link
              data-testid={`training-link-3-${level.id}`}
              key={level.id}
              href={href}
              className={`rounded-full px-2 py-2 text-center text-sm font-semibold ${
                active
                  ? "bg-accent text-black"
                  : "border border-line bg-white text-foreground"
              }`}
            >
              {level.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
