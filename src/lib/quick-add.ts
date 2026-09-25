/** Hide the floating + when it would cover Send, Start, or the logger. */
export function shouldHideQuickAdd(pathname: string) {
  if (pathname.startsWith("/coach")) return true;
  if (pathname.startsWith("/training/log/")) return true;
  return /^\/training\/[^/]+$/.test(pathname);
}
