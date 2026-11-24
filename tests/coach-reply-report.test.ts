import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendCoachMessage } from "@/lib/coach/chat";
import { listCoachReplyReports, reportCoachReply } from "@/lib/coach-reply-report";
import { ForbiddenError } from "@/lib/errors";
import { setMailSenderForTests, type MailInput } from "@/lib/mail";
import { makeUser, resetDatabase } from "./helpers";

describe("AI coach reply reports", () => {
  const mail: MailInput[] = [];

  beforeEach(async () => {
    await resetDatabase();
    mail.length = 0;
    process.env.SMTP_HOST = "smtp.example.com";
    setMailSenderForTests(async (input) => {
      mail.push(input);
      return { sent: true, reason: "sent" };
    });
  });

  afterAll(async () => {
    setMailSenderForTests(null);
    delete process.env.SMTP_HOST;
    await prisma.$disconnect();
  });

  it("lets a member report their own reply once and lists it for an admin", async () => {
    const member = await makeUser("reporter@example.com");
    const other = await makeUser("other-reporter@example.com");
    const sent = await sendCoachMessage({ userId: member.id, message: "How should I warm up?" });
    const first = await reportCoachReply({
      userId: member.id,
      messageId: sent.assistant.id,
      reason: "wrong",
      note: "The sets were off.",
    });
    const again = await reportCoachReply({
      userId: member.id,
      messageId: sent.assistant.id,
      reason: "wrong",
    });
    expect(first.already).toBe(false);
    expect(again.already).toBe(true);
    expect(await prisma.coachReplyReport.count()).toBe(1);
    expect(mail).toHaveLength(1);
    expect(mail[0]?.subject).toBe("AI coach reply reported");
    expect(mail[0]?.text).not.toContain(sent.assistant.content);

    await expect(
      reportCoachReply({ userId: other.id, messageId: sent.assistant.id, reason: "offensive" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const open = await listCoachReplyReports("open");
    expect(open.map((row) => row.id)).toEqual([first.id]);
  });
});
