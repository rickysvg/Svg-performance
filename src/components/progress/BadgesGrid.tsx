import type { EarnedBadge } from "@/lib/badges";
import { formatBadgeEarnedOn, laddersGroupedByCategory } from "@/lib/badges";
import { BadgeArt } from "@/components/progress/BadgeArt";
import type { LoadUnit } from "@/lib/units";

export function BadgesGrid({
  badges,
  earned,
  total,
  unit = "lb",
  showHeading = true,
}: {
  badges: EarnedBadge[];
  earned: number;
  total: number;
  unit?: LoadUnit;
  showHeading?: boolean;
}) {
  const groups = laddersGroupedByCategory(badges);
  return (
    <section id="badges" className="space-y-8" data-badge-grid="ladders">
      {showHeading ? (
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl uppercase tracking-wide">Badges</h2>
          <p className="font-display rounded-full bg-black px-3 py-1 text-sm uppercase tracking-wide text-highlighter">
            {earned}/{total} earned
          </p>
        </div>
      ) : null}
      {groups.map((group) => (
        <div key={group.category} className="space-y-4">
          <h3 className="font-display flex items-center gap-2 text-lg uppercase tracking-wide">
            {group.label}
            <span className="h-1 w-8 rounded-full bg-accent" aria-hidden />
          </h3>
          <ul className="space-y-5">
            {group.ladders.map((ladder) => {
              const featured = ladder.featured;
              const gold = featured.tier === "gold" && featured.earned;
              return (
                <li key={ladder.id} className="rounded-2xl border border-line bg-card px-3 py-4" data-ladder={ladder.id}>
                  <div className="flex items-center gap-4">
                    <div
                      className={`relative w-[112px] shrink-0 ${gold ? "badge-rung-gold" : ""}`}
                      data-rung-tier={featured.tier}
                    >
                      <BadgeArt badge={featured} unit={unit} />
                      {featured.earned ? null : (
                        <span className="badge-lock-dot" aria-hidden>
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                            <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
                            <path
                              d="M5 7V5.2a3 3 0 0 1 6 0V7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{ladder.label}</p>
                      <p className="font-display mt-1 text-[17px] uppercase leading-tight tracking-wide">
                        {featured.title}
                      </p>
                      {featured.earned && featured.earnedAt && ladder.allEarned ? (
                        <p className="mt-1 text-xs text-muted">{formatBadgeEarnedOn(featured.earnedAt)}</p>
                      ) : (
                        <div className="mt-2">
                          <div className="h-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full bg-accent"
                              style={{
                                width: `${Math.min(100, Math.round((featured.progressCurrent / featured.progressTarget) * 100))}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-muted">{featured.progressLabel}</p>
                        </div>
                      )}
                      {ladder.earnedRungs.length > 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {ladder.earnedRungs.map((rung) => (
                            <li
                              key={rung.id}
                              title={rung.title}
                              className={`badge-chip ${rung.tier === "gold" ? "badge-rung-gold" : ""}`}
                            >
                              <BadgeArt badge={rung} unit={unit} chip />
                              <span className="sr-only">{rung.title}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
