/**
 * The public launch list is closed. /waitlist permanently redirects to /register.
 * next.config uses PUBLIC_WAITLIST_REDIRECT (308, query passed through).
 * The route handler uses publicWaitlistRedirect for the same Location.
 */

export const PUBLIC_WAITLIST_REDIRECT = {
  source: "/waitlist",
  destination: "/register",
  permanent: true,
} as const;

export const WAITLIST_CLOSED_MESSAGE = "The waitlist is closed.";

export function publicWaitlistRedirect(
  requestUrl: string,
): { status: 308; location: string } | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  if (pathname !== PUBLIC_WAITLIST_REDIRECT.source) return null;
  const dest = new URL(PUBLIC_WAITLIST_REDIRECT.destination, url.origin);
  dest.search = url.search;
  return { status: 308, location: dest.toString() };
}
