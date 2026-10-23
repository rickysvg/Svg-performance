import { prisma } from "@/lib/prisma";
import { catalogPlanFromStored } from "@/lib/pro-annual-record";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { sendPushToUser, vapidConfig } from "@/lib/weekly-checkin-push";

export const ANNOUNCEMENT_CONFIRM = "send";
export const ANNOUNCEMENT_MAX_RECIPIENTS = 300;

const AUDIENCES = ["members", "academy", "pro", "coaching"] as const;
const CHANNELS = ["push", "email", "both"] as const;

export type AnnouncementAudience = (typeof AUDIENCES)[number];
export type AnnouncementChannel = (typeof CHANNELS)[number];

export type AnnouncementDraft = {
  audience: AnnouncementAudience;
  channel: AnnouncementChannel;
  subject: string;
  body: string;
};

export function validateAnnouncementDraft(input: {
  confirm: string;
  audience: string;
  channel: string;
  subject: string;
  body: string;
}): { ok: true; draft: AnnouncementDraft } | { ok: false; error: string } {
  if (input.confirm !== ANNOUNCEMENT_CONFIRM) {
    return { ok: false, error: "Review the draft, then confirm before it sends." };
  }
  if (!AUDIENCES.includes(input.audience as AnnouncementAudience)) {
    return { ok: false, error: "Pick who this goes to." };
  }
  if (!CHANNELS.includes(input.channel as AnnouncementChannel)) {
    return { ok: false, error: "Pick push, email, or both." };
  }
  const subject = input.subject.trim().replace(/\s+/g, " ");
  const body = input.body.trim();
  if (subject.length < 2 || subject.length > 80) {
    return { ok: false, error: "Subject needs 2–80 characters." };
  }
  if (body.length < 2 || body.length > 500) {
    return { ok: false, error: "Message needs 2–500 characters." };
  }
  return {
    ok: true,
    draft: {
      audience: input.audience as AnnouncementAudience,
      channel: input.channel as AnnouncementChannel,
      subject,
      body,
    },
  };
}

async function loadAudience(audience: AnnouncementAudience) {
  if (audience === "members") {
    return prisma.user.findMany({
      where: { role: "member" },
      select: { id: true, email: true },
    });
  }
  if (audience === "academy") {
    return prisma.user.findMany({
      where: { role: "member", profile: { gymMembershipVerified: true } },
      select: { id: true, email: true },
    });
  }
  const planId = audience === "coaching" ? "coaching" : "performance";
  const subs = await prisma.subscription.findMany({
    where: { status: "active", user: { role: "member" } },
    select: {
      userId: true,
      plan: true,
      founding: true,
      currentPeriodEnd: true,
      user: { select: { id: true, email: true } },
    },
  });
  const now = Date.now();
  const seen = new Set<string>();
  const rows: { id: string; email: string }[] = [];
  for (const sub of subs) {
    if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < now) continue;
    if (catalogPlanFromStored(sub) !== planId) continue;
    if (seen.has(sub.userId)) continue;
    seen.add(sub.userId);
    rows.push(sub.user);
  }
  return rows;
}

export async function deliverAnnouncement(draft: AnnouncementDraft) {
  const wantsEmail = draft.channel !== "push";
  const wantsPush = draft.channel !== "email";
  const emailReady = isSmtpConfigured();
  const pushReady = vapidConfig().configured;
  if ((wantsEmail && !emailReady) && (wantsPush && !pushReady)) {
    return { ok: false as const, error: "Push and email aren't set up yet." };
  }
  if (wantsEmail && !emailReady && !wantsPush) {
    return { ok: false as const, error: "Email isn't set up yet." };
  }
  if (wantsPush && !pushReady && !wantsEmail) {
    return { ok: false as const, error: "Push isn't set up yet." };
  }
  const users = await loadAudience(draft.audience);
  if (users.length === 0) {
    return { ok: false as const, error: "No members in that group." };
  }
  if (users.length > ANNOUNCEMENT_MAX_RECIPIENTS) {
    return {
      ok: false as const,
      error: `That group is ${users.length} people. Narrow it below ${ANNOUNCEMENT_MAX_RECIPIENTS}.`,
    };
  }
  let emailed = 0;
  let pushed = 0;
  for (const user of users) {
    if (wantsEmail && emailReady) {
      const result = await sendMail({
        to: user.email,
        subject: draft.subject,
        text: draft.body,
      });
      if (result.sent) emailed += 1;
    }
    if (wantsPush && pushReady) {
      const result = await sendPushToUser(user.id, {
        title: draft.subject,
        body: draft.body,
        url: "/home",
      });
      pushed += result.sent;
    }
  }
  return {
    ok: true as const,
    recipients: users.length,
    emailed,
    pushed,
    emailSkipped: wantsEmail && !emailReady,
    pushSkipped: wantsPush && !pushReady,
  };
}

export function announcementResultLine(result: {
  recipients: number;
  emailed: number;
  pushed: number;
  emailSkipped: boolean;
  pushSkipped: boolean;
}) {
  const parts = [`${result.recipients} in the group`];
  if (result.emailed > 0) parts.push(`${result.emailed} emailed`);
  if (result.pushed > 0) parts.push(`${result.pushed} push`);
  if (result.emailSkipped) parts.push("email isn't set up");
  if (result.pushSkipped) parts.push("push isn't set up");
  return parts.join(" · ");
}
