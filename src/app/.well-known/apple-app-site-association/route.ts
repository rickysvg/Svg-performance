import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@/lib/native-app";

// iOS universal links for the store app. 404 until APPLE_TEAM_ID is set in Vercel.
export function GET() {
  const body = appleAppSiteAssociation(process.env.APPLE_TEAM_ID);
  if (!body) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
