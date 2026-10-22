"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PrimaryNav } from "@/components/PrimaryNav";
import { CoachFab } from "@/components/coach/CoachFab";
import { coachFabClearsBottomBar, shouldShowCoachFab } from "@/lib/coaches";
import { TimeZoneSync } from "@/components/TimeZoneSync";
import { isImmersiveTrainingPath, shouldHidePrimaryNav } from "@/lib/member-nav";
import { GraceBanner } from "@/components/gymdesk/GraceBanner";

export function MemberFrame({
  email,
  role,
  showAdmin = false,
  timeZone,
  graceEndsOn,
  coachName,
  coachThumb,
  coachChatLocked = false,
  children,
}: {
  email: string;
  role?: string;
  showAdmin?: boolean;
  timeZone?: string | null;
  graceEndsOn?: string | null;
  coachName: string;
  coachThumb: string;
  coachChatLocked?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const immersive = isImmersiveTrainingPath(pathname);
  const hidePrimaryNav = shouldHidePrimaryNav(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <TimeZoneSync savedTimeZone={timeZone} />
      {hidePrimaryNav ? null : <PrimaryNav coachLocked={coachChatLocked} />}
      <div
        className={
          immersive
            ? "mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col px-4 pt-3 pb-36 pb-[calc(13rem+env(safe-area-inset-bottom))]"
            : "mx-auto flex w-full min-w-0 max-w-3xl flex-1 flex-col px-4 py-6 pb-36 pb-[calc(13rem+env(safe-area-inset-bottom))]"
        }
      >
        {graceEndsOn ? <GraceBanner endsOn={graceEndsOn} /> : null}
        {children}
      </div>
      {shouldShowCoachFab(pathname) ? (
        <CoachFab
          name={coachName}
          thumb={coachThumb}
          raised={coachFabClearsBottomBar(pathname)}
          locked={coachChatLocked}
        />
      ) : null}
      {immersive ? null : (
        <AppHeader
          email={email}
          role={role}
          showAdmin={showAdmin}
          placement="bottom"
          currentPath={pathname}
        />
      )}
    </div>
  );
}
