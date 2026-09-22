import Link from "next/link";
import { requireStaff, isAdmin } from "@/lib/roles";
import {
  listMemberTrendsForStaff,
  listAssignableUsers,
  listCoachAssignments,
} from "@/lib/reports";
import { EmptyState } from "@/components/EmptyState";
import { AssignCoachForm } from "@/components/staff/AssignCoachForm";

function formatActive(value: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleString();
}

export default async function StaffReportsPage() {
  const staff = await requireStaff();
  const [trends, users, assignments] = await Promise.all([
    listMemberTrendsForStaff({ staffUserId: staff.id, staffRole: staff.role }),
    isAdmin(staff) ? listAssignableUsers() : Promise.resolve([]),
    isAdmin(staff) ? listCoachAssignments() : Promise.resolve([]),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Staff</p>
        <h1 className="text-2xl font-semibold">Member trends</h1>
        <p className="mt-2 text-sm text-muted">
          High-level counts only. Private food diaries are not listed here.
          Coaches see assigned members; admins see everyone.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/staff/help" className="text-accent underline">
            Help requests
          </Link>
          {" · "}
          <Link href="/staff/coaching" className="text-accent underline">
            Coach notes
          </Link>
          {isAdmin(staff) ? (
            <>
              {" · "}
              <Link href="/admin" className="text-accent underline">
                Admin verify
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {isAdmin(staff) ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Assign a coach</h2>
          <p className="mt-1 text-sm text-muted">
            Make a coach account with{" "}
            <code className="text-xs text-accent">npm run staff:promote -- coach@example.com coach</code>
            , then assign members here.
          </p>
          <div className="mt-4">
            <AssignCoachForm
              coaches={users.filter((row) => row.role === "coach" || row.role === "admin")}
              members={users.filter((row) => row.role === "member")}
            />
          </div>
          {assignments.length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {assignments.map((row) => (
                <li key={row.id}>
                  {row.coach.email} → {row.member.email}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {trends.length === 0 ? (
        <EmptyState title="No members to report on yet">
          {staff.role === "coach"
            ? "An admin needs to assign members to you first."
            : "Create a member account, then return here."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {trends.map((row) => (
            <li key={row.userId} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-semibold">{row.displayName}</p>
              <p className="text-sm text-muted">{row.email}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Workouts logged</dt>
                  <dd className="font-medium">{row.workoutsLogged}</dd>
                </div>
                <div>
                  <dt className="text-muted">Lessons completed</dt>
                  <dd className="font-medium">{row.lessonsCompleted}</dd>
                </div>
                <div>
                  <dt className="text-muted">AI handoff flags</dt>
                  <dd className="font-medium">{row.aiHandoffFlags}</dd>
                </div>
                <div>
                  <dt className="text-muted">Open help requests</dt>
                  <dd className="font-medium">{row.openHelpRequests}</dd>
                </div>
              </dl>
              {row.recentDifficultyLabel ? (
                <p className="mt-3 text-sm text-muted">
                  Recent session feel: {row.recentDifficultyLabel}
                </p>
              ) : null}
              {row.tooEasyNote ? (
                <p className="mt-1 text-sm text-muted">{row.tooEasyNote}</p>
              ) : null}
              <p className="mt-3 text-xs text-muted">
                Last active: {formatActive(row.lastActiveAt)}
              </p>
              <Link
                href={`/staff/coaching?member=${row.userId}`}
                className="mt-2 inline-block text-sm text-accent underline"
              >
                Write coach notes
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
