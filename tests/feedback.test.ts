import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { setMailSenderForTests } from "@/lib/mail";
import { isFeedbackAdmin } from "@/lib/feedback-access";
import {
  appVersionLabel,
  buildFeedbackAdminEmail,
  createMemberFeedback,
  FEEDBACK_MAX_PER_WINDOW,
  listMemberFeedback,
  readFeedbackImageForActor,
  sanitizeFeedbackRoute,
  setMemberFeedbackStatus,
} from "@/lib/feedback";
import { makeUser, resetDatabase } from "./helpers";

function tinyPng() {
  return Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
}

describe("member feedback", () => {
  let dir = "";
  const env = process.env as Record<string, string | undefined>;

  beforeEach(async () => {
    await resetDatabase();
    dir = await mkdtemp(path.join(os.tmpdir(), "svg-feedback-"));
    env.FEEDBACK_DIR = dir;
    delete env.BLOB_READ_WRITE_TOKEN;
    delete env.ADMIN_EMAILS;
    delete env.SMTP_HOST;
    delete env.VERCEL_GIT_COMMIT_SHA;
    delete env.GIT_COMMIT_SHA;
    setMailSenderForTests(null);
  });

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    delete env.FEEDBACK_DIR;
    delete env.ADMIN_EMAILS;
    delete env.SMTP_HOST;
    delete env.VERCEL_GIT_COMMIT_SHA;
    setMailSenderForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps routes inside the app and labels the build", () => {
    expect(sanitizeFeedbackRoute("/training/log/abc/done")).toBe("/training/log/abc/done");
    expect(sanitizeFeedbackRoute("https://evil.example")).toBe("");
    expect(sanitizeFeedbackRoute("//evil.example")).toBe("");
    expect(sanitizeFeedbackRoute("/profile/../../etc")).toBe("");
    env.GIT_COMMIT_SHA = "abcdef1234567890";
    expect(appVersionLabel()).toBe("0.1.0+abcdef1");
  });

  it("stores context, a private screenshot, and still saves when email fails", async () => {
    const member = await makeUser("feedback-member@example.com");
    const other = await makeUser("feedback-other@example.com");
    const session = await prisma.workoutSession.create({
      data: { userId: member.id, title: "Bag", performedAt: new Date("2026-10-14T12:00:00.000Z") },
    });
    const foreign = await prisma.workoutSession.create({
      data: { userId: other.id, title: "Other", performedAt: new Date("2026-10-14T12:00:00.000Z") },
    });

    env.ADMIN_EMAILS = "Owner@SVG.example";
    env.SMTP_HOST = "smtp.resend.com";
    env.VERCEL_GIT_COMMIT_SHA = "1234abcd9999";
    const sent: string[] = [];
    setMailSenderForTests(async (mail) => {
      sent.push(mail.to);
      if (mail.to.includes("owner@svg.example")) {
        throw new Error("smtp down");
      }
      return { sent: true, reason: "sent" };
    });

    const row = await createMemberFeedback({
      userId: member.id,
      userEmail: member.email,
      type: "bug",
      message: "The rest timer <script>alert(1)</script> stuck on the last set.",
      route: "/training/log/session/done",
      workoutId: session.id,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      bytes: tinyPng(),
      claimedType: "image/png",
    });

    expect(row.status).toBe("new");
    expect(row.userEmail).toBe("feedback-member@example.com");
    expect(row.workoutId).toBe(session.id);
    expect(row.route).toBe("/training/log/session/done");
    expect(row.appVersion).toBe("0.1.0+1234abc");
    expect(row.userAgent).toContain("iPhone");
    expect(row.storageKind).toBe("local");
    expect(row.mimeType).toBe("image/png");
    expect(await prisma.memberFeedback.count()).toBe(1);
    expect(sent).toEqual(["owner@svg.example"]);

    const dropped = await createMemberFeedback({
      userId: member.id,
      userEmail: member.email,
      type: "workout",
      message: "That finisher felt too long.",
      route: "https://evil.example/phish",
      workoutId: foreign.id,
      userAgent: "test",
    });
    expect(dropped.route).toBe("");
    expect(dropped.workoutId).toBe("");

    await expect(
      createMemberFeedback({
        userId: member.id,
        userEmail: member.email,
        type: "bug",
        message: "Not a picture.",
        route: "/profile",
        workoutId: "",
        userAgent: "",
        bytes: Uint8Array.from([1, 2, 3, 4]),
        claimedType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "FEEDBACK" });
    expect(await prisma.memberFeedback.count()).toBe(2);
  });

  it("rate-limits a burst of notes", async () => {
    const member = await makeUser("feedback-rate@example.com");
    for (let i = 0; i < FEEDBACK_MAX_PER_WINDOW; i += 1) {
      await createMemberFeedback({
        userId: member.id,
        userEmail: member.email,
        type: "idea",
        message: `Idea number ${i} for the logger.`,
        route: "/profile",
        workoutId: "",
        userAgent: "",
      });
    }
    await expect(
      createMemberFeedback({
        userId: member.id,
        userEmail: member.email,
        type: "idea",
        message: "One more idea after the limit.",
        route: "/profile",
        workoutId: "",
        userAgent: "",
      }),
    ).rejects.toMatchObject({ code: "RATE" });
    expect(await prisma.memberFeedback.count()).toBe(FEEDBACK_MAX_PER_WINDOW);
  });

  it("lets ADMIN_EMAILS and role admins filter, mark status, and open the screenshot", async () => {
    const member = await makeUser("feedback-athlete@example.com");
    const reviewer = await makeUser("ricky@svg.example");
    const stranger = await makeUser("stranger@example.com");
    const roleAdmin = await makeUser("role-admin@example.com", false, "admin");
    env.ADMIN_EMAILS = "ricky@svg.example";
    expect(isFeedbackAdmin(reviewer)).toBe(true);
    expect(isFeedbackAdmin(roleAdmin)).toBe(true);
    expect(isFeedbackAdmin(stranger)).toBe(false);

    const row = await createMemberFeedback({
      userId: member.id,
      userEmail: member.email,
      type: "idea",
      message: "Add a quieter finish sound.",
      route: "/profile",
      workoutId: "",
      userAgent: "iPhone",
      bytes: tinyPng(),
      claimedType: "image/png",
    });

    const ideas = await listMemberFeedback(reviewer, { type: "idea", status: "new" });
    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.user.email).toBe(member.email);
    await expect(listMemberFeedback(stranger)).rejects.toBeInstanceOf(ForbiddenError);

    const reviewed = await setMemberFeedbackStatus({
      actor: reviewer,
      feedbackId: row.id,
      status: "reviewed",
    });
    expect(reviewed.status).toBe("reviewed");
    expect(await listMemberFeedback(roleAdmin, { status: "new" })).toHaveLength(0);
    expect(await listMemberFeedback(roleAdmin, { status: "reviewed" })).toHaveLength(1);
    await expect(
      setMemberFeedbackStatus({ actor: stranger, feedbackId: row.id, status: "done" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const image = await readFeedbackImageForActor(row.id, reviewer);
    expect(image.bytes[0]).toBe(0x89);
    await expect(readFeedbackImageForActor(row.id, member)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("brands the admin email like reminder mail and escapes the note", () => {
    const mail = buildFeedbackAdminEmail({
      typeLabel: "Bug",
      message: "Timer <script>alert(1)</script> stuck",
      email: "member@example.com",
      userId: "user_1",
      route: "/training",
      workoutId: "",
      appVersion: "0.1.0+abc1234",
      inboxHref: "https://svg-performance.vercel.app/admin/feedback",
    });
    expect(mail.subject).toBe("SVG feedback: Bug");
    expect(mail.text).toContain("MEMBER FEEDBACK");
    expect(mail.text).toContain("member@example.com");
    expect(mail.html).toContain("#CBF805");
    expect(mail.html).toContain("background-color:#000000");
    expect(mail.html).toContain("Member feedback");
    expect(mail.html).toContain("New note");
    expect(mail.html).toContain(">Open inbox<");
    expect(mail.html).toContain("https://svg-performance.vercel.app/admin/feedback");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
  });
});
