import { streakStatusLine, type TrainingStreak } from "@/lib/streaks";

export function StreakHero({ streak }: { streak: TrainingStreak }) {
  return (
    <section className="hc-panel hc-carbon px-4 py-5">
      <div className="flex items-stretch gap-4">
        <div className="min-w-[7.5rem] border-r border-[#cbf805]/30 pr-4">
          <p className="font-telemetry text-6xl leading-none tracking-tight text-[#CBF805]">{streak.current}</p>
          <p className="font-display mt-1 text-sm uppercase tracking-wide">Day streak</p>
        </div>
        <div className="flex-1">
          <ol className="flex justify-between gap-1">
            {streak.weekDots.map((dot) => (
              <li key={dot.key} className="flex flex-col items-center gap-1">
                <span
                    className={`flex h-6 w-6 items-center justify-center border text-[11px] leading-none ${
                    dot.completed
                      ? "border-[#CBF805] bg-[#CBF805] text-black"
                      : "border-[#cbf805]/40 bg-transparent text-muted"
                  }`}
                  aria-label={`${dot.weekday}${dot.completed ? " complete" : dot.scheduled ? " scheduled" : " rest"}`}
                >
                  {dot.completed ? (
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                      <path
                        d="M2 6.2 4.6 9 10 3"
                        fill="none"
                        stroke="#14180a"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="font-telemetry text-[10px] uppercase tracking-wide text-muted">{dot.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm leading-snug">
            Best streak: {streak.longest} {streak.longest === 1 ? "day" : "days"} · {streakStatusLine(streak)}
          </p>
        </div>
      </div>
    </section>
  );
}
