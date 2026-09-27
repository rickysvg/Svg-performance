import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getCompanionProgress } from "@/lib/progress-companion";
import { featuredBadges } from "@/lib/badges";
import { BADGE_STYLES } from "@/lib/badge-style";
import { BadgeMark } from "@/components/progress/BadgeMark";
import { COMPARE_BADGE_IDS, styleCaption } from "@/components/progress/badge-visuals";

export default async function BadgePreviewPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const units = profile?.preferredUnits ?? "lb";
  const companion = await getCompanionProgress(user.id, units);
  const featured = featuredBadges(companion.badges);
  const picks = COMPARE_BADGE_IDS.map((id) => featured.find((row) => row.id === id)).filter(
    (row): row is NonNullable<typeof row> => Boolean(row),
  );

  return (
    <main id="badge-compare" className="space-y-4">
      <div>
        <h1 className="text-xl">Badge options</h1>
        <p className="mt-1 text-sm text-muted">
          Three earned, one locked. Same marks in medal, belt, and hex.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {BADGE_STYLES.map((style) => (
          <section key={style} className="text-center">
            <h2 className="mb-2 text-sm">{styleCaption(style)}</h2>
            <ul className="space-y-3">
              {picks.map((badge) => (
                <li key={`${style}-${badge.id}`}>
                  <BadgeMark badge={badge} style={style} />
                  <p className="mt-1 font-display text-[9px] uppercase leading-tight tracking-wide">
                    {badge.title}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
