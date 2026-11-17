import { NextResponse } from "next/server";
import { publicWaitlistRedirect } from "@/lib/public-waitlist";

export const dynamic = "force-dynamic";

/** 308 to /register, including the query string. next.config redirects first. */
function redirectWaitlist(request: Request) {
  const result = publicWaitlistRedirect(request.url);
  if (!result) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(result.location, result.status);
}

export function GET(request: Request) {
  return redirectWaitlist(request);
}

export function HEAD(request: Request) {
  return redirectWaitlist(request);
}
