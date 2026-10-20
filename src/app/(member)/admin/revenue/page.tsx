import { requireDashboardAdmin } from "@/lib/admin-access";
import { getRevenueDesk } from "@/lib/admin-dashboard";
import { AdminScreen, AdminStat } from "@/components/admin/AdminChrome";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { deskSurfaceClass } from "@/lib/admin-desk-status";

export default async function AdminRevenuePage() {
  await requireDashboardAdmin();
  const revenue = await getRevenueDesk();
  const paymentsClear = revenue.failedPayments === 0 && revenue.activePro > 0;

  return (
    <AdminScreen
      kicker="Subscriptions"
      title="Revenue"
      hint="Active Pro, open trials, and payments that failed."
    >
      <section className="grid grid-cols-2 gap-2">
        <AdminStat label="Active Pro" value={String(revenue.activePro)} tone={paymentsClear ? "clear" : "idle"} />
        <AdminStat label="Trials" value={String(revenue.trials)} />
        <AdminStat label="Converted" value={String(revenue.conversions)} tone={revenue.conversions > 0 ? "clear" : "idle"} />
        <AdminStat
          label="Failed"
          value={String(revenue.failedPayments)}
          tone={revenue.failedPayments > 0 ? "attention" : paymentsClear ? "clear" : "idle"}
        />
      </section>

      {revenue.failedRows.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Failed payments</h2>
          <ul className="space-y-2">
            {revenue.failedRows.map((row) => (
              <li
                key={`${row.email}-${row.status}`}
                data-desk-tone="attention"
                className={`hc-panel flex items-center justify-between gap-3 px-4 py-3 ${deskSurfaceClass("attention")}`}
              >
                <span>
                  <span className="block font-semibold">{row.name}</span>
                  <span className="text-sm text-muted">{row.email}</span>
                </span>
                <DeskBadge tone="attention" label={row.status === "past_due" ? "Past due" : "Unpaid"} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {revenue.empty && revenue.failedRows.length === 0 ? (
        <p className={`hc-panel px-4 py-4 text-sm text-muted ${deskSurfaceClass("idle")}`}>
          {revenue.wired
            ? "No active Pro, trials, or conversions stored yet."
            : "Stripe is not connected, and there are no subscriptions stored yet."}
        </p>
      ) : (
        <>
          {!revenue.wired && !revenue.empty ? (
            <p className="text-sm text-muted">
              Counts come from subscriptions stored in the app. Live Stripe billing is not connected.
            </p>
          ) : null}
          {revenue.activeProRows.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg">Active Pro</h2>
              <ul className="space-y-2">
                {revenue.activeProRows.map((row) => (
                  <li
                    key={row.email}
                    data-desk-tone="clear"
                    className={`hc-panel flex items-center justify-between gap-3 px-4 py-3 ${deskSurfaceClass("clear")}`}
                  >
                    <span>
                      <span className="block font-semibold">{row.name}</span>
                      <span className="text-sm text-muted">{row.email}</span>
                    </span>
                    <DeskBadge tone="clear" label="Current" />
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
                  <li
                    key={row.email}
                    data-desk-tone="idle"
                    className={`hc-panel px-4 py-3 ${deskSurfaceClass("idle")}`}
                  >
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
