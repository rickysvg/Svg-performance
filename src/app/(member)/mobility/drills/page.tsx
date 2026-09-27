import Link from "next/link";
import { IG_DRILL_DISCLAIMER, IG_DRILL_GROUPS, igDrillsInGroup } from "@/lib/ig-drills";

export default function MobilityDrillsPage() {
  return (
    <main className="space-y-6">
      <Link href="/mobility" className="text-sm font-semibold text-accent">
        Mobility
      </Link>
      <div>
        <p className="font-display text-xs uppercase tracking-[0.12em] text-accent">Drill ideas</p>
        <h1 className="mt-1 text-3xl">Hips, kicks, and add-ons</h1>
        <p className="mt-2 text-sm text-muted">
          Do the hip pieces before you chase kick height.
        </p>
        <p className="mt-3 text-sm text-muted">{IG_DRILL_DISCLAIMER}</p>
      </div>
      {IG_DRILL_GROUPS.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="text-lg">{group.title}</h2>
            <p className="text-sm text-muted">{group.blurb}</p>
          </div>
          <ul className="space-y-3">
            {igDrillsInGroup(group.id).map((drill) => (
              <li key={drill.id} className="rounded-[1.5rem] border border-line bg-card px-4 py-4">
                <p className="font-display text-xs uppercase tracking-wide text-accent">{drill.place}</p>
                <h3 className="mt-1 text-xl">{drill.title}</h3>
                <p className="mt-1 text-sm font-semibold">{drill.prescription}</p>
                <p className="mt-2 text-sm">{drill.cues}</p>
                <p className="mt-3 text-xs text-muted">
                  Idea seen in a post by {drill.credit.handle}.{" "}
                  <a
                    href={drill.credit.url}
                    className="text-accent underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Their post
                  </a>
                  .
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
