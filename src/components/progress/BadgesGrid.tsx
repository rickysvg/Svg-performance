import type { EarnedBadge } from "@/lib/badges";
import { BadgeMark } from "@/components/progress/BadgeMark";

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
            <BadgeMark badge={badge} />
            <p className="mt-1 font-display text-[10px] uppercase leading-tight tracking-wide">
              {badge.title}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
