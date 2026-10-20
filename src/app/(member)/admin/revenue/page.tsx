import { requireDashboardAdmin } from "@/lib/admin-access";
import { getRevenueDesk } from "@/lib/admin-dashboard";
import { AdminScreen, AdminStat } from "@/components/admin/AdminChrome";

export default async function AdminRevenuePage() {
  await requireDashboardAdmin();
  const revenue = await getRevenueDesk();

  return (
    <AdminScreen
      kicker="Subscriptions"
      title="Revenue"
      hint="Active Pro, open trials, and trials that became a paid plan."
    >
      <section className="grid grid-cols-3 gap-2">
        <AdminStat label="Active Pro" value={String(revenue.activePro)} />
        <AdminStat label="Trials" value={String(revenue.trials)} />
        <AdminStat label="Converted" value={String(revenue.conversions)} />
      </section>

      {revenue.empty ? (
        <p className="hc-panel px-4 py-4 text-sm text-muted">
          {revenue.wired
            ? "No active Pro, trials, or conversions stored yet."
            : "Stripe is not connected, and there are no subscriptions stored yet."}
        </p>
      ) : (
        <>
          {!revenue.wired ? (
            <p className="text-sm text-muted">
              Counts come from subscriptions stored in the app. Live Stripe billing is not connected.
            </p>
          ) : null}
          {revenue.activeProRows.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg">Active Pro</h2>
              <ul className="space-y-2">
                {revenue.activeProRows.map((row) => (
                  <li key={row.email} className="hc-panel px-4 py-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-muted">{row.email}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {revenue.trialRows.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg">Trials</h2>
              <ul className="space-y-2">
                {revenue.trialRows.map((row) => (
                  <li key={row.email} className="hc-panel px-4 py-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-muted">{row.email}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}
