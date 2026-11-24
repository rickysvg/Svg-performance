import { createSign } from "node:crypto";
import http2 from "node:http2";
import { prisma } from "@/lib/prisma";

export const APNS_TOPIC = "app.svgperformance";

export type NativePushPayload = {
  title: string;
  body: string;
  url: string;
};

export type NativePushResult = {
  configured: boolean;
  sent: number;
  failed: number;
  removed: number;
  attempted: number;
};

type HttpResult = { status: number; body: string };

export type NativePushTransport = {
  postJson: (url: string, headers: Record<string, string>, body: string) => Promise<HttpResult>;
  postApns: (host: string, deviceToken: string, headers: Record<string, string>, body: string) => Promise<HttpResult>;
};

type FirebaseAccount = { clientEmail: string; privateKey: string; projectId: string };

let googleToken: { value: string; exp: number } | null = null;
let apnsToken: { value: string; exp: number } | null = null;

export function clearNativePushCaches() {
  googleToken = null;
  apnsToken = null;
}

function b64url(input: Buffer | string) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

function signJwt(alg: "RS256" | "ES256", header: object, payload: object, pem: string) {
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign(alg === "RS256" ? "RSA-SHA256" : "SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(alg === "ES256" ? { key: pem, dsaEncoding: "ieee-p1363" } : pem);
  return `${data}.${b64url(signature)}`;
}

function firebaseAccount(): FirebaseAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ?? "";
  if (!projectId || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email?: unknown; private_key?: unknown };
    const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
    const privateKey = typeof parsed.private_key === "string" ? parsed.private_key : "";
    if (!clientEmail || !privateKey.includes("PRIVATE KEY")) return null;
    return { clientEmail, privateKey, projectId };
  } catch {
    return null;
  }
}

function apnsAccount() {
  const keyId = process.env.APNS_KEY_ID?.trim() ?? "";
  const teamId = process.env.APNS_TEAM_ID?.trim() ?? "";
  const raw = process.env.APNS_KEY_P8?.trim() ?? "";
  if (!keyId || !teamId || !raw) return null;
  const pem = raw.replace(/\\n/g, "\n");
  if (!pem.includes("PRIVATE KEY")) return null;
  return { keyId, teamId, pem };
}

export function nativePushConfigured() {
  return { fcm: Boolean(firebaseAccount()), apns: Boolean(apnsAccount()) };
}

export function pushTokenIsDead(status: number, body: string) {
  if (status === 404 || status === 410) return true;
  const text = body.toUpperCase();
  return text.includes("UNREGISTERED") || text.includes("BADDEVICETOKEN");
}

export function fcmMessageBody(token: string, payload: NativePushPayload) {
  return JSON.stringify({
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url, title: payload.title, body: payload.body },
      android: { priority: "HIGH" },
    },
  });
}

export function apnsRequestBody(payload: NativePushPayload) {
  return JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    url: payload.url,
  });
}

export function apnsHost(environment: string) {
  return environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
}

async function googleAccessToken(account: FirebaseAccount, postJson: NativePushTransport["postJson"]) {
  const now = Math.floor(Date.now() / 1000);
  if (googleToken && googleToken.exp - 60 > now) return googleToken.value;
  const assertion = signJwt(
    "RS256",
    { alg: "RS256", typ: "JWT" },
    {
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    account.privateKey,
  );
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }).toString();
  const response = await postJson("https://oauth2.googleapis.com/token", {
    "Content-Type": "application/x-www-form-urlencoded",
  }, body);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Firebase auth failed (${response.status}).`);
  }
  const parsed = JSON.parse(response.body) as { access_token?: unknown; expires_in?: unknown };
  const value = typeof parsed.access_token === "string" ? parsed.access_token : "";
  if (!value) throw new Error("Firebase auth did not return a token.");
  const expiresIn = typeof parsed.expires_in === "number" ? parsed.expires_in : 3600;
  googleToken = { value, exp: now + expiresIn };
  return value;
}

function appleJwt(account: NonNullable<ReturnType<typeof apnsAccount>>) {
  const now = Math.floor(Date.now() / 1000);
  if (apnsToken && apnsToken.exp - 60 > now) return apnsToken.value;
  const value = signJwt(
    "ES256",
    { alg: "ES256", kid: account.keyId },
    { iss: account.teamId, iat: now },
    account.pem,
  );
  apnsToken = { value, exp: now + 50 * 60 };
  return value;
}

function defaultPostJson(url: string, headers: Record<string, string>, body: string): Promise<HttpResult> {
  return fetch(url, { method: "POST", headers, body }).then(async (response) => ({
    status: response.status,
    body: await response.text(),
  }));
}

function defaultPostApns(host: string, deviceToken: string, headers: Record<string, string>, body: string) {
  return new Promise<HttpResult>((resolve, reject) => {
    const client = http2.connect(`https://${host}`);
    const done = (error?: Error, result?: HttpResult) => {
      client.close();
      if (error) reject(error);
      else resolve(result as HttpResult);
    };
    client.on("error", (error) => done(error));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      ...headers,
    });
    const chunks: Buffer[] = [];
    req.on("response", (responseHeaders) => {
      const status = Number(responseHeaders[":status"] ?? 0);
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => done(undefined, { status, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", (error) => done(error));
    req.end(body);
  });
}

const defaultTransport: NativePushTransport = {
  postJson: defaultPostJson,
  postApns: defaultPostApns,
};

export async function sendNativePush(
  userId: string,
  payload: NativePushPayload,
  transport: NativePushTransport = defaultTransport,
): Promise<NativePushResult> {
  const fcm = firebaseAccount();
  const apns = apnsAccount();
  if (!fcm && !apns) {
    return { configured: false, sent: 0, failed: 0, removed: 0, attempted: 0 };
  }
  const tokens = await prisma.nativePushToken.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;
  let removed = 0;
  let attempted = 0;
  let accessToken = "";
  for (const row of tokens) {
    try {
      let result: HttpResult;
      if (row.platform === "android") {
        if (!fcm) continue;
        attempted += 1;
        if (!accessToken) accessToken = await googleAccessToken(fcm, transport.postJson);
        result = await transport.postJson(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(fcm.projectId)}/messages:send`,
          { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          fcmMessageBody(row.token, payload),
        );
      } else if (row.platform === "ios") {
        if (!apns) continue;
        attempted += 1;
        const jwt = appleJwt(apns);
        result = await transport.postApns(apnsHost(row.environment), row.token, {
          authorization: `bearer ${jwt}`,
          "apns-topic": APNS_TOPIC,
          "apns-push-type": "alert",
          "apns-priority": "10",
        }, apnsRequestBody(payload));
      } else {
        continue;
      }
      if (result.status >= 200 && result.status < 300) {
        sent += 1;
        if (row.lastError) {
          await prisma.nativePushToken.update({ where: { id: row.id }, data: { lastError: "" } }).catch(() => undefined);
        }
      } else if (pushTokenIsDead(result.status, result.body)) {
        await prisma.nativePushToken.delete({ where: { id: row.id } }).catch(() => undefined);
        removed += 1;
      } else {
        failed += 1;
        await prisma.nativePushToken
          .update({ where: { id: row.id }, data: { lastError: `HTTP ${result.status}`.slice(0, 200) } })
          .catch(() => undefined);
      }
    } catch {
      failed += 1;
      console.warn("[push] native send failed", { platform: row.platform });
    }
  }
  return { configured: true, sent, failed, removed, attempted };
}
