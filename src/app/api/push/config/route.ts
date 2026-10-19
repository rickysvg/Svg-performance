import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { vapidConfig } from "@/lib/weekly-checkin-push";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const config = vapidConfig();
  return NextResponse.json({
    configured: config.configured,
    publicKey: config.configured ? config.publicKey : "",
  });
}
