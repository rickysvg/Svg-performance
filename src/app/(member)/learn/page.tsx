import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { PaywallNotice } from "@/components/PaywallNotice";
import { isAdmin } from "@/lib/roles";
import {
  LESSON_LEVELS,
  LESSON_TOPICS,
  listLessonProgressForUser,
  listPublishedLessons,
} from "@/lib/lessons";
import { DemoBadge } from "@/components/DemoBadge";
import { EmptyState } from "@/components/EmptyState";

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string; level?: string }>;
}) {
  const user = await requireUser();
  const [fullLibrary, beginnerLibrary] = await Promise.all([
    canUseFeature(user.id, "learn_full"),
    canUseFeature(user.id, "learn_beginner"),
  ]);
  if (!beginnerLibrary && !fullLibrary) {
    return <PaywallNotice feature="Learn" />;
  }
  const query = await searchParams;
  const [lessons, progress] = await Promise.all([
    listPublishedLessons({
      search: query.q,
      topic: query.topic,
      skillLevel: fullLibrary ? query.level : "beginner",
    }),
    listLessonProgressForUser(user.id),
  ]);
  const progressMap = new Map(progress.map((row) => [row.lessonId, row]));

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Learn</h1>
          <p className="mt-1 text-sm text-muted">
            Short MMA notes. DEMO lessons are labeled and are not paid SVG video
            instruction.
            {!fullLibrary
              ? " Member Access shows selected beginner notes only. Upgrade to SVG Performance for the full library."
              : ""}
          </p>
        </div>
        {isAdmin(user) ? (
          <Link href="/admin/lessons" className="text-sm text-accent underline">
            Admin
          </Link>
        ) : null}
      </div>

      <form className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-3">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Search"
          className="rounded-xl border border-line bg-background px-3 py-3"
        />
        <select
          name="topic"
          defaultValue={query.topic ?? ""}
          className="rounded-xl border border-line bg-background px-3 py-3"
        >
          <option value="">All topics</option>
          {LESSON_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
        <select
          name="level"
          defaultValue={fullLibrary ? (query.level ?? "") : "beginner"}
          disabled={!fullLibrary}
          className="rounded-xl border border-line bg-background px-3 py-3 disabled:opacity-70"
        >
          {fullLibrary ? <option value="">All levels</option> : null}
          {(fullLibrary ? LESSON_LEVELS : (["beginner"] as const)).map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button className="touch-target rounded-full bg-accent font-semibold text-black sm:col-span-3">
          Filter
        </button>
      </form>

      {lessons.length === 0 ? (
        <EmptyState title="No published lessons match that filter">
          Try clearing search, or ask an admin to publish a DEMO lesson.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => {
            const row = progressMap.get(lesson.id);
            return (
              <li key={lesson.id}>
                <Link
                  href={`/learn/${lesson.slug}`}
                  className="block rounded-2xl border border-line bg-card p-4 hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{lesson.title}</p>
                    {lesson.isDemo ? <DemoBadge /> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">{lesson.summary}</p>
                  <p className="mt-2 text-xs text-muted">
                    {lesson.topic} · {lesson.skillLevel}
                    {row?.bookmarked ? " · bookmarked" : ""}
                    {row?.completed ? " · completed" : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
