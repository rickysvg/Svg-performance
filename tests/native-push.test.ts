import { generateKeyPairSync } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { DELETE, POST } from "@/app/api/push/native/route";
import {
  clearNativePushCaches,
  sendNativePush,
  type NativePushTransport,
} from "@/lib/native-push";
import { clearRateLimits } from "@/lib/rate-limit-memory";
import { getCurrentUser } from "@/lib/session";
import { makeUser, resetDatabase } from "./helpers";

vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

const currentUser = vi.mocked(getCurrentUser);

function rsaPem() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function ecPem() {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

describe("native push", () => {
  const calls: Array<{ kind: string; url: string; body: string; headers: Record<string, string> }> = [];

  beforeEach(async () => {
    await resetDatabase();
    clearRateLimits();
    clearNativePushCaches();
    calls.length = 0;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.APNS_KEY_ID;
    delete process.env.APNS_TEAM_ID;
    delete process.env.APNS_KEY_P8;
  });

  afterEach(() => {
    clearNativePushCaches();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function transport(status = 200): NativePushTransport {
    return {
      postJson: async (url, headers, body) => {
        calls.push({ kind: "json", url, body, headers });
        if (url.includes("oauth2.googleapis.com")) {
          return { status: 200, body: JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }) };
        }
        return { status, body: status === 404 ? JSON.stringify({ error: { details: [{ errorCode: "UNREGISTERED" }] } }) : "" };
      },
      postApns: async (host, deviceToken, headers, body) => {
        calls.push({ kind: "apns", url: `https://${host}/3/device/${deviceToken}`, body, headers });
        return { status, body: status === 410 ? JSON.stringify({ reason: "BadDeviceToken" }) : "" };
      },
    };
  }

  it("does nothing when credentials are missing", async () => {
    const user = await makeUser("push-empty@example.com");
    await prisma.nativePushToken.create({
      data: { userId: user.id, platform: "ios", token: "a".repeat(64) },
    });
    const result = await sendNativePush(user.id, { title: "Go", body: "Train", url: "/plan" }, transport());
    expect(result).toMatchObject({ configured: false, sent: 0, attempted: 0 });
    expect(calls).toHaveLength(0);
    expect(await prisma.nativePushToken.count()).toBe(1);
  });

  it("builds FCM and APNs requests and drops a dead token", async () => {
    const user = await makeUser("push-send@example.com");
    process.env.FIREBASE_PROJECT_ID = "svg-performance";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "push@svg-performance.iam.gserviceaccount.com",
      private_key: rsaPem(),
    });
    process.env.APNS_KEY_ID = "KEYID12345";
    process.env.APNS_TEAM_ID = "TEAMID1234";
    process.env.APNS_KEY_P8 = ecPem();
    const ios = "b".repeat(64);
    const android = "c".repeat(40);
    await prisma.nativePushToken.createMany({
      data: [
        { userId: user.id, platform: "ios", token: ios, environment: "sandbox" },
        { userId: user.id, platform: "android", token: android },
      ],
    });
    const sent = await sendNativePush(user.id, { title: "Check-in", body: "Sunday", url: "/plan" }, transport(200));
    expect(sent.sent).toBe(2);
    const fcm = calls.find((call) => call.url.includes("fcm.googleapis.com"));
    const apns = calls.find((call) => call.kind === "apns");
    expect(fcm?.url).toBe("https://fcm.googleapis.com/v1/projects/svg-performance/messages:send");
    expect(fcm?.headers.Authorization).toBe("Bearer ya29.test");
    expect(JSON.parse(fcm?.body ?? "{}").message.token).toBe(android);
    expect(apns?.url).toContain("api.sandbox.push.apple.com");
    expect(apns?.headers["apns-topic"]).toBe("app.svgperformance");
    expect(JSON.parse(apns?.body ?? "{}").url).toBe("/plan");

    calls.length = 0;
    clearNativePushCaches();
    const pruned = await sendNativePush(user.id, { title: "Check-in", body: "Sunday", url: "/plan" }, transport(410));
    expect(pruned.removed).toBe(2);
    expect(await prisma.nativePushToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it("requires a signed-in user and reassigns a token to the current account", async () => {
    const first = await makeUser("push-first@example.com");
    const second = await makeUser("push-second@example.com");
    const token = "d".repeat(32);
    currentUser.mockResolvedValueOnce(null);
    const signedOut = await POST(
      new Request("https://svgperformance.app/api/push/native", {
        method: "POST",
        body: JSON.stringify({ platform: "ios", token }),
      }),
    );
    expect(signedOut.status).toBe(401);

    currentUser.mockResolvedValue(second);
    const bad = await POST(
      new Request("https://svgperformance.app/api/push/native", {
        method: "POST",
        body: JSON.stringify({ platform: "web", token: "short" }),
      }),
    );
    expect(bad.status).toBe(400);

    clearRateLimits();
    currentUser.mockResolvedValue(first);
    expect(
      (
        await POST(
          new Request("https://svgperformance.app/api/push/native", {
            method: "POST",
            body: JSON.stringify({ platform: "android", token, appVersion: "1.0" }),
          }),
        )
      ).status,
    ).toBe(200);
    clearRateLimits();
    currentUser.mockResolvedValue(second);
    expect(
      (
        await POST(
          new Request("https://svgperformance.app/api/push/native", {
            method: "POST",
            body: JSON.stringify({ platform: "android", token }),
          }),
        )
      ).status,
    ).toBe(200);
    const row = await prisma.nativePushToken.findUnique({ where: { token } });
    expect(row?.userId).toBe(second.id);

    const removed = await DELETE(
      new Request("https://svgperformance.app/api/push/native", {
        method: "DELETE",
        body: JSON.stringify({ token }),
      }),
    );
    expect(removed.status).toBe(200);
    expect(await prisma.nativePushToken.findUnique({ where: { token } })).toBeNull();
  });
});
