import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { listUsersForAdmin } from "@/lib/admin";
import { listWaitlist, listSeatStatus } from "@/lib/waitlist";
import { listBookingRequestsForAdmin, bookingLabel } from "@/lib/bookings";
import { isCreditKind, startOfUtcMonth } from "@/lib/credits";
import { PLAN_CATALOG, CREDIT_LABELS, normalizePlanId } from "@/lib/plans";
import { AdminAssignPlanForm } from "@/components/admin/AdminAssignPlanForm";
import { AdminCreditForm } from "@/components/admin/AdminCreditForm";
import { AdminRestoreCreditForm } from "@/components/admin/AdminRestoreCreditForm";
import { AdminBookingStatusForm } from "@/components/admin/AdminBookingStatusForm";
import { BookingNextStepsForm } from "@/components/staff/BookingNextStepsForm";

export default async function AdminPlansPage() {
  await requireAdmin();
  const [users, waitlist, bookings, seats] = await Promise.all([
    listUsersForAdmin(),
    listWaitlist(),
    listBookingRequestsForAdmin(),
    listSeatStatus(),
  ]);
  const periodStart = startOfUtcMonth();

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Plans &amp; credits</h1>
        <p className="mt-1 text-sm text-muted">
          Pilot override: assign a catalog plan for 30 days, mark a credit used after a
          real session, and review waitlist / booking requests. This is not live billing.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin" className="text-accent underline">
            Back to gym verify
          </Link>
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Pilot caps</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {seats.map((row) => (
            <li key={row.id}>
              {row.label}: {row.seats} / {row.cap}
              {row.atCap ? " · full" : ""}
            </li>
          ))}
        </ul>
      </section>

      <ul className="space-y-4">
        {users.map((user) => {
          const sub = user.subscriptions[0];
          const planId = sub ? normalizePlanId(sub.plan) : "member_access";
          const monthCredits = user.coachingCredits.filter(
            (row) => row.periodStart.getTime() === periodStart.getTime(),
          );
          return (
            <li key={user.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-semibold">{user.email}</p>
              <p className="text-sm text-muted">
                {PLAN_CATALOG[planId].label}
                {sub ? ` · ${sub.status} · ${sub.source}` : " · no subscription row"}
              </p>
              {monthCredits.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                  {monthCredits.map((row) => (
                    <li key={row.id}>
                      {isCreditKind(row.kind) ? CREDIT_LABELS[row.kind] : row.kind}:{" "}
                      {row.used} used / {row.allotted}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">No credits allotted this month.</p>
              )}
              <AdminAssignPlanForm userId={user.id} currentPlan={planId} />
              <AdminCreditForm userId={user.id} />
              <AdminRestoreCreditForm userId={user.id} />
            </li>
          );
        })}
      </ul>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Waitlist</h2>
        {waitlist.length === 0 ? (
          <p className="text-sm text-muted">Nobody is waiting.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {waitlist.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                {row.user.email} · {PLAN_CATALOG[normalizePlanId(row.plan)].label} ·{" "}
                {row.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Booking requests</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">No requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                <p className="font-semibold">{row.user.email}</p>
                <p className="text-sm text-muted">
                  {bookingLabel(row.kind)} · {row.status}
                  {row.usesIncludedCredit ? " · included credit" : ""}
                </p>
                <p className="mt-1 text-sm">{row.preferredTimes}</p>
                {row.note ? <p className="text-sm text-muted">{row.note}</p> : null}
                <AdminBookingStatusForm requestId={row.id} status={row.status} />
                <BookingNextStepsForm requestId={row.id} defaultValue={row.nextSteps} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
