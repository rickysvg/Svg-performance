"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PrimaryNav } from "@/components/PrimaryNav";
import { CoachFab } from "@/components/coach/CoachFab";
import { QuickAddFab } from "@/components/home/QuickAddFab";
import { shouldHideQuickAdd } from "@/lib/quick-add";
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
  prompt,
  children,
}: {
  email: string;
  role?: string;
  timeZone?: string | null;
  graceEndsOn?: string | null;
  coachName?: string;
  coachThumb?: string;
  prompt?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const immersive = isImmersiveTrainingPath(pathname);
  const hidePrimaryNav = shouldHidePrimaryNav(pathname);
  const hidePrompt =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/coach" ||
    pathname.startsWith("/coach/");
  const staffDock = role === "admin" || role === "coach";

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
        {prompt && !hidePrompt ? <div className="mb-4">{prompt}</div> : null}
        {children}
      </div>
      {coachName && coachThumb ? (
        <CoachFab name={coachName} thumbSrc={coachThumb} staffDock={staffDock} />
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
