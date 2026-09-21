import { requireAdmin } from "@/lib/roles";
import { listUsersForAdmin } from "@/lib/admin";
import { AdminVerifyForm } from "@/components/admin/AdminVerifyForm";
import Link from "next/link";

export default async function AdminPage() {
  await requireAdmin();
  const users = await listUsersForAdmin();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          Manual gym-member verification. A member checking “I train at SVG”
          still grants nothing until you flip this switch.
        </p>
      </div>
      <p>
        <Link href="/admin/lessons" className="text-accent underline-offset-4 hover:underline">
          Publish lessons
        </Link>
        {" · "}
        <Link href="/staff/reports" className="text-accent underline-offset-4 hover:underline">
          Member trends
        </Link>
      </p>
      <ul className="space-y-3">
        {users.map((user) => (
          <li key={user.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-semibold">{user.email}</p>
            <p className="text-sm text-muted">
              Role: {user.role} · Claims gym:{" "}
              {user.profile?.claimsGymMembership ? "yes" : "no"} · Verified:{" "}
              {user.profile?.gymMembershipVerified ? "yes" : "no"} · Plan:{" "}
              {user.subscriptions[0]
                ? `${user.subscriptions[0].plan} / ${user.subscriptions[0].status}`
                : "none"}
            </p>
            <AdminVerifyForm
              userId={user.id}
              verified={Boolean(user.profile?.gymMembershipVerified)}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
