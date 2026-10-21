import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { YourDataSection } from "@/components/profile/YourDataSection";
import { ReminderPrefsForm } from "@/components/reminders/ReminderPrefsForm";
import { isAdmin, isStaff } from "@/lib/roles";
import { isDashboardAdmin } from "@/lib/admin-access";
import { isFormCheckReviewer } from "@/lib/form-check-access";
import { isFeedbackAdmin } from "@/lib/feedback-access";
import { getOrCreateReminderPrefs, isSmtpReminderDeliveryEnabled } from "@/lib/reminders";
import { EmptyState } from "@/components/EmptyState";
import { currentPlanLine, getTrialState } from "@/lib/trial";
import { MEMBER_PRO_DAYS } from "@/lib/pricing";
import { getEffectivePlanId } from "@/lib/entitlements";
import { PLAN_CATALOG } from "@/lib/plans";
import { LeaderboardOptInForm } from "@/components/profile/LeaderboardOptInForm";
import { SoundEffectsToggle } from "@/components/profile/SoundEffectsToggle";
import { CoachMotivationToggle } from "@/components/profile/CoachMotivationToggle";
import { COACH_WORKOUT_MOTIVATION_ENABLED } from "@/lib/coach/config";
import { prisma } from "@/lib/prisma";
import { isGymdeskSyncEnabled } from "@/lib/gymdesk/config";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, prefs, trial, verifiedEvent, planId] = await Promise.all([
    getProfileForUser(user.id),
    getOrCreateReminderPrefs(user.id),
    getTrialState(user.id),
    prisma.gymMembershipEvent.findFirst({
      where: { userId: user.id, to: "verified" },
      orderBy: { at: "desc" },
    }),
    getEffectivePlanId(user.id),
  ]);
  if (!profile) {
    return (
      <EmptyState title="Profile missing">
        Try logging out and back in.
      </EmptyState>
    );
  }

  return (
    <main className="space-y-3">
      <div>
        <h1 className="text-2xl">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          {user.email}. Intake answers can be edited here anytime.
        </p>
        <p className="mt-3 text-sm" data-current-plan>
          Current plan:{" "}
          <strong>
            {currentPlanLine({
              trialActive: trial.trialActive,
              trialDaysLeft: trial.trialDaysLeft,
              trialLengthDays: trial.trialLengthDays,
              verified: trial.verified,
              planLabel: PLAN_CATALOG[planId].label,
            })}
          </strong>
        </p>
      </div>

      <details className="rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-4 py-4 text-lg font-semibold">Training</summary>
        <div className="space-y-6 px-4 pb-4">
          <ProfileForm profile={profile} email={user.email} />
          {COACH_WORKOUT_MOTIVATION_ENABLED ? (
            <CoachMotivationToggle enabled={profile.coachMotivation} />
          ) : null}
          <SoundEffectsToggle />
          <LeaderboardOptInForm optedIn={profile.leaderboardOptIn} />
        </div>
      </details>

      <details className="rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-4 py-4 text-lg font-semibold">Reminders</summary>
        <div className="px-4 pb-4">
          <ReminderPrefsForm
            prefs={prefs}
            smtpConfigured={isSmtpReminderDeliveryEnabled()}
          />
        </div>
      </details>

      <details className="rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-4 py-4 text-lg font-semibold">Account</summary>
        <div className="space-y-6 px-4 pb-4">
      <details className="rounded-2xl border border-line bg-background">
        <summary className="cursor-pointer px-4 py-3 font-semibold">Academy</summary>
        <div className="space-y-3 px-4 pb-4">
        {profile.gymMembershipVerified ? (
          <p className="text-sm">
            {profile.gymMembershipSource === "admin"
              ? `Verified by an SVG admin on ${
                  (verifiedEvent?.at ?? profile.gymdeskCheckedAt)?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }) ?? "this account"
                }.`
              : `Verified via SVG MMA Academy records on ${
                  (verifiedEvent?.at ?? profile.gymdeskCheckedAt)?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }) ?? "this account"
                }.`}
          </p>
        ) : (
          <p className="text-sm text-muted">
            Not verified as an SVG Academy member yet. Verified members get the core app with their dues and Pro free for {MEMBER_PRO_DAYS} days.
          </p>
        )}
        {isGymdeskSyncEnabled() && !profile.emailVerifiedAt ? (
          <p className="text-sm">
            <Link href="/verify-email" className="text-accent underline-offset-4 hover:underline">
              Confirm your email
            </Link>{" "}
            to match academy records.
          </p>
        ) : null}
        {profile.emailVerifiedAt ? (
          <p className="text-sm text-muted">Email confirmed.</p>
        ) : null}
        <p className="text-xs text-muted">
          Phone is optional and used only to suggest a match against SVG MMA Academy records.
          We store hashed emails and phones from the academy roster — not a copy of that list —
          and we never send data to Gymdesk.
        </p>
        </div>
      </details>

      <ChangePasswordForm />
      <Link
        href="/feedback?from=/profile"
        data-send-feedback
        className="block rounded-2xl border border-line bg-card p-5"
      >
        <h2 className="text-lg">Send feedback</h2>
        <p className="mt-1 text-sm text-muted">Bug, idea, or how a workout felt.</p>
      </Link>
      <section className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-lg">Account</h2>
        <p className="text-sm text-muted">
          Sign out of this device. Your logs stay on the account.
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            data-logout
            className="touch-target w-full rounded-full border border-line font-semibold"
          >
            Log out
          </button>
        </form>
      </section>
      <YourDataSection />

      <section className="space-y-3">
        <h2 className="text-lg">More</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/fight-camp" className="text-accent underline-offset-4 hover:underline">
              Fight camp
            </Link>
          </li>
          <li>
            <Link href="/form-check" className="text-accent underline-offset-4 hover:underline">
              Form check
            </Link>
          </li>
          <li>
            <Link href="/progress" className="text-accent underline-offset-4 hover:underline">
              Progress
            </Link>
          </li>
          <li>
            <Link href="/heart" className="text-accent underline-offset-4 hover:underline">
              Heart rate (Apple Health / Polar)
            </Link>
          </li>
          <li>
            <Link href="/paths" className="text-accent underline-offset-4 hover:underline">
              Training paths
            </Link>
          </li>
          <li>
            <Link href="/journal" className="text-accent underline-offset-4 hover:underline">
              Coaching journal
            </Link>
          </li>
          <li>
            <Link href="/report" className="text-accent underline-offset-4 hover:underline">
              Weekly SVG report
            </Link>
          </li>
          <li>
            <Link href="/plan" className="text-accent underline-offset-4 hover:underline">
              My plan &amp; credits
            </Link>
          </li>
          <li>
            <Link href="/book" className="text-accent underline-offset-4 hover:underline">
              Book with Ricky
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="text-accent underline-offset-4 hover:underline">
              Pricing
            </Link>
          </li>
          {isStaff(user) ? (
            <li>
              <Link href="/staff/reports" className="text-accent underline-offset-4 hover:underline">
                Coach / admin reports
              </Link>
            </li>
          ) : null}
          {isFormCheckReviewer(user) ? (
            <li>
              <Link href="/admin/form-checks" className="text-accent underline-offset-4 hover:underline">
                Form check queue
              </Link>
            </li>
          ) : null}
          {isFeedbackAdmin(user) ? (
            <li>
              <Link href="/admin/feedback" className="text-accent underline-offset-4 hover:underline">
                Feedback inbox
              </Link>
            </li>
          ) : null}
          {isDashboardAdmin(user) ? (
            <li>
              <Link href="/admin" className="text-accent underline-offset-4 hover:underline">
                Admin
              </Link>
            </li>
          ) : null}
          {isAdmin(user) ? (
            <li>
              <Link href="/admin/gymdesk" className="text-accent underline-offset-4 hover:underline">
                Gymdesk roster
              </Link>
            </li>
          ) : null}
        </ul>
      </section>
        </div>
      </details>

      <details className="rounded-2xl border border-line bg-card">
        <summary className="cursor-pointer px-4 py-4 text-lg font-semibold">Sources</summary>
        <div className="space-y-2 px-4 pb-4 text-sm text-muted">
          <p>Joel Jamieson — readiness and conditioning ideas.</p>
          <p>Andy Galpin — sleep and recovery.</p>
          <p>Lachlan James — striker and grappler emphasis.</p>
          <p>Loren Landow — land well before plyo volume.</p>
          <p>SVG writes its own sessions. These are public ideas, not their programs.</p>
        </div>
      </details>
    </main>
  );
}
