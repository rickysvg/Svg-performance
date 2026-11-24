import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

/** Signed-in user id for the store app bridge. Null when signed out. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ id: user?.id ?? null });
}
