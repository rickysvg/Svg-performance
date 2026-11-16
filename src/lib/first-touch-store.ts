import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  FIRST_TOUCH_COOKIE,
  parseStoredFirstTouch,
  type FirstTouch,
} from "@/lib/first-touch";

function logFirstTouchFailure(scope: string, error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  let code = "";
  if (error && typeof error === "object" && "code" in error) {
    const value = (error as { code?: unknown }).code;
    if (typeof value === "string" || typeof value === "number") code = String(value);
  }
  console.error(`first-touch ${scope} failed`, name, code);
}

function outsideRequest(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /outside a request|cookies\(\)|Dynamic server usage/i.test(error.message);
}

export function firstTouchData(record: FirstTouch) {
  return {
    utmSource: record.utmSource,
    utmMedium: record.utmMedium,
    utmCampaign: record.utmCampaign,
    utmContent: record.utmContent,
    utmTerm: record.utmTerm,
    referrer: record.referrer,
    landingPath: record.landingPath,
    firstTouchAt: new Date(record.firstTouchAt),
  };
}

export async function readRequestFirstTouch(): Promise<FirstTouch | null> {
  try {
    const jar = await cookies();
    return parseStoredFirstTouch(jar.get(FIRST_TOUCH_COOKIE)?.value ?? null);
  } catch (error) {
    if (!outsideRequest(error)) logFirstTouchFailure("read", error);
    return null;
  }
}

/** Writes only while firstTouchAt is still null. Failures are logged and swallowed. */
export async function saveUserFirstTouch(userId: string, record: FirstTouch): Promise<void> {
  try {
    if (!userId || Number.isNaN(new Date(record.firstTouchAt).getTime())) return;
    await prisma.profile.updateMany({
      where: { userId, firstTouchAt: null },
      data: firstTouchData(record),
    });
  } catch (error) {
    logFirstTouchFailure("user", error);
  }
}

/** Writes only while firstTouchAt is still null. Failures are logged and swallowed. */
export async function saveWaitlistFirstTouch(email: string, record: FirstTouch): Promise<void> {
  try {
    if (!email || Number.isNaN(new Date(record.firstTouchAt).getTime())) return;
    await prisma.waitlistSignup.updateMany({
      where: { email, firstTouchAt: null },
      data: firstTouchData(record),
    });
  } catch (error) {
    logFirstTouchFailure("waitlist", error);
  }
}

/** Every account-creation path calls this after the user row exists. */
export async function persistUserFirstTouch(userId: string): Promise<void> {
  try {
    const record = await readRequestFirstTouch();
    if (!record) return;
    await saveUserFirstTouch(userId, record);
  } catch (error) {
    logFirstTouchFailure("user", error);
  }
}

export async function persistWaitlistFirstTouch(email: string): Promise<void> {
  try {
    const record = await readRequestFirstTouch();
    if (!record) return;
    await saveWaitlistFirstTouch(email, record);
  } catch (error) {
    logFirstTouchFailure("waitlist", error);
  }
}
