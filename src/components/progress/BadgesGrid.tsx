import type { EarnedBadge } from "@/lib/badges";
import { badgesGroupedByCategory, formatBadgeEarnedOn } from "@/lib/badges";
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
  const groups = badgesGroupedByCategory(badges);
  return (
    <section id="badges" className="space-y-6" data-badge-grid="category">
      {showHeading ? (
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl uppercase tracking-wide">Badges</h2>
          <p className="font-display rounded-full bg-black px-3 py-1 text-sm uppercase tracking-wide text-accent">
            {earned}/{total} earned
          </p>
        </div>
      ) : null}
      {groups.map((group) => (
        <div key={group.category} className="space-y-3">
          <h3 className="font-display flex items-center gap-2 text-lg uppercase tracking-wide">
            {group.label}
            <span className="h-1 w-8 rounded-full bg-accent" aria-hidden />
          </h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6">
            {group.badges.map((badge) => (
              <li key={badge.id} className="text-center">
                <div className="relative mx-auto w-[112px]">
                  <BadgeArt badge={badge} unit={unit} />
                  {badge.earned ? null : (
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
                <p className="font-display mt-2 text-[13px] uppercase leading-tight tracking-wide">
                  {badge.title}
                </p>
                {badge.earned && badge.earnedAt ? (
                  <p className="mt-1 text-xs text-muted">{formatBadgeEarnedOn(badge.earnedAt)}</p>
                ) : (
                  <div className="mt-2 px-2">
                    <div className="h-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${Math.min(100, Math.round((badge.progressCurrent / badge.progressTarget) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{badge.progressLabel}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
