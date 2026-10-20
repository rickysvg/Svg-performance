import { requireDashboardAdmin } from "@/lib/admin-access";
import { getFoundingDeal } from "@/lib/admin-dashboard";
import { PLAN_CATALOG } from "@/lib/plans";
import { AdminScreen, AdminStat } from "@/components/admin/AdminChrome";
import { DeskBadge } from "@/components/admin/DeskStatus";
import { deskSurfaceClass, foundingDealTone } from "@/lib/admin-desk-status";

export default async function AdminFoundingPage() {
  await requireDashboardAdmin();
  const deal = await getFoundingDeal();
  const tone = foundingDealTone(deal.claimed, deal.cap);

  return (
    <AdminScreen
      kicker="Admin only"
      title="Founding"
      hint="Claimed seats out of 40. This count stays on the coach desk."
    >
      <p
        className={`font-telemetry text-5xl ${tone === "clear" ? "text-[#CBF805]" : "text-white"}`}
        data-founding-fraction="1"
        data-desk-tone={tone}
      >
        {deal.claimed}
        <span className="text-white/40"> / {deal.cap}</span>
      </p>
      <section className="grid grid-cols-2 gap-2">
        <AdminStat label="Claimed" value={String(deal.claimed)} tone={tone} />
        <AdminStat label="Remaining" value={String(deal.remaining)} tone={tone} />
      </section>
      {deal.rows.length === 0 ? (
        <p className="text-sm text-muted">No founding seats claimed. {deal.remaining} remaining.</p>
      ) : (
        <ul className="space-y-2">
          {deal.rows.map((row) => (
            <li
              key={row.email}
              data-desk-tone="clear"
              className={`hc-panel flex items-center justify-between gap-3 px-4 py-3 ${deskSurfaceClass("clear")}`}
            >
              <span>
                <span className="block font-semibold">{row.name}</span>
                <span className="text-sm text-muted">
                  {row.email} · {PLAN_CATALOG[row.plan].label}
                </span>
              </span>
              <DeskBadge tone="clear" label="Claimed" />
            </li>
          ))}
        </ul>
      )}
    </AdminScreen>
  );
}
