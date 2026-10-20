import { requireDashboardAdmin } from "@/lib/admin-access";
import { getFoundingDeal } from "@/lib/admin-dashboard";
import { PLAN_CATALOG } from "@/lib/plans";
import { AdminScreen, AdminStat } from "@/components/admin/AdminChrome";

export default async function AdminFoundingPage() {
  await requireDashboardAdmin();
  const deal = await getFoundingDeal();
  const full = deal.remaining === 0 && deal.claimed > 0;

  return (
    <AdminScreen
      kicker="Admin only"
      title="Founding"
      hint="Claimed seats out of 40. This count stays on the coach desk."
    >
      <p className="font-telemetry text-5xl text-[#CBF805]" data-founding-fraction="1">
        {deal.claimed}
        <span className="text-white/40"> / {deal.cap}</span>
      </p>
      <section className="grid grid-cols-2 gap-2">
        <AdminStat label="Claimed" value={String(deal.claimed)} alert={full} />
        <AdminStat label="Remaining" value={String(deal.remaining)} alert={full} />
      </section>
      {deal.rows.length === 0 ? (
        <p className="text-sm text-muted">No founding seats claimed. {deal.remaining} remaining.</p>
      ) : (
        <ul className="space-y-2">
          {deal.rows.map((row) => (
            <li key={row.email} className="hc-panel px-4 py-3">
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-muted">
                {row.email} · {PLAN_CATALOG[row.plan].label}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AdminScreen>
  );
}
