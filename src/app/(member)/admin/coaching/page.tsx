import Link from "next/link";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { listCoachingRoster } from "@/lib/admin-dashboard";
import { AdminScreen, AdminStat } from "@/components/admin/AdminChrome";

export default async function AdminCoachingPage() {
  await requireDashboardAdmin();
  const roster = await listCoachingRoster();

  return (
    <AdminScreen
      kicker="1-on-1"
      title="Coaching"
      hint={`Cap ${roster.cap}. Spots used and who is on the roster.`}
    >
      <section className="grid grid-cols-3 gap-2">
        <AdminStat label="Used" value={`${roster.used}`} alert={roster.full} />
        <AdminStat label="Cap" value={`${roster.cap}`} />
        <AdminStat label="Open" value={`${roster.remaining}`} alert={roster.remaining === 0} />
      </section>
      {roster.rows.length === 0 ? (
        <p className="text-sm text-muted">No coaching clients yet. {roster.remaining} spots open.</p>
      ) : (
        <ul className="space-y-2">
          {roster.rows.map((row) => (
            <li key={row.userId}>
              <Link href={`/admin/members/${row.userId}`} className="hc-panel block px-4 py-4">
                <span className="font-display block text-xl uppercase leading-tight">{row.name}</span>
                <span className="mt-1 block text-sm text-muted">{row.email}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminScreen>
  );
}
