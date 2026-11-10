/** Request header the proxy sets with the member's path. */
export const PATH_HEADER = "x-svg-path";

/**
 * After a nonmember's trial ends unpaid, or Pro locks for non-payment, Train, logging,
 * timers, and the AI coach stay closed. History and progress stay open and read-only.
 * Downloads and exports stay closed. Academy members are not on this lock.
 */
const OPEN_WHEN_LOCKED = [
  "/progress",
  "/training/history",
  "/profile",
  "/plan",
  "/shop",
  "/book",
  "/feedback",
  "/vip",
];

export function isOpenWhenLocked(pathname: string | null | undefined) {
  if (!pathname) return false;
  return OPEN_WHEN_LOCKED.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** A session that already started can be finished. New starts are blocked before this route. */
export function isResumeLoggerPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return pathname === "/training/log" || pathname.startsWith("/training/log/");
}
