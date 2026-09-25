import Link from "next/link";
import { requireStaff } from "@/lib/roles";
import { listHelpRequestsForStaff } from "@/lib/help";
import { EmptyState } from "@/components/EmptyState";
import { HelpStatusForm } from "@/components/staff/HelpStatusForm";

export default async function StaffHelpPage() {
  const staff = await requireStaff();
  const requests = await listHelpRequestsForStaff({
    staffUserId: staff.id,
    staffRole: staff.role,
  });

  return (
    <main className="space-y-6">
      <div>
        <Link href="/staff/reports" className="text-sm text-accent underline">
          Back to reports
        </Link>
        <h1 className="mt-2 text-2xl">Coach help requests</h1>
        <p className="mt-2 text-sm text-muted">
          Statuses are open, seen, or closed. This is not a 24/7 promise.
        </p>
      </div>
      {requests.length === 0 ? (
        <EmptyState title="No help requests yet">
          Members can send one from Home. Coaches only see assigned members.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {requests.map((row) => (
            <li key={row.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-semibold">
                {row.member.profile?.displayName || row.member.email}
              </p>
              <p className="text-sm text-muted">
                {row.member.email} · {row.topic} · {row.status}
              </p>
              <p className="mt-2 text-sm">{row.note}</p>
              <HelpStatusForm requestId={row.id} status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
