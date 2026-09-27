import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getShareCardView } from "@/lib/share-card-data";
import { WorkoutDoneCard } from "@/components/share/WorkoutDoneCard";
import { CooldownPrompt } from "@/components/training/CooldownPrompt";
import { getProfileForUser } from "@/lib/profile";
import { detectNewPrsForSession } from "@/lib/progress-companion";
import { NewPrHero } from "@/components/progress/NewPrHero";

export default async function WorkoutDonePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ pr?: string; prDetail?: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const query = await searchParams;
  const view = await getShareCardView(user.id, sessionId);
  if (!view) notFound();
  const profile = await getProfileForUser(user.id);
  const prs = await detectNewPrsForSession(
    user.id,
    sessionId,
    profile?.preferredUnits ?? "lb",
  );

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/training/log/${sessionId}`}
          className="touch-target inline-flex items-center justify-center text-2xl leading-none"
          aria-label="Back to session"
        >
          ‹
        </Link>
        <h1 className="text-xl">Workout done</h1>
        <span className="w-8" aria-hidden />
      </div>

      {prs[0] || query.pr ? (
        <NewPrHero pr={prs[0]} fallbackHeadline={query.pr} fallbackDetail={query.prDetail} />
      ) : (
        <p className="rounded-full bg-accent px-4 py-2 text-center text-sm text-black">
          Session saved · nice work
        </p>
      )}

      {view.stats.length === 0 ? (
        <p className="text-sm text-muted">
          This session is saved, but there are no logged numbers to put on a card yet.
        </p>
      ) : (
        <WorkoutDoneCard title={view.session.title} stats={view.stats} />
      )}

      <CooldownPrompt />

      <p className="text-center text-sm">
        <Link href={`/training/log/${sessionId}?rate=1`} className="text-accent underline">
          Rate how it felt
        </Link>
        {" · "}
        <Link href="/training/history" className="text-accent underline">
          History
        </Link>
        {prs[0] ? (
          <>
            {" · "}
            <Link href={`/progress/records?session=${sessionId}`} className="text-accent underline">
              Open record
            </Link>
          </>
        ) : null}
      </p>
    </main>
  );
}
