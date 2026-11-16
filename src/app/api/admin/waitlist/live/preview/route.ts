import { NextResponse } from "next/server";
import { requireWaitlistLiveAdmin } from "@/lib/waitlist-live-access";
import { buildWaitlistLiveEmail } from "@/lib/waitlist-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renders the live email HTML. Does not send. */
export async function GET(request: Request) {
  const gate = await requireWaitlistLiveAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const firstName = new URL(request.url).searchParams.get("firstName") ?? "";
  const mail = buildWaitlistLiveEmail(firstName.slice(0, 80));
  return new NextResponse(mail.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
