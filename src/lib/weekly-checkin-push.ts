import { prisma } from "@/lib/prisma";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:coach@svg-performance.vercel.app";
  return {
    publicKey,
    privateKey,
    subject,
    configured: Boolean(publicKey && privateKey),
  };
}

function statusCodeOf(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  const code = (error as { statusCode?: unknown }).statusCode;
  return typeof code === "number" ? code : null;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const config = vapidConfig();
  if (!config.configured) {
    return { sent: 0, failed: 0, removed: 0, configured: false };
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) {
    return { sent: 0, failed: 0, removed: 0, configured: true };
  }
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      sent += 1;
    } catch (error) {
      const status = statusCodeOf(error);
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        removed += 1;
      } else {
        failed += 1;
        console.warn("[check-in] push failed", { status });
      }
    }
  }
  return { sent, failed, removed, configured: true };
}

export async function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}) {
  const endpoint = input.endpoint.trim();
  const p256dh = input.p256dh.trim();
  const auth = input.auth.trim();
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    throw new Error("That push subscription is incomplete.");
  }
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: input.userId,
      endpoint,
      p256dh,
      auth,
      userAgent: input.userAgent.slice(0, 200),
    },
    update: {
      userId: input.userId,
      p256dh,
      auth,
      userAgent: input.userAgent.slice(0, 200),
    },
  });
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}
