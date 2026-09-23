import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { DemoBadge } from "@/components/DemoBadge";
import { LearnThumb } from "@/components/learn/LearnThumb";
import {
  getLessonProgress,
  getPublishedLessonBySlug,
  lessonLevelLabel,
  lessonTopicLabel,
} from "@/lib/lessons";
import { catalogEntryForSlug } from "@/lib/learn-catalog";
import { parseLessonKeyDetails, resolveLessonVideo } from "@/lib/lesson-videos";
import { toggleBookmarkAction, toggleCompleteAction } from "@/app/actions/lessons";
import { canUseFeature } from "@/lib/entitlements";
import { PaywallNotice } from "@/components/PaywallNotice";
import { WatchForm } from "@/components/training/WatchForm";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  let lesson;
  try {
    lesson = await getPublishedLessonBySlug(slug);
  } catch {
    notFound();
  }
  const progress = await getLessonProgress(user.id, lesson.id);
  const fullLibrary = await canUseFeature(user.id, "learn_full");
  if (!fullLibrary && lesson.skillLevel !== "beginner") {
    return <PaywallNotice feature="Full Learn library" />;
  }
  const video = resolveLessonVideo(lesson);
  const catalog = catalogEntryForSlug(lesson.slug);
  const keyDetails = parseLessonKeyDetails(lesson.keyDetails);
  const channel = lesson.coachName || catalog?.channel || "YouTube";

  return (
    <main className="space-y-8">
      <Link href="/learn" className="text-sm text-muted hover:text-foreground">
        Back to Learn
      </Link>

      <LearnThumb url={video.url} pending={video.pending} title={lesson.title} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{lesson.title}</h1>
          <p className="mt-2 text-sm text-muted">{channel}</p>
          {catalog?.youtubeTitle ? (
            <p className="mt-1 text-sm text-muted">{catalog.youtubeTitle}</p>
          ) : null}
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

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted">Summary</h2>
        <p className="text-base leading-relaxed">{lesson.summary}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted">Technical description</h2>
        {lesson.technicalDescription.trim() ? (
          <p className="text-sm leading-relaxed text-muted">{lesson.technicalDescription}</p>
        ) : (
          <p className="text-sm text-muted">Technical write-up pending coach review.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-wide text-muted">YouTube reference</h2>
        <p className="text-sm text-muted">
          External technique video. Not an SVG-produced film and not a paid course library.
        </p>
        <WatchForm
          url={video.url}
          pending={video.pending}
          actionLabel="Watch on YouTube"
          caption="YouTube reference — not an SVG-produced video"
        />
      </section>

      {keyDetails.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Details to watch for</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {keyDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {lesson.drills.trim() ? (
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Drill</h2>
          <p className="whitespace-pre-wrap text-sm text-muted">{lesson.drills}</p>
        </section>
      ) : null}

      {lesson.needsSupervision ? (
        <p className="text-sm text-muted">
          Supervised practice: {lesson.supervisedNote || "Do this drill with a coach or partner."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={toggleBookmarkAction} className="flex-1">
          <input type="hidden" name="lessonId" value={lesson.id} />
          <button className="touch-target w-full rounded-full border border-line">
            {progress?.bookmarked ? "Remove bookmark" : "Bookmark"}
          </button>
        </form>
        <form action={toggleCompleteAction} className="flex-1">
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="slug" value={lesson.slug} />
          <button className="touch-target w-full rounded-full bg-accent font-semibold text-black">
            {progress?.completed ? "Mark not complete" : "Mark complete"}
          </button>
        </form>
      </div>
    </main>
  );
}
