import { Suspense } from "react";
import { MemberFrame } from "@/components/MemberFrame";
import { Celebration } from "@/components/celebration/Celebration";
import { BadgeUnlockOverlay } from "@/components/progress/BadgeUnlockOverlay";
import { requireOnboardedUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { formatGraceDate } from "@/lib/gymdesk/recompute";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOnboardedUser();
  const profile = await getProfileForUser(user.id);
  const graceUntil = profile?.gymMembershipGraceUntil;
  // Request-time check: hide the banner once the grace date has passed.
  // eslint-disable-next-line react-hooks/purity -- grace window is compared to request time
  const nowMs = Date.now();
  const showGrace =
    Boolean(profile?.gymMembershipVerified) &&
    Boolean(graceUntil) &&
    graceUntil!.getTime() > nowMs;

  return (
    <>
      <MemberFrame
        email={user.email}
        role={user.role}
        timeZone={profile?.timeZone}
        graceEndsOn={showGrace && graceUntil ? formatGraceDate(graceUntil) : null}
      >
        {children}
      </MemberFrame>
      <Suspense fallback={null}>
        <Celebration />
      </Suspense>
      <Suspense fallback={null}>
        <BadgeUnlockOverlay />
      </Suspense>
    </>
  );
}
