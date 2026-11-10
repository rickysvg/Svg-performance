import { prisma } from "@/lib/prisma";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { AdminScreen } from "@/components/admin/AdminChrome";

export default async function AdminWaitlistPage() {
  await requireDashboardAdmin();
  const rows = await prisma.waitlistSignup.findMany({
    orderBy: { createdAt: "desc" },
    take: 201,
  });
  const clipped = rows.length > 200;
  const shown = clipped ? rows.slice(0, 200) : rows;

  return (
    <AdminScreen
      kicker="Launch list"
      title="Waitlist"
      hint="Names and emails stay on this desk. Export CSV for the full list."
    >
      <a
        href="/api/admin/waitlist/export"
        data-testid="waitlist-export"
        className="touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-sm text-black"
      >
        Export CSV
      </a>
      {clipped ? (
        <p className="text-sm text-muted">Showing the latest rows. Export CSV for the full list.</p>
      ) : null}
      {shown.length === 0 ? (
        <p className="text-sm text-muted">No signups yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">
                <th className="py-2 pr-3 font-normal">Name</th>
                <th className="py-2 pr-3 font-normal">Email</th>
                <th className="py-2 pr-3 font-normal">Train</th>
                <th className="py-2 pr-3 font-normal">Member</th>
                <th className="py-2 pr-3 font-normal">Joined</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-3 pr-3">{row.firstName}</td>
                  <td className="py-3 pr-3">{row.email}</td>
                  <td className="py-3 pr-3">{row.train || "—"}</td>
                  <td className="py-3 pr-3">{row.member}</td>
                  <td className="py-3 pr-3 font-telemetry text-xs text-muted">
                    {row.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminScreen>
  );
}
