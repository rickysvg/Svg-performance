import type { TrainingStreak } from "@/lib/streaks";

export function StreakHero({ streak }: { streak: TrainingStreak }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-accent px-4 py-5 text-black">
      <div className="flex items-stretch gap-4">
        <div className="min-w-[7.5rem] border-r border-black/20 pr-4">
          <p className="font-display text-6xl leading-none tracking-tight">{streak.current}</p>
          <p className="font-display mt-1 text-sm uppercase tracking-wide">Day streak</p>
        </div>
        <div className="flex-1">
          <ol className="flex justify-between gap-1">
            {streak.weekDots.map((dot) => (
              <li key={dot.key} className="flex flex-col items-center gap-1">
                <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] leading-none ${
                    dot.completed
                      ? "border-black bg-black text-[#CBF805]"
                      : "border-black/50 bg-transparent text-black"
                  }`}
                  aria-label={`${dot.weekday}${dot.completed ? " complete" : dot.scheduled ? " scheduled" : " rest"}`}
                >
                  {dot.completed ? (
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                      <path
                        d="M2 6.2 4.6 9 10 3"
                        fill="none"
                        stroke="#CBF805"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="font-display text-[10px] uppercase tracking-wide">{dot.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm leading-snug">
            Best streak: {streak.longest} days
            {streak.daysToNext > 0
              ? ` · train today to make it ${streak.current + 1}`
              : " · target hit"}
          </p>
        </div>
      </div>
    </section>
  );
}
