import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { LearnThumb } from "@/components/learn/LearnThumb";
import { lessonLevelLabel, lessonTopicLabel } from "@/lib/lessons";
import { catalogEntryForSlug } from "@/lib/learn-catalog";
import { resolveLessonVideo } from "@/lib/lesson-videos";

export function LearnLessonCard({
  lesson,
  bookmarked,
  completed,
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
}) {
  const video = resolveLessonVideo(lesson);
  const catalog = catalogEntryForSlug(lesson.slug);
  const channel = lesson.coachName || catalog?.channel || "YouTube";

  return (
    <li>
      <Link
        href={`/learn/${lesson.slug}`}
        className="block space-y-3 rounded-2xl border border-line bg-card p-4"
      >
        <LearnThumb url={video.url} pending={video.pending} title={lesson.title} compact />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold leading-snug">{lesson.title}</h2>
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
        <p className="line-clamp-4 text-sm leading-snug text-muted">{lesson.technicalDescription}</p>
        <p className="text-xs text-muted">
          YouTube reference — not an SVG-produced video
          {video.pending ? " · pending coach review" : ""}
          {bookmarked ? " · bookmarked" : ""}
          {completed ? " · completed" : ""}
        </p>
      </Link>
    </li>
  );
}
