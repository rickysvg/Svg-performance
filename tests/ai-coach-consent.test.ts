import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendCoachMessage } from "@/lib/coach/chat";
import { AI_CONSENT_REQUIRED, hasAiCoachConsent, setAiCoachConsent } from "@/lib/coach/consent";
import { AppError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";

describe("AI coach consent", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refuses to send a coach message until the member agrees", async () => {
    const user = await makeUser("consent@example.com");
    await setAiCoachConsent(user.id, false);
    expect(await hasAiCoachConsent(user.id)).toBe(false);
    await expect(
      sendCoachMessage({ userId: user.id, message: "What should I train today?" }),
    ).rejects.toMatchObject({ message: AI_CONSENT_REQUIRED });
    await expect(
      sendCoachMessage({ userId: user.id, message: "What should I train today?" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(await prisma.chatMessage.count()).toBe(0);

    await setAiCoachConsent(user.id, true);
    const sent = await sendCoachMessage({ userId: user.id, message: "What should I train today?" });
    expect(sent.assistant.role).toBe("assistant");
  });
});
