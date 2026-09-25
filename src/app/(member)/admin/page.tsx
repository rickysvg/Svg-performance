import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { listUsersForAdmin } from "@/lib/admin";
import { getPilotDashboardCounts } from "@/lib/pilot";
import { AdminVerifyForm } from "@/components/admin/AdminVerifyForm";
import { AdminAssignPlanForm } from "@/components/admin/AdminAssignPlanForm";
import { normalizePlanId, PLAN_CATALOG } from "@/lib/plans";

export default async function AdminPage() {
  await requireAdmin();
  const [users, counts] = await Promise.all([listUsersForAdmin(), getPilotDashboardCounts()]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl">Pilot toolkit</h1>
        <p className="mt-1 text-sm text-muted">
          Counts only — no private payloads. Gym verify still does not grant a price by
          itself. This is not live billing.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Signups", counts.signups],
          ["Weekly actives", counts.weeklyActives],
          ["Invited", counts.invited],
          ["Joined", counts.joined],
          ["Waitlist", counts.waiting],
          ["Open Book", counts.openBookings],
          ["Open help", counts.openHelp],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-accent">{value}</p>
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <Link href="/admin/invites" className="text-accent underline">
          Invites
        </Link>
        <Link href="/admin/queues" className="text-accent underline">
          Comment queues
        </Link>
        <Link href="/admin/plans" className="text-accent underline">
          Plans &amp; credits
        </Link>
        <Link href="/admin/challenges" className="text-accent underline">
          Monthly challenge
        </Link>
        <Link href="/admin/focus" className="text-accent underline">
          Weekly focus video
        </Link>
        <Link href="/admin/lessons" className="text-accent underline">
          Lessons
        </Link>
        <Link href="/staff/reports" className="text-accent underline">
          Trends
        </Link>
      </nav>

      <ul className="space-y-3">
        {users.map((user) => (
          <li key={user.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-semibold">{user.email}</p>
            <p className="text-sm text-muted">
              Role: {user.role} · Claims gym:{" "}
              {user.profile?.claimsGymMembership ? "yes" : "no"} · Verified:{" "}
              {user.profile?.gymMembershipVerified ? "yes" : "no"} · Plan:{" "}
              {user.subscriptions[0]
                ? `${PLAN_CATALOG[normalizePlanId(user.subscriptions[0].plan)].label} / ${user.subscriptions[0].status}`
                : "none"}
            </p>
            <AdminVerifyForm
              userId={user.id}
              verified={Boolean(user.profile?.gymMembershipVerified)}
            />
            <AdminAssignPlanForm
              userId={user.id}
              currentPlan={
                user.subscriptions[0]
                  ? normalizePlanId(user.subscriptions[0].plan)
                  : "member_access"
              }
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
