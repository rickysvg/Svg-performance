import Link from "next/link";
import { requireStaff } from "@/lib/roles";
import { listMemberTrendsForStaff } from "@/lib/reports";
import { listJournalEntriesForStaff } from "@/lib/journal";
import { listBookingRequestsForUser } from "@/lib/bookings";
import { WeeklyCommentForm } from "@/components/staff/WeeklyCommentForm";
import { JournalFeedbackForm } from "@/components/staff/JournalFeedbackForm";
import { BookingNextStepsForm } from "@/components/staff/BookingNextStepsForm";
import { AdjustmentForm } from "@/components/staff/AdjustmentForm";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasCoachReview, planHasEliteReview } from "@/lib/plans";
import { EmptyState } from "@/components/EmptyState";

export default async function StaffCoachingPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const trends = await listMemberTrendsForStaff({
    staffUserId: staff.id,
    staffRole: staff.role,
  });
  const memberId = params.member || trends[0]?.userId || "";
  const member = trends.find((row) => row.userId === memberId) ?? trends[0];

  if (!member) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">Coach notes</h1>
        <EmptyState title="No assigned members">
          Admins assign coaches on Staff → trends.
        </EmptyState>
      </main>
    );
  }

  const planId = await getEffectivePlanId(member.userId);
  const [journal, bookings] = await Promise.all([
    listJournalEntriesForStaff({
      staffUserId: staff.id,
      staffRole: staff.role,
      memberUserId: member.userId,
    }),
    listBookingRequestsForUser(member.userId),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/staff/reports" className="text-sm text-accent underline">
          Back to trends
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Coach notes</h1>
        <p className="mt-1 text-sm text-muted">
          Write in your own words. Empty slots stay empty. Do not paste a fake Ricky comment.
        </p>
      </div>

      <form className="rounded-2xl border border-line bg-card p-4">
        <label className="block text-sm">
          Member
          <select
            name="member"
            defaultValue={member.userId}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            {trends.map((row) => (
              <option key={row.userId} value={row.userId}>
                {row.displayName} · {row.email}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="mt-3 text-sm text-accent underline">
          Open
        </button>
      </form>

      {planHasCoachReview(planId) ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Weekly comment (this Monday week)</h2>
          <WeeklyCommentForm memberUserId={member.userId} />
        </section>
      ) : (
        <p className="text-sm text-muted">
          This member&apos;s plan is below Fighter Development. No comment slot.
        </p>
      )}

      {planHasEliteReview(planId) ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-semibold">Adjustment log</h2>
          <AdjustmentForm memberUserId={member.userId} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Journal</h2>
        {journal.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No member notes yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {journal.map((entry) => (
              <li key={entry.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <p className="text-xs uppercase text-muted">{entry.kind}</p>
                <p className="font-semibold">{entry.title}</p>
                <p className="mt-1 text-sm text-muted">{entry.body}</p>
                {planHasCoachReview(planId) ? <JournalFeedbackForm entryId={entry.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Booking next steps</h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No Book with Ricky requests.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {bookings.map((row) => (
              <li key={row.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
                <p className="font-semibold">
                  {row.kind} · {row.status}
                </p>
                <p className="text-sm text-muted">{row.preferredTimes}</p>
                <BookingNextStepsForm requestId={row.id} defaultValue={row.nextSteps} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
