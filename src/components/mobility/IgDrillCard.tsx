import type { IgDrill } from "@/lib/ig-drills";
import { MobilityFigure } from "@/components/mobility/MobilityFigure";

export function IgDrillCard({ drill }: { drill: IgDrill }) {
  return (
    <li className="rounded-[1.5rem] border border-line bg-card px-4 py-4">
      <div className="flex items-start gap-3">
        <MobilityFigure drillId={drill.id} title={drill.title} />
        <div className="min-w-0">
          <p className="font-display text-xs uppercase tracking-wide text-accent">{drill.place}</p>
          <h3 className="mt-1 text-xl">{drill.title}</h3>
          <p className="mt-1 text-sm font-semibold">{drill.prescription}</p>
          <p className="mt-2 text-sm">{drill.cues}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Idea seen in a post by {drill.credit.handle}.{" "}
        <a href={drill.credit.url} className="text-accent underline" target="_blank" rel="noreferrer">
          Their post
        </a>
        .
      </p>
    </li>
  );
}
