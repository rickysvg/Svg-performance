/** Request header the proxy sets with the member's path. */
export const PATH_HEADER = "x-svg-path";

/**
 * After a nonmember's 7-day trial ends without Pro, these stay open so they can view and
 * export their own past data, manage their account, and subscribe.
 */
const OPEN_WHEN_LOCKED = ["/progress", "/profile", "/plan", "/shop", "/book", "/feedback"];

export function isOpenWhenLocked(pathname: string | null | undefined) {
  if (!pathname) return false;
  return OPEN_WHEN_LOCKED.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** A session that already started can be finished. New starts are blocked before this route. */
export function isResumeLoggerPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return pathname === "/training/log" || pathname.startsWith("/training/log/");
}
