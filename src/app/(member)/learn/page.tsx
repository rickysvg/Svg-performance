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
  lessonLevelLabel,
  lessonTopicLabel,
  listLessonProgressForUser,
  listPublishedLessons,
  resolveLearnLevelFilter,
  resolveLearnTopicFilter,
} from "@/lib/lessons";
import { LearnLessonCard } from "@/components/learn/LearnLessonCard";
import { SeminarCard } from "@/components/learn/SeminarCard";
import { SeminarClipCard } from "@/components/learn/SeminarClipCard";
import { EmptyState } from "@/components/EmptyState";
import { UpgradePreviewSheet } from "@/components/upgrade/UpgradePreviewSheet";
import {
  SEMINAR_CATEGORIES,
  buildLearnHubHref,
  listClips,
  listFeaturedSeminars,
  listSeminars,
  resolveLearnTab,
  resolveSeminarCage,
  resolveSeminarCategory,
  resolveSeminarLevel,
  resolveSeminarView,
  seminarLevelLabel,
  seminarLocked,
} from "@/lib/learn-seminars";

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
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm ${
        active ? "bg-accent text-black" : "border border-line text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    topic?: string;
    level?: string;
    cat?: string;
    view?: string;
    tab?: string;
    cage?: string;
  }>;
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
  const tab = resolveLearnTab(query.tab);
  const category = resolveSeminarCategory(query.cat);
  const seminarLevel = resolveSeminarLevel(query.level);
  const view = resolveSeminarView(query.view);
  const cage = resolveSeminarCage(query.cage, category);
  const q = query.q ?? "";

  const skillLevel = resolveLearnLevelFilter(query.level ?? "all", true);
  const topic = resolveLearnTopicFilter(query.topic ?? "all");
  const selectedLevel = skillLevel ?? "all";

  return (
    <main className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl">Learn</h1>
          {isAdmin(user) ? (
            <Link href="/admin/lessons" className="text-sm text-muted">
              Admin
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted">
          Seminars from UFC champions and world-class coaches. Tap a technique to jump straight
          to it.
        </p>
      </div>

      <nav aria-label="Learn sections" className="flex gap-2">
        <Chip href={buildLearnHubHref({ q })} active={tab === "seminars"}>
          Seminars
        </Chip>
        <Chip
          href={buildLearnHubHref({
            tab: "library",
            q,
            topic: topic ?? "all",
            level: query.level ?? "all",
          })}
          active={tab === "library"}
        >
          Technique library
        </Chip>
      </nav>

      {tab === "library" ? (
        <TechniqueLibrary
          q={q}
          topic={topic}
          selectedLevel={selectedLevel}
          fullLibrary={fullLibrary}
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          userId={user.id}
        />
      ) : (
        <SeminarLibrary
          q={q}
          category={category}
          level={seminarLevel}
          view={view}
          cage={cage}
          fullLibrary={fullLibrary}
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
        />
      )}
    </main>
  );
}

async function TechniqueLibrary({
  q,
  topic,
  selectedLevel,
  fullLibrary,
  canStartTrial,
  trialDays,
  userId,
}: {
  q: string;
  topic: string | undefined;
  selectedLevel: string;
  fullLibrary: boolean;
  canStartTrial: boolean;
  trialDays: number;
  userId: string;
}) {
  const skillLevel = selectedLevel === "all" ? undefined : selectedLevel;
  const [lessons, progress] = await Promise.all([
    listPublishedLessons({ search: q, topic, skillLevel }),
    listLessonProgressForUser(userId),
  ]);
  const progressMap = new Map(progress.map((row) => [row.lessonId, row]));
  const href = (next: { topic?: string; level?: string }) =>
    buildLearnHubHref({
      tab: "library",
      q,
      topic: next.topic ?? topic ?? "all",
      level: next.level ?? selectedLevel,
    });

  return (
    <>
      <p className="text-sm text-muted">
        Shorter technique references by martial art and skill. Hosted on YouTube.
        {!fullLibrary ? " Intermediate and advanced lessons stay locked." : ""}
      </p>
      <form action="/learn" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="tab" value="library" />
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        <input type="hidden" name="level" value={selectedLevel} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search technique lessons"
          className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
        />
        <button
          type="submit"
          className="touch-target shrink-0 rounded-full border border-line px-4 text-sm"
        >
          Search
        </button>
      </form>
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Skill level</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={href({ level: "all" })} active={selectedLevel === "all"}>
            All levels
          </Chip>
          {LESSON_LEVELS.map((level) => (
            <Chip key={level} href={href({ level })} active={selectedLevel === level}>
              {lessonLevelLabel(level)}
            </Chip>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Martial art</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={href({ topic: "all" })} active={!topic}>
            All
          </Chip>
          {LESSON_TOPICS.map((art) => (
            <Chip key={art} href={href({ topic: art })} active={topic === art}>
              {lessonTopicLabel(art)}
            </Chip>
          ))}
        </div>
      </section>
      {lessons.length === 0 ? (
        <EmptyState title="No lessons match that filter">
          Try another art or level.
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
                canStartTrial={canStartTrial}
                trialDays={trialDays}
              />
            );
          })}
        </ul>
      )}
    </>
  );
}

function SeminarLibrary({
  q,
  category,
  level,
  view,
  cage,
  fullLibrary,
  canStartTrial,
  trialDays,
}: {
  q: string;
  category: ReturnType<typeof resolveSeminarCategory>;
  level: ReturnType<typeof resolveSeminarLevel>;
  view: ReturnType<typeof resolveSeminarView>;
  cage: boolean;
  fullLibrary: boolean;
  canStartTrial: boolean;
  trialDays: number;
}) {
  const filters = { category, level, q, cage };
  const seminars = listSeminars(filters);
  const clips = view === "clips" ? listClips(filters) : [];
  const showRail = view === "seminars" && category === "all" && level === "all" && !q.trim() && !cage;
  const featured = showRail ? listFeaturedSeminars() : [];
  const resetHref = buildLearnHubHref({ view });
  const href = (next: {
    cat?: string;
    level?: string;
    view?: "seminars" | "clips";
    cage?: boolean;
  }) =>
    buildLearnHubHref({
      q,
      cat: next.cat ?? category,
      level: next.level ?? level,
      view: next.view ?? view,
      cage: next.cage !== undefined ? next.cage : cage,
    });

  return (
    <>
      {!fullLibrary ? (
        <UpgradePreviewSheet
          kind="seminar"
          canStartTrial={canStartTrial}
          trialDays={trialDays}
          next="/learn"
        >
          <span className="block rounded-2xl border border-line bg-card p-4 text-sm">
            Beginner seminars are free. Unlock every seminar and clip with Performance.
          </span>
        </UpgradePreviewSheet>
      ) : null}

      <form action="/learn" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {category !== "all" ? <input type="hidden" name="cat" value={category} /> : null}
        {level !== "all" ? <input type="hidden" name="level" value={level} /> : null}
        {view === "clips" ? <input type="hidden" name="view" value="clips" /> : null}
        {cage ? <input type="hidden" name="cage" value="1" /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search seminars, coaches, techniques"
          className="min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
        />
        <button
          type="submit"
          className="touch-target shrink-0 rounded-full border border-line px-4 text-sm"
        >
          Search
        </button>
      </form>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Category</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={href({ cat: "all", cage: false })} active={category === "all"}>
            All
          </Chip>
          {SEMINAR_CATEGORIES.map((item) => (
            <Chip
              key={item.id}
              href={href({ cat: item.id, cage: item.id === "mma" ? cage : false })}
              active={category === item.id}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">Level</p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={href({ level: "all" })} active={level === "all"}>
            All levels
          </Chip>
          {(["beginner", "intermediate", "advanced"] as const).map((item) => (
            <Chip key={item} href={href({ level: item })} active={level === item}>
              {seminarLevelLabel(item)}
            </Chip>
          ))}
        </div>
      </section>

      {category === "mma" ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip href={href({ cage: !cage })} active={cage}>
            Cage / wall work
          </Chip>
        </div>
      ) : null}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Library view">
        <Chip href={href({ view: "seminars" })} active={view === "seminars"}>
          Seminars
        </Chip>
        <Chip href={href({ view: "clips" })} active={view === "clips"}>
          Technique clips
        </Chip>
      </div>

      {showRail ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted">Start here</h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {featured.map((seminar) => (
              <li key={seminar.slug} className="w-72 shrink-0">
                <SeminarCard
                  seminar={seminar}
                  locked={seminarLocked(seminar, { fullLibrary })}
                  canStartTrial={canStartTrial}
                  trialDays={trialDays}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "clips" ? (
        clips.length === 0 ? (
          <EmptyState title="No technique clips match">
            <Link href={resetHref} className="underline">
              Clear filters
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <li key={clip.id}>
                <SeminarClipCard
                  clip={clip}
                  locked={seminarLocked({ level: clip.level }, { fullLibrary })}
                  canStartTrial={canStartTrial}
                  trialDays={trialDays}
                />
              </li>
            ))}
          </ul>
        )
      ) : seminars.length === 0 ? (
        <EmptyState title="No seminars match">
          <Link href={resetHref} className="underline">
            Clear filters
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seminars.map((seminar) => (
            <li key={seminar.slug}>
              <SeminarCard
                seminar={seminar}
                locked={seminarLocked(seminar, { fullLibrary })}
                canStartTrial={canStartTrial}
                trialDays={trialDays}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
