import { isWorkoutDonePath } from "@/lib/member-nav";

/** Hide the floating + when it would cover Send, Start, or the logger. */
export function shouldHideQuickAdd(pathname: string) {
  if (pathname.startsWith("/coach")) return true;
  if (isWorkoutDonePath(pathname)) return false;
  if (pathname.startsWith("/training/log/")) return true;
  return /^\/training\/[^/]+$/.test(pathname);
}
