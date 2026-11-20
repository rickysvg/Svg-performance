import { NextResponse } from "next/server";
import { WAITLIST_CLOSED_MESSAGE } from "@/lib/public-waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gone() {
  return NextResponse.json(
    { ok: false, error: WAITLIST_CLOSED_MESSAGE },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}

/** Drop the payload so a signup body is never parsed. */
async function closed(request?: Request) {
  await request?.body?.cancel().catch(() => undefined);
  return gone();
}

/** Public join is closed. Does not insert a row or send mail. */
export function POST(request: Request) {
  return closed(request);
}

export function GET(request: Request) {
  return closed(request);
}
