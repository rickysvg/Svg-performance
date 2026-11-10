import { Suspense } from "react";
import { MemberFrame } from "@/components/MemberFrame";
import { Celebration } from "@/components/celebration/Celebration";
import { BadgeUnlockOverlay } from "@/components/progress/BadgeUnlockOverlay";
import { requireOnboardedUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { formatGraceDate } from "@/lib/gymdesk/recompute";
import { needsCoachChoicePrompt, resolveAiCoach } from "@/lib/coaches";
import { CoachChoicePrompt } from "@/components/coach/CoachChoicePrompt";
import { PrimeCoachAudio } from "@/components/coach/PrimeCoachAudio";
import { headers } from "next/headers";
import { TrialEndedPaywall } from "@/components/upgrade/TrialEndedPaywall";
import { MemberProReminderBanner } from "@/components/upgrade/MemberProReminderBanner";
import { NonmemberTrialReminderBanner } from "@/components/upgrade/NonmemberTrialReminderBanner";
import { StripeTrialBanner } from "@/components/upgrade/StripeTrialBanner";
import { BillingProblemBanner } from "@/components/billing/BillingProblemBanner";
import { getAppTier } from "@/lib/entitlements";
import { ensureMemberProMonth, getTrialState } from "@/lib/trial";
import { getLatestSubscription } from "@/lib/access";
import { subscriptionGrantsAccess, subscriptionNeedsBillingBanner } from "@/lib/subscription-access";
import { isOpenWhenLocked, PATH_HEADER } from "@/lib/locked-paths";
import { SubscribeToTrainBanner } from "@/components/upgrade/SubscribeToTrainBanner";
import { isDashboardAdmin } from "@/lib/admin-access";
import { getCoachChatAccess } from "@/lib/coach-access";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();
  // Verified academy members get one Pro grant, started the first time we see them.
  await ensureMemberProMonth(user.id);
  const profile = await getProfileForUser(user.id);
  const [tier, trial, subscription] = await Promise.all([
    getAppTier(user.id),
    getTrialState(user.id),
    getLatestSubscription(user.id),
  ]);
  const pathname = (await headers()).get(PATH_HEADER);
  const dashboardAdmin = isDashboardAdmin(user);
  const staff = user.role === "admin" || user.role === "coach" || dashboardAdmin;
  const accountLocked = tier === "locked" && !staff;
  const locked = accountLocked && !isOpenWhenLocked(pathname);
  const showFullPaywall = locked && pathname !== "/home";
  const graceUntil = profile?.gymMembershipGraceUntil;
  // Request-time check: hide the banner once the grace date has passed.
  // eslint-disable-next-line react-hooks/purity -- grace window is compared to request time
  const nowMs = Date.now();
  const showGrace =
    Boolean(profile?.gymMembershipVerified) &&
    Boolean(graceUntil) &&
    graceUntil!.getTime() > nowMs;
  const coach = resolveAiCoach(profile?.aiCoachId);
  const coachChat = await getCoachChatAccess(user);

  return (
    <>
      <MemberFrame
        email={user.email}
        role={user.role}
        showAdmin={dashboardAdmin}
        timeZone={profile?.timeZone}
        graceEndsOn={showGrace && graceUntil ? formatGraceDate(graceUntil) : null}
        coachName={coach.name}
        coachThumb={coach.circle}
        coachChatLocked={!coachChat.allowed}
      >
        {accountLocked ? <SubscribeToTrainBanner /> : null}
        {subscription && subscriptionNeedsBillingBanner(subscription.status) && subscription.stripeCustomerId ? (
          <BillingProblemBanner status={subscription.status} />
        ) : null}
        {pathname === "/home" && subscription?.status === "trialing" && subscription.trialEnd ? (
          <StripeTrialBanner trialEnd={subscription.trialEnd} />
        ) : null}
        {!trial.verified &&
        trial.trialActive &&
        !profile?.memberProStartedAt &&
        !(subscription && subscriptionGrantsAccess(subscription.status, subscription.currentPeriodEnd)) ? (
          <NonmemberTrialReminderBanner daysLeft={trial.trialDaysLeft} />
        ) : null}
        {profile?.gymMembershipVerified &&
        profile.memberProStartedAt &&
        (pathname === "/home" || pathname === "/plan") ? (
          <MemberProReminderBanner
            memberProStartedAt={profile.memberProStartedAt}
            memberProDays={profile.memberProDays}
            tier={tier}
            userId={user.id}
          />
        ) : null}
        {showFullPaywall ? <TrialEndedPaywall /> : children}
      </MemberFrame>
      {needsCoachChoicePrompt(profile) ? <CoachChoicePrompt /> : null}
      <Suspense fallback={null}>
        <Celebration />
      </Suspense>
      <Suspense fallback={null}>
        <BadgeUnlockOverlay />
      </Suspense>
      <PrimeCoachAudio />
    </>
  );
}
