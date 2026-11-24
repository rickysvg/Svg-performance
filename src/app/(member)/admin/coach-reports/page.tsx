import { requireDashboardAdmin } from "@/lib/admin-access";
import { listCoachReplyReports } from "@/lib/coach-reply-report";
import { markCoachReplyReviewedAction } from "@/app/actions/coach-report";
import { AdminBack } from "@/components/admin/AdminChrome";

export default async function CoachReportsPage() {
  await requireDashboardAdmin();
  const rows = await listCoachReplyReports("open");
  return (
    <main className="space-y-6">
      <AdminBack href="/admin" />
      <div>
        <h1 className="text-2xl">AI coach reports</h1>
        <p className="mt-1 text-sm text-muted">Open reports of AI replies. The member stays in the app.</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted">No open reports.</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
            <p>
              {row.user.email} · {row.reason} · {row.createdAt.toISOString().slice(0, 10)}
            </p>
            {row.note ? <p className="mt-2 text-muted">{row.note}</p> : null}
            <p className="mt-2 text-xs text-muted">Message {row.messageId}</p>
            <form action={markCoachReplyReviewedAction} className="mt-3">
              <input type="hidden" name="reportId" value={row.id} />
              <button type="submit" className="touch-target rounded-full bg-accent px-4 text-black">
                Mark reviewed
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
