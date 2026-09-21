import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { DemoBadge } from "@/components/DemoBadge";
import { getLessonProgress, getPublishedLessonBySlug } from "@/lib/lessons";
import { toggleBookmarkAction, toggleCompleteAction } from "@/app/actions/lessons";
import { canUseFeature } from "@/lib/entitlements";
import { PaywallNotice } from "@/components/PaywallNotice";

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

  return (
    <main className="space-y-6">
      <Link href="/learn" className="text-sm text-accent underline-offset-4 hover:underline">
        Back to Learn
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">
            {lesson.topic} · {lesson.skillLevel} · {lesson.coachName}
          </p>
          <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        </div>
        {lesson.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="text-sm text-muted">{lesson.summary}</p>
      {lesson.equipment ? (
        <p className="text-sm">Equipment: {lesson.equipment}</p>
      ) : null}
      {lesson.needsSupervision ? (
        <p className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          Supervised practice: {lesson.supervisedNote || "Do this drill with a coach or partner."}
        </p>
      ) : null}
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Notes</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{lesson.notes}</p>
      </section>
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Drills</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{lesson.drills}</p>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={toggleBookmarkAction} className="flex-1">
          <input type="hidden" name="lessonId" value={lesson.id} />
          <button className="touch-target w-full rounded-full border border-line">
            {progress?.bookmarked ? "Remove bookmark" : "Bookmark"}
          </button>
        </form>
        <form action={toggleCompleteAction} className="flex-1">
          <input type="hidden" name="lessonId" value={lesson.id} />
          <button className="touch-target w-full rounded-full bg-accent font-semibold text-black">
            {progress?.completed ? "Mark not complete" : "Mark complete"}
          </button>
        </form>
      </div>
    </main>
  );
}
