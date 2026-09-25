import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { LearnThumb } from "@/components/learn/LearnThumb";
import { UpgradePreviewSheet } from "@/components/upgrade/UpgradePreviewSheet";
import { lessonLevelLabel, lessonTopicLabel } from "@/lib/lessons";
import { catalogEntryForSlug } from "@/lib/learn-catalog";
import { resolveLessonVideo } from "@/lib/lesson-videos";

function LessonBody({
  lesson,
  bookmarked,
  completed,
  locked,
}: {
  lesson: {
    slug: string;
    title: string;
    summary: string;
    technicalDescription: string;
    topic: string;
    skillLevel: string;
    coachName: string;
    youtubeUrl: string;
    videoPending: boolean;
    isDemo: boolean;
  };
  bookmarked?: boolean;
  completed?: boolean;
  locked?: boolean;
}) {
  const video = resolveLessonVideo(lesson);
  const catalog = catalogEntryForSlug(lesson.slug);
  const channel = lesson.coachName || catalog?.channel || "YouTube";

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div className="relative">
        <LearnThumb url={video.url} pending={video.pending} title={lesson.title} compact />
        {locked ? (
          <span className="absolute right-2 top-2 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-accent">
            Locked
          </span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className=" leading-snug">{lesson.title}</h2>
          <p className="mt-1 text-sm text-muted">{channel}</p>
        </div>
        {lesson.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-line px-2.5 py-1 text-muted">
          {lessonTopicLabel(lesson.topic)}
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-muted">
          {lessonLevelLabel(lesson.skillLevel)}
        </span>
      </p>
      <p className="text-sm leading-snug text-foreground">{lesson.summary}</p>
      {!locked ? (
        <p className="line-clamp-4 text-sm leading-snug text-muted">{lesson.technicalDescription}</p>
      ) : (
        <p className="text-sm text-muted">
          Preview only on the free plan. Start a trial or upgrade to watch.
        </p>
      )}
      <p className="text-xs text-muted">
        YouTube reference — not an SVG-produced video
        {video.pending ? " · pending coach review" : ""}
        {bookmarked ? " · bookmarked" : ""}
        {completed ? " · completed" : ""}
      </p>
    </div>
  );
}

export function LearnLessonCard({
  lesson,
  bookmarked,
  completed,
  locked,
  canStartTrial,
  trialDays,
}: {
  lesson: {
    slug: string;
    title: string;
    summary: string;
    technicalDescription: string;
    topic: string;
    skillLevel: string;
    coachName: string;
    youtubeUrl: string;
    videoPending: boolean;
    isDemo: boolean;
  };
  bookmarked?: boolean;
  completed?: boolean;
  locked?: boolean;
  canStartTrial?: boolean;
  trialDays?: number;
}) {
  const body = (
    <LessonBody lesson={lesson} bookmarked={bookmarked} completed={completed} locked={locked} />
  );

  if (locked) {
    return (
      <li>
        <UpgradePreviewSheet
          kind="tutorial"
          canStartTrial={Boolean(canStartTrial)}
          trialDays={trialDays ?? 7}
          next="/learn"
        >
          {body}
        </UpgradePreviewSheet>
      </li>
    );
  }

  return (
    <li>
      <Link href={`/learn/${lesson.slug}`} className="block">
        {body}
      </Link>
    </li>
  );
}
