import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export const POLAR_AUTHORIZE_URL = "https://flow.polar.com/oauth2/authorization";
export const POLAR_TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
export const POLAR_API_BASE = "https://www.polaraccesslink.com";

export type PolarFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; body: unknown }>;

export function isPolarConfigured() {
  return Boolean(
    process.env.POLAR_CLIENT_ID &&
      process.env.POLAR_CLIENT_SECRET &&
      process.env.POLAR_REDIRECT_URI,
  );
}

function requirePolarConfig() {
  const clientId = process.env.POLAR_CLIENT_ID ?? "";
  const clientSecret = process.env.POLAR_CLIENT_SECRET ?? "";
  const redirectUri = process.env.POLAR_REDIRECT_URI ?? "";
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      "POLAR",
      "Polar AccessLink is not configured. Add POLAR_CLIENT_ID, POLAR_CLIENT_SECRET, and POLAR_REDIRECT_URI.",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function polarOAuthCookieName() {
  return "polar_oauth_state";
}

export function createPolarOAuthState() {
  const nonce = randomBytes(16).toString("hex");
  const secret = process.env.AUTH_SECRET || "dev-auth-secret";
  const sig = createHmac("sha256", secret).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyPolarOAuthState(value: string | null | undefined) {
  if (!value || !value.includes(".")) return false;
  const [nonce, sig] = value.split(".");
  if (!nonce || !sig) return false;
  const secret = process.env.AUTH_SECRET || "dev-auth-secret";
  const expected = createHmac("sha256", secret).update(nonce).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function buildPolarAuthorizeUrl(state: string) {
  const { clientId, redirectUri } = requirePolarConfig();
  const url = new URL(POLAR_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "accesslink.read_all");
  url.searchParams.set("state", state);
  return url.toString();
}

async function defaultPolarFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

export type PolarTokenResult = {
  accessToken: string;
  tokenType: string;
  polarUserId: string;
  expiresAt: Date | null;
};

export async function exchangePolarCode(
  code: string,
  fetchImpl: PolarFetch = defaultPolarFetch,
): Promise<PolarTokenResult> {
  const { clientId, clientSecret, redirectUri } = requirePolarConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const result = await fetchImpl(POLAR_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json;charset=UTF-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (result.status >= 400) {
    throw new AppError("POLAR", "Polar did not accept the authorization code.");
  }
  const payload = asRecord(result.body);
  const accessToken = String(payload.access_token ?? "");
  if (!accessToken) {
    throw new AppError("POLAR", "Polar token response was missing an access token.");
  }
  const expiresIn = Number(payload.expires_in ?? 0);
  return {
    accessToken,
    tokenType: String(payload.token_type ?? "Bearer"),
    polarUserId: String(payload.x_user_id ?? payload.user_id ?? ""),
    expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

export async function registerPolarUser(
  accessToken: string,
  memberId: string,
  fetchImpl: PolarFetch = defaultPolarFetch,
) {
  const result = await fetchImpl(`${POLAR_API_BASE}/v3/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ "member-id": memberId }),
  });
  if (result.status === 409) {
    return;
  }
  if (result.status >= 400) {
    throw new AppError("POLAR", "Polar user registration failed. Try Connect Polar again.");
  }
}

export async function savePolarConnection(
  userId: string,
  token: PolarTokenResult,
) {
  return prisma.polarConnection.upsert({
    where: { userId },
    create: {
      userId,
      polarUserId: token.polarUserId,
      accessToken: token.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      lastError: "",
    },
    update: {
      polarUserId: token.polarUserId || undefined,
      accessToken: token.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      lastError: "",
    },
  });
}

export async function completePolarOAuth(
  userId: string,
  code: string,
  fetchImpl: PolarFetch = defaultPolarFetch,
) {
  const token = await exchangePolarCode(code, fetchImpl);
  await registerPolarUser(token.accessToken, userId, fetchImpl);
  return savePolarConnection(userId, token);
}

export async function disconnectPolarForUser(userId: string) {
  await prisma.polarConnection.deleteMany({ where: { userId } });
}

export type PolarExercise = {
  id: string;
  startTime: Date;
  endTime: Date;
  avgBpm: number | null;
  maxBpm: number | null;
  zones: [number, number, number, number, number];
};

export type PolarNightly = {
  date: Date;
  bpm: number;
};

export async function fetchPolarExercises(
  accessToken: string,
  fetchImpl: PolarFetch = defaultPolarFetch,
): Promise<PolarExercise[]> {
  const result = await fetchImpl(`${POLAR_API_BASE}/v3/exercises?zones=true`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (result.status >= 400) {
    throw new AppError("POLAR", "Polar exercises were unavailable. Try again later.");
  }
  const rows = asArray(result.body, "exercises");
  return rows.map(parsePolarExercise).filter((row): row is PolarExercise => row !== null);
}

export async function fetchPolarNightlyRecharge(
  accessToken: string,
  fetchImpl: PolarFetch = defaultPolarFetch,
): Promise<PolarNightly[]> {
  const result = await fetchImpl(`${POLAR_API_BASE}/v3/users/nightly-recharge`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (result.status >= 400) {
    return [];
  }
  const rows = asArray(result.body, "recharges");
  const samples: PolarNightly[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    const bpm = Number(record.heart_rate_avg ?? record.heartRateAvg ?? 0);
    const dateRaw = String(record.date ?? "");
    if (!bpm || !dateRaw) continue;
    const date = new Date(`${dateRaw}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    samples.push({ date, bpm: Math.round(bpm) });
  }
  return samples;
}

function parsePolarExercise(raw: unknown): PolarExercise | null {
  const row = asRecord(raw);
  const id = String(row.id ?? row["exercise-id"] ?? "");
  const startRaw = String(row.start_time ?? row.startTime ?? "");
  if (!id || !startRaw) return null;
  const startTime = new Date(startRaw);
  if (Number.isNaN(startTime.getTime())) return null;
  const durationSeconds = parseIsoDurationSeconds(String(row.duration ?? "PT0S"));
  const endRaw = String(row.end_time ?? row.endTime ?? "");
  const endTime = endRaw ? new Date(endRaw) : new Date(startTime.getTime() + durationSeconds * 1000);
  const hr = asRecord(row.heart_rate ?? row.heartRate ?? {});
  const avgBpm = numberOrNull(hr.average);
  const maxBpm = numberOrNull(hr.maximum);
  const zones = parsePolarZones(row.heart_rate_zones ?? row.heartRateZones);
  return {
    id,
    startTime,
    endTime: Number.isNaN(endTime.getTime()) ? startTime : endTime,
    avgBpm,
    maxBpm,
    zones,
  };
}

export function parsePolarZones(raw: unknown): [number, number, number, number, number] {
  const zones: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  if (!raw) return zones;
  const list = Array.isArray(raw) ? raw : asArray(raw, "zone");
  for (const item of list) {
    const zone = asRecord(item);
    const index = Number(zone.index ?? zone.zone ?? 0);
    const seconds = parseIsoDurationSeconds(String(zone["in-zone"] ?? zone.in_zone ?? zone.inZone ?? "PT0S"));
    if (index >= 1 && index <= 5) {
      zones[index - 1] = seconds;
    }
  }
  return zones;
}

export function parseIsoDurationSeconds(value: string) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(value.trim());
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asArray(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  const inner = record[key];
  return Array.isArray(inner) ? inner : [];
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
