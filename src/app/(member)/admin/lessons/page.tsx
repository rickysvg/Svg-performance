import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { lessonLevelLabel, lessonTopicLabel, listAllLessonsForAdmin } from "@/lib/lessons";
import { publishLessonAction } from "@/app/actions/lessons";
import { DemoBadge } from "@/components/DemoBadge";

export default async function AdminLessonsPage() {
  await requireAdmin();
  const lessons = await listAllLessonsForAdmin();

  return (
    <main className="space-y-6">
      <Link href="/admin" className="text-sm text-accent underline">
        Back to admin
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl">Lessons</h1>
        <Link
          href="/admin/lessons/new"
          className="touch-target inline-flex items-center rounded-full bg-accent px-4 text-black"
        >
          New draft
        </Link>
      </div>
      <ul className="space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{lesson.title}</p>
              {lesson.isDemo ? <DemoBadge /> : null}
            </div>
            <p className="text-sm text-muted">
              {lesson.status} · {lessonTopicLabel(lesson.topic)} · {lessonLevelLabel(lesson.skillLevel)}
              {lesson.videoPending || !lesson.youtubeUrl ? " · video pending" : " · YouTube"}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/admin/lessons/${lesson.id}`} className="text-sm text-accent underline">
                Edit
              </Link>
              <form action={publishLessonAction}>
                <input type="hidden" name="lessonId" value={lesson.id} />
                <input
                  type="hidden"
                  name="status"
                  value={lesson.status === "published" ? "draft" : "published"}
                />
                <button className="text-sm underline">
                  {lesson.status === "published" ? "Unpublish" : "Publish"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
