import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { tooSoon } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const PLATFORMS = new Set(["ios", "android"]);
const ENVIRONMENTS = new Set(["production", "sandbox"]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (tooSoon(`native-push:${user.id}`, 10_000)) {
    return NextResponse.json({ error: "Wait a moment, then try again." }, { status: 429 });
  }
  let body: { platform?: unknown; token?: unknown; appVersion?: unknown; environment?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Send the device token." }, { status: 400 });
  }
  const platform = String(body.platform ?? "");
  const token = String(body.token ?? "").trim();
  const environment = String(body.environment ?? "production");
  if (!PLATFORMS.has(platform) || token.length < 20 || token.length > 4096 || !ENVIRONMENTS.has(environment)) {
    return NextResponse.json({ error: "That device token is not valid." }, { status: 400 });
  }
  await prisma.nativePushToken.upsert({
    where: { token },
    create: {
      userId: user.id,
      platform,
      token,
      appVersion: String(body.appVersion ?? "").slice(0, 40),
      environment,
    },
    update: {
      userId: user.id,
      platform,
      appVersion: String(body.appVersion ?? "").slice(0, 40),
      environment,
      lastError: "",
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = String(body.token ?? "").trim();
  } catch {
    token = "";
  }
  if (!token) return NextResponse.json({ error: "Send the device token." }, { status: 400 });
  await prisma.nativePushToken.deleteMany({ where: { userId: user.id, token } });
  return NextResponse.json({ ok: true });
}
