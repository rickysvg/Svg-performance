import Link from "next/link";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { AdminScreen, AdminStat } from "@/components/admin/AdminChrome";
import { deskSurfaceClass } from "@/lib/admin-desk-status";
import { vipQueueTone } from "@/lib/vip-coaching";
import { getVipDesk } from "@/lib/vip-store";
import { VipReviewButtons } from "@/components/vip/VipReviewButtons";

export default async function AdminVipPage() {
  await requireDashboardAdmin();
  const now = new Date();
  const desk = await getVipDesk(now);
  const tone = vipQueueTone({
    pending: desk.pending,
    reviewed: desk.reviewed,
    active: desk.reserved,
    cap: desk.cap,
  });

  return (
    <AdminScreen
      kicker="VIP"
      title="VIP Coaching"
      hint="Active clients, this week's new clients, fight camp, and applications. Spot counts stay on this desk."
    >
      <section className="grid grid-cols-2 gap-2" data-vip-queue="1">
        <AdminStat label="Active" value={`${desk.active}/${desk.cap}`} tone={tone} />
        <AdminStat label="New this week" value={`${desk.newThisWeek}/${desk.weeklyCap}`} />
        <AdminStat label="In camp" value={`${desk.inCamp}/${desk.campCap}`} tone={desk.inCamp >= desk.campCap ? "attention" : "idle"} />
        <AdminStat
          label="Pending"
          value={`${desk.pending}`}
          tone={desk.pending > 0 ? "attention" : desk.reviewed > 0 ? "clear" : "idle"}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Applications</h2>
        {desk.applications.length === 0 ? (
          <p className={`rounded-2xl px-4 py-4 text-sm ${deskSurfaceClass(desk.reviewed > 0 ? "clear" : "idle")}`}>
            {desk.reviewed > 0 ? "Caught up. No applications waiting." : "No applications yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {desk.applications.map((row) => (
              <li key={row.id} className="space-y-3 rounded-2xl border border-[#FF3B3B]/50 bg-black px-4 py-4 text-white">
                <div>
                  <p className="font-display text-2xl uppercase leading-tight">
                    {row.user.profile?.displayName || row.user.email}
                  </p>
                  <p className="text-sm text-white/70">{row.user.email}</p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-[#CBF805]">Goals</dt>
                    <dd>{row.goals}</dd>
                  </div>
                  <div>
                    <dt className="text-[#CBF805]">Experience</dt>
                    <dd>{row.experience}</dd>
                  </div>
                  <div>
                    <dt className="text-[#CBF805]">Fight date</dt>
                    <dd>{row.fightDate || "None on the calendar"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#CBF805]">Injuries</dt>
                    <dd>{row.injuries}</dd>
                  </div>
                  <div>
                    <dt className="text-[#CBF805]">Availability</dt>
                    <dd>{row.availability}</dd>
                  </div>
                </dl>
                <VipReviewButtons applicationId={row.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Waitlist</h2>
        {desk.waitlist.length === 0 ? (
          <p className="text-sm text-muted">No one is waiting.</p>
        ) : (
          <ul className="space-y-2">
            {desk.waitlist.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
                <p className="font-medium">{row.user.profile?.displayName || row.user.email}</p>
                <p className="text-muted">{row.user.email}</p>
                <p className="mt-1 text-muted">
                  {row.holdUntil && row.holdUntil.getTime() > now.getTime()
                    ? `Held until ${row.holdUntil.toISOString().slice(0, 16).replace("T", " ")} UTC`
                    : "Waiting"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg">Active clients</h2>
        {desk.clients.length === 0 ? (
          <p className="text-sm text-muted">No active VIP Coaching clients.</p>
        ) : (
          <ul className="space-y-2">
            {desk.clients.map((row) => (
              <li key={row.userId}>
                <Link href={`/admin/members/${row.userId}`} className="block rounded-2xl border border-line px-4 py-3">
                  <span className="block font-medium">{row.user.profile?.displayName || row.user.email}</span>
                  <span className="block text-sm text-muted">{row.user.email}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminScreen>
  );
}
