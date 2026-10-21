import { prisma } from "@/lib/prisma";
import { isDashboardAdmin } from "@/lib/admin-access";
import { AppError } from "@/lib/errors";
import { COACH_CHAT_LOCKED, getEffectivePlanId, tierForPlan, type AppTier } from "@/lib/entitlements";
import {
  ACADEMY_AI_MESSAGES_PER_WEEK,
  PRO_AI_MESSAGES_PER_DAY,
  PRO_READ_ALOUD_PER_DAY,
  PRO_VOICE_MINUTES_PER_DAY,
} from "@/lib/pricing";

/** message = chat or logger note; voice = seconds of coach speech; read_aloud = Today's Summary. */
export type AiUsageKind = "message" | "voice" | "read_aloud";
export type AiUsageSurface = "chat" | "note" | "speak" | "today_summary";

/** Which paywall prompt the client should show. */
export type AiPaywallReason =
  | "locked"
  | "ai_limit"
  | "ai_daily_cap"
  | "voice"
  | "read_aloud";

export class AiCapError extends AppError {
  readonly reason: AiPaywallReason;

  constructor(reason: AiPaywallReason, message: string) {
    super("PAYWALL", message, 402);
    this.name = "AiCapError";
    this.reason = reason;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rolling windows keep the check simple and timezone-safe. */
function since(now: Date, ms: number) {
  return new Date(now.getTime() - ms);
}

export function estimateSpeechSeconds(text: string) {
  // About 15 characters a second for a natural coach voice. Minimum 1 second.
  return Math.max(1, Math.ceil(text.trim().length / 15));
}

async function used(userId: string, kind: AiUsageKind, from: Date) {
  const result = await prisma.aiUsageEvent.aggregate({
    where: { userId, kind, createdAt: { gte: from } },
    _sum: { units: true },
  });
  return result._sum.units ?? 0;
}

export type AiAllowance = {
  tier: AppTier;
  messagesLeft: number;
  messagesWindow: "week" | "day";
  voiceSecondsLeft: number;
  readAloudsLeft: number;
};

export async function getAiAllowance(userId: string, now = new Date()): Promise<AiAllowance> {
  const tier = tierForPlan(await getEffectivePlanId(userId, now));
  if (tier === "pro") {
    const [messages, voice, reads] = await Promise.all([
      used(userId, "message", since(now, DAY_MS)),
      used(userId, "voice", since(now, DAY_MS)),
      used(userId, "read_aloud", since(now, DAY_MS)),
    ]);
    return {
      tier,
      messagesLeft: Math.max(0, PRO_AI_MESSAGES_PER_DAY - messages),
      messagesWindow: "day",
      voiceSecondsLeft: Math.max(0, PRO_VOICE_MINUTES_PER_DAY * 60 - voice),
      readAloudsLeft: Math.max(0, PRO_READ_ALOUD_PER_DAY - reads),
    };
  }
  if (tier === "academy") {
    const messages = await used(userId, "message", since(now, 7 * DAY_MS));
    return {
      tier,
      messagesLeft: Math.max(0, ACADEMY_AI_MESSAGES_PER_WEEK - messages),
      messagesWindow: "week",
      voiceSecondsLeft: 0,
      readAloudsLeft: 0,
    };
  }
  return { tier, messagesLeft: 0, messagesWindow: "week", voiceSecondsLeft: 0, readAloudsLeft: 0 };
}

/**
 * One cap for chat, voice, and the logger note path. Throws AiCapError (402) when the
 * member is over the limit; otherwise records the use.
 */
export async function consumeAiUse(input: {
  userId: string;
  kind: AiUsageKind;
  surface: AiUsageSurface;
  units?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const units = Math.max(1, Math.round(input.units ?? 1));
  const allowance = await getAiAllowance(input.userId, now);
  const staffChat =
    input.kind === "message" &&
    input.surface === "chat" &&
    allowance.tier !== "pro" &&
    (await staffMayChat(input.userId));

  if (allowance.tier === "locked" && !staffChat) {
    throw new AiCapError("locked", "Your trial ended. Subscribe to Pro to keep using SVG Coach.");
  }

  if (input.kind === "message" && input.surface === "chat" && allowance.tier !== "pro" && !staffChat) {
    throw new AiCapError("locked", COACH_CHAT_LOCKED);
  }

  if (input.kind === "message" && !staffChat) {
    if (allowance.messagesLeft < 1) {
      throw allowance.tier === "pro"
        ? new AiCapError(
            "ai_daily_cap",
            `You used today's ${PRO_AI_MESSAGES_PER_DAY} AI messages. It resets tomorrow.`,
          )
        : new AiCapError(
            "ai_limit",
            `You used this week's ${ACADEMY_AI_MESSAGES_PER_WEEK} AI messages. Pro opens daily coach chat.`,
          );
    }
  } else if (input.kind === "voice") {
    if (allowance.tier !== "pro") {
      throw new AiCapError("voice", "Coach voices are in Pro.");
    }
    if (allowance.voiceSecondsLeft < 1) {
      throw new AiCapError(
        "ai_daily_cap",
        `You used today's ${PRO_VOICE_MINUTES_PER_DAY} minutes of voice. It resets tomorrow.`,
      );
    }
  } else if (input.kind === "read_aloud") {
    if (allowance.tier !== "pro") {
      throw new AiCapError("read_aloud", "Hearing today's summary is in Pro.");
    }
    if (allowance.readAloudsLeft < 1) {
      throw new AiCapError(
        "ai_daily_cap",
        `You used today's read-aloud. The written summary stays on Home.`,
      );
    }
  }

  await prisma.aiUsageEvent.create({
    data: { userId: input.userId, kind: input.kind, surface: input.surface, units, createdAt: now },
  });
  return allowance;
}

async function staffMayChat(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  return Boolean(account && isDashboardAdmin(account));
}

/** Shown near coach chat. Pro only when 5 or fewer remain today. Academy always shows the week. */
export function aiRemainingLabel(allowance: Pick<AiAllowance, "tier" | "messagesLeft" | "messagesWindow">) {
  if (allowance.tier === "pro" && allowance.messagesLeft <= 5) {
    return `${allowance.messagesLeft} of ${PRO_AI_MESSAGES_PER_DAY} left today`;
  }
  if (allowance.tier === "academy") {
    return `${allowance.messagesLeft} of ${ACADEMY_AI_MESSAGES_PER_WEEK} left this week`;
  }
  return null;
}
