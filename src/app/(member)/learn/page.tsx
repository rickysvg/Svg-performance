import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseFeature } from "@/lib/entitlements";
import { PaywallNotice } from "@/components/PaywallNotice";
import { getTrialState } from "@/lib/trial";
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
import { LearnLessonCard } from "@/components/learn/LearnLessonCard";
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
      className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
        active
          ? "border-black bg-accent font-semibold text-black"
          : "border-line text-muted hover:border-foreground hover:text-foreground"
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
  const [fullLibrary, beginnerLibrary, trial] = await Promise.all([
    canUseFeature(user.id, "learn_full"),
    canUseFeature(user.id, "learn_beginner"),
    getTrialState(user.id),
  ]);
  if (!beginnerLibrary && !fullLibrary) {
    return <PaywallNotice feature="Learn" />;
  }
  const query = await searchParams;
  const skillLevel = resolveLearnLevelFilter(query.level ?? "all", true);
  const topic = resolveLearnTopicFilter(query.topic ?? "all");
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
    <main className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">Learn</h1>
          {isAdmin(user) ? (
            <Link href="/admin/lessons" className="text-sm text-muted">
              Admin
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted">
          Technique library by martial art and skill. YouTube references — not SVG-produced
          coaching film.
          {!fullLibrary
            ? " Free plan shows every title. Intermediate and advanced videos stay locked."
            : ""}
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Skill level</p>
        <div className="flex flex-wrap gap-2">
          <Chip
            href={buildLearnHref({ q: query.q, topic: topic ?? "all", level: "all" })}
            active={selectedLevel === "all"}
          >
            All
          </Chip>
          {LESSON_LEVELS.map((level) => (
            <Chip
              key={level}
              href={buildLearnHref({ q: query.q, topic: topic ?? "all", level })}
              active={selectedLevel === level}
            >
              {lessonLevelLabel(level)}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Martial art</p>
        <div className="flex flex-wrap gap-2">
          <Chip
            href={buildLearnHref({ q: query.q, level: selectedLevel, topic: "all" })}
            active={!topic}
          >
            All
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
        <EmptyState title="No lessons match that filter">
          Try another art or level. Pending videos stay listed when a write-up exists.
        </EmptyState>
      ) : (
        <ul className="space-y-5">
          {lessons.map((lesson) => {
            const row = progressMap.get(lesson.id);
            return (
              <LearnLessonCard
                key={lesson.id}
                lesson={lesson}
                bookmarked={row?.bookmarked}
                completed={row?.completed}
                locked={!fullLibrary && lesson.skillLevel !== "beginner"}
                canStartTrial={trial.canStartTrial}
                trialDays={trial.trialLengthDays}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}
