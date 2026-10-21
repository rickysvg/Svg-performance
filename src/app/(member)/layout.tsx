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
import { getAppTier } from "@/lib/entitlements";
import { ensureMemberProMonth } from "@/lib/trial";
import { isOpenWhenLocked, isResumeLoggerPath, PATH_HEADER } from "@/lib/locked-paths";
import { isDashboardAdmin } from "@/lib/admin-access";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();
  // Verified academy members get one Pro grant, started the first time we see them.
  await ensureMemberProMonth(user.id);
  const profile = await getProfileForUser(user.id);
  const tier = await getAppTier(user.id);
  const pathname = (await headers()).get(PATH_HEADER);
  const dashboardAdmin = isDashboardAdmin(user);
  const staff = user.role === "admin" || user.role === "coach" || dashboardAdmin;
  const locked = tier === "locked" && !staff && !isOpenWhenLocked(pathname);
  const resumeLogger = isResumeLoggerPath(pathname);
  const showFullPaywall = locked && pathname !== "/home" && !resumeLogger;
  const graceUntil = profile?.gymMembershipGraceUntil;
  // Request-time check: hide the banner once the grace date has passed.
  // eslint-disable-next-line react-hooks/purity -- grace window is compared to request time
  const nowMs = Date.now();
  const showGrace =
    Boolean(profile?.gymMembershipVerified) &&
    Boolean(graceUntil) &&
    graceUntil!.getTime() > nowMs;
  const coach = resolveAiCoach(profile?.aiCoachId);

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
      >
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
