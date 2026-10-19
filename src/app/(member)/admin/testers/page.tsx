import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isTesterCodeAdmin } from "@/lib/tester-access";
import { listTesterInvites } from "@/lib/tester";
import { TesterCodeForm } from "@/components/admin/TesterCodeForm";

export default async function AdminTestersPage() {
  const user = await requireUser();
  if (!isTesterCodeAdmin(user)) {
    redirect("/home");
  }
  const invites = await listTesterInvites();

  return (
    <main className="space-y-6" data-tester-admin>
      <div>
        <Link href="/admin" className="text-sm text-accent underline">
          Back to toolkit
        </Link>
        <h1 className="mt-2 text-2xl">Tester codes</h1>
        <p className="mt-1 text-sm text-muted">
          Invite codes for the beta. A code gives full Pro until Nov 16, 2026, with no card
          and no billing. Only emails in ADMIN_EMAILS can create codes.
        </p>
      </div>
      <TesterCodeForm />
      <ul className="space-y-3">
        {invites.length === 0 ? (
          <p className="text-sm text-muted">No tester codes yet.</p>
        ) : (
          invites.map((row) => (
            <li key={row.id} className="rounded-2xl border border-line bg-card p-4" data-tester-invite={row.code}>
              <p className="font-display text-2xl tracking-wide">{row.code}</p>
              <p className="mt-1 text-sm text-muted">
                {row.redemptions.length} / {row.maxUses} used
                {row.note ? ` · ${row.note}` : ""} · by {row.createdBy.email}
              </p>
              {row.redemptions.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Nobody has redeemed this yet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {row.redemptions.map((redemption) => (
                    <li key={redemption.id}>
                      {redemption.user.profile?.displayName || "Athlete"} · {redemption.user.email} ·{" "}
                      {redemption.redeemedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
