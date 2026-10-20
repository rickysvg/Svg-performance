import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/gymdesk/config";
import { timingSafeEqualString } from "@/lib/gymdesk/crypto";
import { runCoachProactiveCron, runCoachRecapCron } from "@/lib/coach/auto-notes";
import { runWeeklyCheckInCron } from "@/lib/weekly-checkin-cron";

export const runtime = "nodejs";

async function handle(request: Request) {
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  const expected = cronSecret();
  if (!expected || !timingSafeEqualString(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runWeeklyCheckInCron();
  const coachRecap = await runCoachRecapCron().catch(() => ({ error: true }));
  const coachProactive = await runCoachProactiveCron().catch(() => ({ error: true }));
  return NextResponse.json({ ...result, coachRecap, coachProactive });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
