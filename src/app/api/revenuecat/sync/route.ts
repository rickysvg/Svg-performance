import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { applyRevenueCatSubscriber, fetchSubscriber, revenueCatConfigured } from "@/lib/revenuecat";
import { tooSoon } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (!revenueCatConfigured()) {
    return NextResponse.json({ error: "Store billing isn't configured yet." }, { status: 503 });
  }
  if (tooSoon(`revenuecat-sync:${user.id}`, 10_000)) {
    return NextResponse.json({ error: "Wait a moment, then try again." }, { status: 429 });
  }
  try {
    const subscriber = await fetchSubscriber(user.id);
    await applyRevenueCatSubscriber(user.id, subscriber);
  } catch {
    return NextResponse.json({ error: "Could not refresh the subscription." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
