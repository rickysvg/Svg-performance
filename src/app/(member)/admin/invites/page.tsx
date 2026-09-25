import Link from "next/link";
import { requireAdmin } from "@/lib/roles";
import { listPilotInvites } from "@/lib/invites";
import { InviteForm } from "@/components/admin/InviteForm";
import { deleteInviteAction } from "@/app/actions/admin";

export default async function AdminInvitesPage() {
  await requireAdmin();
  const invites = await listPilotInvites();

  return (
    <main className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-accent underline">
          Back to toolkit
        </Link>
        <h1 className="mt-2 text-2xl">Pilot invites</h1>
        <p className="mt-1 text-sm text-muted">
          Status is invited until they create an account, then joined. This does not send
          email unless SMTP is set later.
        </p>
      </div>
      <InviteForm />
      <ul className="space-y-3">
        {invites.length === 0 ? (
          <p className="text-sm text-muted">No invites yet.</p>
        ) : (
          invites.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-card p-4">
              <div>
                <p className="font-semibold">{row.email}</p>
                <p className="text-sm text-muted">
                  {row.status}
                  {row.joinedAt ? ` · ${row.joinedAt.toLocaleDateString()}` : ""} · by{" "}
                  {row.invitedBy.email}
                </p>
                {row.note ? <p className="text-sm text-muted">{row.note}</p> : null}
              </div>
              <form action={deleteInviteAction}>
                <input type="hidden" name="inviteId" value={row.id} />
                <button type="submit" className="text-sm text-accent underline">
                  Remove
                </button>
              </form>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
