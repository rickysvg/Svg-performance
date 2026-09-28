import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/gymdesk/config";
import { timingSafeEqualString } from "@/lib/gymdesk/crypto";
import { runGymdeskDailyCron } from "@/lib/gymdesk/cron";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";
  const expected = cronSecret();
  if (!expected || !timingSafeEqualString(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runGymdeskDailyCron();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
