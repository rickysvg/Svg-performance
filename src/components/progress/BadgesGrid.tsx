import type { EarnedBadge } from "@/lib/badges";
import { BadgeIcon } from "@/components/progress/BadgeIcon";

export function BadgesGrid({
  badges,
  earned,
  total,
}: {
  badges: EarnedBadge[];
  earned: number;
  total: number;
}) {
  return (
    <section id="badges" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg">Badges</h2>
        <p className="text-sm text-muted">
          {earned} of {total} earned
        </p>
      </div>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-5">
        {badges.map((badge) => (
          <li key={badge.id} className="text-center">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                badge.earned ? "bg-black" : "bg-card"
              }`}
            >
              <BadgeIcon icon={badge.earned ? badge.icon : "lock"} earned={badge.earned} />
            </div>
            <p className="mt-2 font-display text-[10px] uppercase leading-tight tracking-wide">
              {badge.title}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
