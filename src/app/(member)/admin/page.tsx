import { getProfileForUser } from "@/lib/profile";
import { requireDashboardAdmin } from "@/lib/admin-access";
import { getAdminDeskCounts } from "@/lib/admin-dashboard";
import { coachingCapacityTone, deskTone } from "@/lib/admin-desk-status";
import { AdminTile } from "@/components/admin/AdminTile";

export default async function AdminPage() {
  const user = await requireDashboardAdmin();
  const [profile, counts] = await Promise.all([
    getProfileForUser(user.id),
    getAdminDeskCounts(),
  ]);
  const name = profile?.displayName?.trim().split(/\s+/)[0] || "Coach";
  const feedbackWaiting = counts.feedbackNew + counts.feelFlags;
  const contentWaiting = counts.pendingVideos + counts.pendingLessons + counts.clipReview;
  const formTone = deskTone(counts.formChecks, counts.formChecksReviewed);
  const checkTone = deskTone(counts.checkIns, counts.checkInsAnswered);
  const coachTone = coachingCapacityTone(counts.coachingUsed, counts.coachingCap);
  const revenueTone = deskTone(counts.failedPayments, counts.paidCurrent);
  const feedbackTone = deskTone(feedbackWaiting, counts.recentRatings + counts.feedbackClosed);
  const contentTone = deskTone(contentWaiting, counts.contentReady);

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
          hint={
            counts.formChecks > 0
              ? `${counts.formChecks} waiting`
              : counts.formChecksReviewed > 0
                ? "Queue is clear"
                : "No clips yet"
          }
          src="/tiles/form-check.webp"
          alt="Athlete filming a form check in a dark gym"
          badge={counts.formChecks}
          tone={formTone}
        />
        <AdminTile
          href="/coach/checkins"
          label="Check-ins"
          hint={
            counts.checkIns > 0
              ? counts.checkInFlags > 0
                ? `${counts.checkInFlags} flagged`
                : `${counts.checkIns} waiting`
              : counts.checkInsAnswered > 0
                ? "All answered"
                : "Weekly forms"
          }
          src="/tiles/calendar.webp"
          alt="Athlete checking off training days on a whiteboard"
          badge={counts.checkIns}
          tone={checkTone}
        />
        <AdminTile
          href="/admin/members"
          label="Members"
          hint="Plan, streak, week"
          src="/tiles/progress.webp"
          alt="Athlete standing after a session"
          tone="idle"
        />
        <AdminTile
          href="/admin/coaching"
          label="VIP Coaching"
          hint={
            coachTone === "attention"
              ? counts.coachingUsed >= counts.coachingCap
                ? `${counts.coachingUsed} / ${counts.coachingCap} full`
                : `${counts.coachingUsed} / ${counts.coachingCap} almost full`
              : `${counts.coachingUsed} / ${counts.coachingCap} spots`
          }
          src="/tiles/coach.webp"
          alt="Coach holding mitts in a dark gym"
          badge={counts.coachingCap - counts.coachingUsed <= 0 ? counts.coachingUsed : counts.coachingCap - counts.coachingUsed}
          tone={coachTone}
        />
        <AdminTile
          href="/admin/revenue"
          label="Revenue"
          hint={
            counts.failedPayments > 0
              ? `${counts.failedPayments} failed`
              : counts.activePro > 0
                ? `${counts.activePro} active Pro`
                : "Pro, trials, conversions"
          }
          icon="revenue"
          badge={counts.failedPayments}
          tone={revenueTone}
        />
        <AdminTile
          href="/admin/feedback"
          label="Feedback"
          hint={
            feedbackWaiting > 0
              ? `${feedbackWaiting} to review`
              : feedbackTone === "clear"
                ? "All caught up"
                : "Ratings and notes"
          }
          icon="feedback"
          badge={feedbackWaiting}
          tone={feedbackTone}
        />
        <AdminTile
          href="/admin/content"
          label="Content"
          hint={
            contentWaiting > 0
              ? `${contentWaiting} to review`
              : contentTone === "clear"
                ? "Catalog is current"
                : "Catalog and lessons"
          }
          src="/tiles/learn.webp"
          alt="Two athletes drilling a takedown"
          badge={contentWaiting}
          tone={contentTone}
        />
        <AdminTile
          href="/admin/announcements"
          label="Announce"
          hint="Draft a push or email"
          icon="announce"
          tone="idle"
        />
      </section>
    </main>
  );
}
