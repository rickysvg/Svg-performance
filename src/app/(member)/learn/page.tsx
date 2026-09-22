import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { PaywallNotice } from "@/components/PaywallNotice";
import { isAdmin } from "@/lib/roles";
import {
  LESSON_LEVELS,
  LESSON_TOPICS,
  buildLearnHref,
  lessonLevelLabel,
  lessonTopicLabel,
  listLessonProgressForUser,
  listPublishedLessons,
  resolveLearnLevelFilter,
  resolveLearnTopicFilter,
} from "@/lib/lessons";
import { resolveLessonVideo } from "@/lib/lesson-videos";
import { DemoBadge } from "@/components/DemoBadge";
import { EmptyState } from "@/components/EmptyState";

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`touch-target inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-accent bg-accent text-black"
          : "border-line bg-background text-foreground hover:border-accent"
      }`}
    >
      {children}
    </Link>
  );
}

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
  const skillLevel = resolveLearnLevelFilter(query.level, fullLibrary);
  const topic = resolveLearnTopicFilter(query.topic);
  const selectedLevel = skillLevel ?? "all";
  const [lessons, progress] = await Promise.all([
    listPublishedLessons({
      search: query.q,
      topic,
      skillLevel,
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
            Filter by athlete level and martial art. DEMO lessons include written
            details plus a labeled YouTube reference — not paid SVG video
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

      <form className="rounded-2xl border border-line bg-card p-4">
        {skillLevel ? <input type="hidden" name="level" value={skillLevel} /> : (
          <input type="hidden" name="level" value="all" />
        )}
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Search"
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        />
        <button className="touch-target mt-3 w-full rounded-full bg-accent font-semibold text-black">
          Search
        </button>
      </form>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Athlete level</p>
        <div className="flex flex-wrap gap-2">
          {(fullLibrary ? LESSON_LEVELS : (["beginner"] as const)).map((level) => (
            <Chip
              key={level}
              href={buildLearnHref({ q: query.q, topic, level })}
              active={selectedLevel === level}
            >
              {lessonLevelLabel(level)}
            </Chip>
          ))}
          {fullLibrary ? (
            <Chip
              href={buildLearnHref({ q: query.q, topic, level: "all" })}
              active={selectedLevel === "all"}
            >
              All levels
            </Chip>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Martial art</p>
        <div className="flex flex-wrap gap-2">
          <Chip
            href={buildLearnHref({ q: query.q, level: selectedLevel })}
            active={!topic}
          >
            All arts
          </Chip>
          {LESSON_TOPICS.map((art) => (
            <Chip
              key={art}
              href={buildLearnHref({ q: query.q, topic: art, level: selectedLevel })}
              active={topic === art}
            >
              {lessonTopicLabel(art)}
            </Chip>
          ))}
        </div>
      </section>

      {lessons.length === 0 ? (
        <EmptyState title="No published lessons match that filter">
          Try another level or martial art, or ask an admin to publish a DEMO lesson.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => {
            const row = progressMap.get(lesson.id);
            const video = resolveLessonVideo(lesson);
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
                    {lessonTopicLabel(lesson.topic)} · {lessonLevelLabel(lesson.skillLevel)}
                    {video.pending ? " · video pending" : " · YouTube reference"}
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
