import Image from "next/image";
import Link from "next/link";
import { UpgradePreviewSheet } from "@/components/upgrade/UpgradePreviewSheet";
import { instructorNames, seminarLevelLabel, type Seminar } from "@/lib/learn-seminars";

function PlayMark() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-black shadow">
        <svg viewBox="0 0 12 12" className="ml-0.5 h-4 w-4" aria-hidden>
          <path d="M3 2.2v7.6L10 6z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

function LockBadge() {
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] text-highlighter">
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
        <rect
          x="3.5"
          y="7"
          width="9"
          height="6.5"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      Locked
    </span>
  );
}

export function SeminarCardBody({
  seminar,
  locked,
}: {
  seminar: Seminar;
  locked: boolean;
}) {
  const clips = seminar.clips.length;

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-video bg-black">
        <Image
          src={seminar.thumbnailUrl}
          alt={seminar.displayTitle}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 240px"
          className="object-cover"
        />
        <PlayMark />
        {seminar.priority ? (
          <span className="absolute left-2 top-2 rounded bg-black px-2 py-1 text-[11px] text-highlighter">
            ★ BANGTAO
          </span>
        ) : null}
        {locked ? <LockBadge /> : null}
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
          {seminar.duration}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <h2 className="line-clamp-2 text-lg leading-tight">{seminar.displayTitle}</h2>
        <p className="text-sm font-semibold">{instructorNames(seminar)}</p>
        <p className="line-clamp-1 text-sm text-muted">{seminar.credentialLine}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-line px-2.5 py-1">
            {seminarLevelLabel(seminar.level)}
          </span>
          <span className="rounded-full border border-line px-2.5 py-1">{seminar.categoryLabel}</span>
          {clips > 0 ? (
            <span className="text-muted">
              {clips} {clips === 1 ? "clip" : "clips"}
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

export function SeminarCard({
  seminar,
  locked,
  canStartTrial,
  trialDays,
}: {
  seminar: Seminar;
  locked: boolean;
  canStartTrial: boolean;
  trialDays: number;
}) {
  const body = <SeminarCardBody seminar={seminar} locked={locked} />;
  if (locked) {
    return (
      <UpgradePreviewSheet
        kind="seminar"
        canStartTrial={canStartTrial}
        trialDays={trialDays}
        next={`/learn/seminars/${seminar.slug}`}
      >
        {body}
      </UpgradePreviewSheet>
    );
  }
  return (
    <Link data-testid={`learn-seminars-${seminar.slug}`} href={`/learn/seminars/${seminar.slug}`} className="block">
      {body}
    </Link>
  );
}
