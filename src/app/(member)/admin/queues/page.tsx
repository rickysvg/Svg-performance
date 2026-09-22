import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { getPilotQueues } from "@/lib/pilot";
import { bookingLabel } from "@/lib/bookings";
import { PLAN_CATALOG, normalizePlanId } from "@/lib/plans";

export default async function AdminQueuesPage() {
  await requireAdmin();
  const queues = await getPilotQueues();

  return (
    <main className="space-y-8">
      <div>
        <Link href="/admin" className="text-sm text-accent underline">
          Back to toolkit
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Comment queues</h1>
        <p className="mt-1 text-sm text-muted">
          Work lists only. Open a member on Staff → Coach notes to write in your own words.
          Week key {queues.weekStartKey}.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Weekly report comments needed</h2>
        {queues.commentsWaiting.length === 0 ? (
          <p className="text-sm text-muted">No empty comment slots in this sample.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {queues.commentsWaiting.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                {row.email}{" "}
                <Link href={`/staff/coaching?member=${row.id}`} className="text-accent underline">
                  Write comment
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Journal feedback needed</h2>
        {queues.journalWaiting.length === 0 ? (
          <p className="text-sm text-muted">No unanswered journal entries.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {queues.journalWaiting.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                {row.user.email} · {row.title}{" "}
                <Link
                  href={`/staff/coaching?member=${row.user.id}`}
                  className="text-accent underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Book requests</h2>
        {queues.bookings.length === 0 ? (
          <p className="text-sm text-muted">No open Book requests.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {queues.bookings.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                {row.user.email} · {bookingLabel(row.kind)} · {row.status}{" "}
                <Link href="/admin/plans" className="text-accent underline">
                  Plans
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Waitlist</h2>
        {queues.waitlist.length === 0 ? (
          <p className="text-sm text-muted">Nobody is waiting.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {queues.waitlist.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                {row.user.email} · {PLAN_CATALOG[normalizePlanId(row.plan)].label}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Clips waiting for notes</h2>
        {queues.clipsWaiting.length === 0 ? (
          <p className="text-sm text-muted">No clips waiting.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {queues.clipsWaiting.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
                {row.user.email} · {row.title}{" "}
                <Link href={`/clips/${row.id}`} className="text-accent underline">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
