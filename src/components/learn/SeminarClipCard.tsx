import Image from "next/image";
import Link from "next/link";
import { UpgradePreviewSheet } from "@/components/upgrade/UpgradePreviewSheet";
import { seminarLevelLabel } from "@/lib/learn-seminars";
import { formatTimestamp } from "@/lib/seminar-playback";

type ClipCardModel = {
  id: string;
  technique: string;
  notes: string;
  startSeconds: number;
  slug: string;
  displayTitle: string;
  thumbnailUrl: string;
  instructorNames: string;
  categoryLabel: string;
  level: string;
};

function ClipBody({ clip }: { clip: ClipCardModel }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-video bg-black">
        <Image
          src={clip.thumbnailUrl}
          alt={clip.technique}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 240px"
          className="object-cover"
        />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
          ▸ {formatTimestamp(clip.startSeconds)}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <h2 className="line-clamp-2 text-lg leading-tight">{clip.technique}</h2>
        <p className="line-clamp-2 text-sm text-muted">
          {clip.displayTitle} · {clip.instructorNames}
        </p>
        <p className="line-clamp-2 text-sm text-muted">{clip.notes}</p>
        <p className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-line px-2.5 py-1">
            {seminarLevelLabel(clip.level)}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1">{clip.categoryLabel}</span>
        </p>
      </div>
    </article>
  );
}

export function SeminarClipCard({
  clip,
  locked,
  canStartTrial,
  trialDays,
}: {
  clip: ClipCardModel;
  locked: boolean;
  canStartTrial: boolean;
  trialDays: number;
}) {
  const href = `/learn/seminars/${clip.slug}?clip=${encodeURIComponent(clip.id)}`;
  const body = <ClipBody clip={clip} />;
  if (locked) {
    return (
      <UpgradePreviewSheet
        kind="seminar"
        canStartTrial={canStartTrial}
        trialDays={trialDays}
        next={href}
      >
        {body}
      </UpgradePreviewSheet>
    );
  }
  return (
    <Link data-testid={`learn-link-2-${href.split("/").filter(Boolean).join("-")}`} href={href} className="block">
      {body}
    </Link>
  );
}
