"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PrimaryNav } from "@/components/PrimaryNav";
import { QuickAddFab } from "@/components/home/QuickAddFab";
import { shouldHideQuickAdd } from "@/lib/quick-add";

function isImmersiveTrainingPath(pathname: string) {
  if (pathname.startsWith("/training/log/")) return true;
  if (
    pathname === "/training" ||
    pathname.startsWith("/training/calendar") ||
    pathname.startsWith("/training/history")
  ) {
    return false;
  }
  return /^\/training\/[^/]+$/.test(pathname);
}

export function MemberFrame({
  email,
  role,
  children,
}: {
  email: string;
  role?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const immersive = isImmersiveTrainingPath(pathname);

  return (
    <div className="flex min-h-full flex-col">
      <PrimaryNav />
      <div
        className={
          immersive
            ? "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-28 pt-3"
            : "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 pb-28"
        }
      >
        {children}
      </div>
      {immersive ? null : (
        <div className="sticky bottom-0 z-20">
          <div className="relative">
            {shouldHideQuickAdd(pathname) ? null : <QuickAddFab />}
            <AppHeader email={email} role={role} placement="bottom" currentPath={pathname} />
          </div>
        </div>
      )}
    </div>
  );
}
