import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { detectNewPrsForSession, getCompanionProgress } from "@/lib/progress-companion";
import { NewPrHero } from "@/components/progress/NewPrHero";
import { RecordsList } from "@/components/progress/RecordsList";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ pr?: string; prDetail?: string; session?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const profile = await getProfileForUser(user.id);
  const units = profile?.preferredUnits ?? "lb";
  const companion = await getCompanionProgress(user.id, units);
  const latestPrs = query.session
    ? await detectNewPrsForSession(user.id, query.session, units)
    : [];
  const hero = latestPrs[0] ?? null;
  const newExercise = hero?.exerciseName ?? null;

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/progress"
          className="touch-target inline-flex items-center justify-center text-2xl leading-none"
          aria-label="Back to Progress"
        >
          ‹
        </Link>
        <h1 className="text-xl">Records</h1>
        <span className="w-8" aria-hidden />
      </div>

      <NewPrHero
        pr={hero}
        fallbackHeadline={query.pr}
        fallbackDetail={query.prDetail}
      />

      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg">Personal records</h2>
          <p className="text-sm text-muted">Tap one to chart it</p>
        </div>
        <div className="mt-3">
          <RecordsList records={companion.records} newExercise={newExercise} />
        </div>
      </section>
    </main>
  );
}
