import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { joinLaunchWaitlist, waitlistClientIp } from "@/lib/launch-waitlist";
import {
  WAITLIST_ALREADY_MESSAGE,
  WAITLIST_EMAIL_ERROR,
  WAITLIST_GENERIC_ERROR,
} from "@/lib/waitlist-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public. No session. Mailchimp when configured, Postgres backup either way. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: WAITLIST_EMAIL_ERROR }, { status: 400 });
  }

  try {
    const result = await joinLaunchWaitlist({ body, ip: waitlistClientIp(request) });
    if (result.status === "already") {
      return NextResponse.json({ ok: false, error: WAITLIST_ALREADY_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      status: "subscribed",
      firstName: result.firstName,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("waitlist join failed");
    return NextResponse.json({ ok: false, error: WAITLIST_GENERIC_ERROR }, { status: 500 });
  }
}
