"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PrimaryNav } from "@/components/PrimaryNav";
import { QuickAddFab } from "@/components/home/QuickAddFab";
import { CoachFab } from "@/components/coach/CoachFab";
import { shouldHideQuickAdd } from "@/lib/quick-add";
import { coachFabClearsBottomBar, shouldShowCoachFab } from "@/lib/coaches";
import { TimeZoneSync } from "@/components/TimeZoneSync";
import { isImmersiveTrainingPath, shouldHidePrimaryNav } from "@/lib/member-nav";
import { GraceBanner } from "@/components/gymdesk/GraceBanner";

export function MemberFrame({
  email,
  role,
  timeZone,
  graceEndsOn,
  coachName,
  coachThumb,
  children,
}: {
  email: string;
  role?: string;
  timeZone?: string | null;
  graceEndsOn?: string | null;
  coachName: string;
  coachThumb: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const immersive = isImmersiveTrainingPath(pathname);
  const hidePrimaryNav = shouldHidePrimaryNav(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <TimeZoneSync savedTimeZone={timeZone} />
      {hidePrimaryNav ? null : <PrimaryNav />}
      <div
        className={
          immersive
            ? "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-36 pt-3"
            : "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 pb-36"
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
        />
      ) : null}
      {immersive ? null : (
        <AppHeader
          email={email}
          role={role}
          placement="bottom"
          currentPath={pathname}
          centerAction={
            shouldHideQuickAdd(pathname) ? (
              <span className="h-10 w-10" aria-hidden />
            ) : (
              <QuickAddFab variant="inline" />
            )
          }
        />
      )}
    </div>
  );
}
