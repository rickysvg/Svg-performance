import { getProfileForUser } from "@/lib/profile";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { getAdminDeskCounts } from "@/lib/admin-dashboard";
import { AdminTile } from "@/components/admin/AdminTile";

export default async function AdminPage() {
  const user = await requireDashboardAdmin();
  const [profile, counts] = await Promise.all([
    getProfileForUser(user.id),
    getAdminDeskCounts(),
  ]);
  const name = profile?.displayName?.trim().split(/\s+/)[0] || "Coach";
  const feedbackBadge = counts.feedbackNew + counts.feelFlags;

  return (
    <main className="space-y-6 pb-8" data-admin-desk="1">
      <section className="hc-panel hc-carbon -mx-4 -mt-6 px-4 pb-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="hc-kicker">Coach desk</p>
          <span className="bg-[#CBF805] px-2 py-1 font-telemetry text-[10px] uppercase tracking-[0.16em] text-black">
            <span className="hc-live mr-1 inline-block h-1.5 w-1.5 rounded-full bg-black align-middle" aria-hidden />
            Live
          </span>
        </div>
        <h1 className="mt-3 text-4xl">{name}</h1>
        <p className="mt-2 text-sm text-white/70">One tap. Watch, reply, done.</p>
      </section>

      <section className="grid grid-cols-2 gap-3" data-admin-grid="1">
        <AdminTile
          wide
          href="/admin/form-checks"
          label="Form checks"
          hint={counts.formChecks > 0 ? `${counts.formChecks} waiting` : "Queue is clear"}
          src="/tiles/form-check.webp"
          alt="Athlete filming a form check in a dark gym"
          badge={counts.formChecks}
          alert={counts.formChecks > 0}
        />
        <AdminTile
          href="/coach/checkins"
          label="Check-ins"
          hint={counts.checkInFlags > 0 ? `${counts.checkInFlags} flagged` : "Weekly forms"}
          src="/tiles/calendar.webp"
          alt="Athlete checking off training days on a whiteboard"
          badge={counts.checkIns}
          alert={counts.checkInFlags > 0}
        />
        <AdminTile
          href="/admin/members"
          label="Members"
          hint="Plan, streak, week"
          src="/tiles/progress.webp"
          alt="Athlete standing after a session"
          badge={counts.members}
        />
        <AdminTile
          href="/admin/coaching"
          label="Coaching"
          hint={`${counts.coachingUsed} / ${counts.coachingCap} spots`}
          src="/tiles/coach.webp"
          alt="Coach holding mitts in a dark gym"
          badge={counts.coachingUsed}
          alert={counts.coachingFull}
        />
        <AdminTile
          href="/admin/founding"
          label="Founding"
          hint={`${counts.foundingRemaining} left of ${counts.foundingCap}`}
          icon="founding"
          badge={counts.foundingClaimed}
          alert={counts.foundingRemaining === 0 && counts.foundingClaimed > 0}
        />
        <AdminTile
          href="/admin/revenue"
          label="Revenue"
          hint={counts.activePro > 0 ? `${counts.activePro} active Pro` : "Pro, trials, conversions"}
          icon="revenue"
          badge={counts.activePro}
        />
        <AdminTile
          href="/admin/feedback"
          label="Feedback"
          hint={counts.feelFlags > 0 ? `${counts.feelFlags} session flags` : "Ratings and notes"}
          icon="feedback"
          badge={feedbackBadge}
          alert={counts.feelFlags > 0 || counts.feedbackNew > 0}
        />
        <AdminTile
          href="/admin/content"
          label="Content"
          hint={counts.pendingVideos > 0 ? `${counts.pendingVideos} videos pending` : "Catalog and lessons"}
          src="/tiles/learn.webp"
          alt="Two athletes drilling a takedown"
          badge={counts.pendingVideos}
          alert={counts.pendingVideos > 0}
        />
        <AdminTile
          href="/admin/announcements"
          label="Announce"
          hint="Draft a push or email"
          icon="announce"
        />
      </section>
    </main>
  );
}
