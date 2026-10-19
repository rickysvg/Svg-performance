import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { deletePushSubscription, savePushSubscription } from "@/lib/weekly-checkin-push";
import { weeklyCheckInAllowed } from "@/lib/weekly-checkin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (!(await weeklyCheckInAllowed(user.id))) {
    return NextResponse.json({ error: "Weekly check-ins are on coaching plans." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the push subscription." }, { status: 400 });
  }
  const record = body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  try {
    await savePushSubscription({
      userId: user.id,
      endpoint: String(record.endpoint ?? ""),
      p256dh: String(record.keys?.p256dh ?? ""),
      auth: String(record.keys?.auth ?? ""),
      userAgent: request.headers.get("user-agent") ?? "",
    });
  } catch {
    return NextResponse.json({ error: "That push subscription is incomplete." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    endpoint = String(body.endpoint ?? "");
  } catch {
    endpoint = "";
  }
  if (endpoint) await deletePushSubscription(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
