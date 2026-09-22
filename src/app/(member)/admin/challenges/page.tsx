import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { listChallengesForAdmin, monthKeyFrom } from "@/lib/challenges";
import { ChallengeAdminForm } from "@/components/admin/ChallengeAdminForm";
import { DemoBadge } from "@/components/DemoBadge";

export default async function AdminChallengesPage() {
  await requireAdmin();
  const rows = await listChallengesForAdmin();

  return (
    <main className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-accent underline">
          Back to toolkit
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Monthly SVG challenge</h1>
        <p className="mt-1 text-sm text-muted">
          Beginner and advanced tracks use days active (workout and/or food log). Not a
          heaviest-lift contest.
        </p>
      </div>
      <ChallengeAdminForm defaultMonth={monthKeyFrom()} />
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-semibold">
              {row.title} {row.isDemo ? <DemoBadge className="ml-2" /> : null}
            </p>
            <p className="text-sm text-muted">
              {row.monthKey} · {row.active ? "active" : "inactive"} ·{" "}
              {row._count.enrollments} opted in · beginner {row.beginnerGoalDays} days ·
              advanced {row.advancedGoalDays} days
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
