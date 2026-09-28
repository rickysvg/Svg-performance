import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GYMDESK_CSV_HEADERS, parseCsvRecords, parseGymdeskCsv } from "@/lib/gymdesk/csv";
import { applyGymdeskCsv, previewGymdeskCsv } from "@/lib/gymdesk/csv-apply";
import { handleGymdeskWebhook } from "@/lib/gymdesk/webhook";
import { matchUserToGymdesk } from "@/lib/gymdesk/match";
import { recomputeMembership } from "@/lib/gymdesk/recompute";
import { confirmEmailVerificationCode } from "@/lib/gymdesk/email-code";
import { hashCode, hashEmail, hashNameKey, hashPhone, displayLabel } from "@/lib/gymdesk/crypto";
import { mapGymdeskStatus } from "@/lib/gymdesk/status";
import { runGymdeskDailyCron } from "@/lib/gymdesk/cron";
import { setGymMembershipOverride } from "@/lib/admin";
import { makeUser, resetDatabase } from "./helpers";

const SECRET = "gymdesk-webhook-test-secret";
const PEPPER = "gymdesk-match-pepper-test";

function enableGymdesk() {
  process.env.GYMDESK_WEBHOOK_SECRET = SECRET;
  process.env.GYMDESK_MATCH_PEPPER = PEPPER;
  process.env.CRON_SECRET = "cron-gymdesk-test";
  delete process.env.GYMDESK_SYNC_ENABLED;
  process.env.GYMDESK_GRACE_DAYS = "7";
  process.env.GYMDESK_FROZEN_GRACE_DAYS = "30";
}

async function seedRoster(input: {
  gymdeskId: string;
  email?: string;
  email2?: string;
  phone?: string;
  phone2?: string;
  first: string;
  last: string;
  status: string;
  frozenSince?: Date;
}) {
  return prisma.gymdeskMember.create({
    data: {
      gymdeskId: input.gymdeskId,
      emailHash: hashEmail(input.email ?? ""),
      email2Hash: hashEmail(input.email2 ?? ""),
      phoneHash: hashPhone(input.phone ?? ""),
      phone2Hash: hashPhone(input.phone2 ?? ""),
      nameKey: hashNameKey(input.last, input.first),
      displayLabel: displayLabel(input.first, input.last),
      status: input.status,
      statusChangedAt: new Date(),
      frozenSince: input.frozenSince ?? null,
      source: "csv",
    },
  });
}

function csvLine(values: string[]) {
  return values
    .map((value) =>
      /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value,
    )
    .join(",");
}

function sampleCsv(rows: Record<string, string>[], extraHeader?: string) {
  const headers = extraHeader ? [...GYMDESK_CSV_HEADERS, extraHeader] : [...GYMDESK_CSV_HEADERS];
  const lines = [csvLine(headers)];
  for (const row of rows) {
    lines.push(csvLine(headers.map((name) => row[name] ?? "")));
  }
  return lines.join("\n");
}

describe("gymdesk member verify", () => {
  beforeEach(async () => {
    enableGymdesk();
    await resetDatabase();
  });

  afterAll(async () => {
    delete process.env.GYMDESK_WEBHOOK_SECRET;
    delete process.env.GYMDESK_MATCH_PEPPER;
    delete process.env.CRON_SECRET;
    await prisma.$disconnect();
  });

  it("normalizes email, phone, and name keys without gmail-dot stripping", () => {
    expect(hashEmail("  Maria.Garcia.Test@Example.TEST ")).toBe(
      hashEmail("maria.garcia.test@example.test"),
    );
    expect(hashEmail("mariagarcia.test@gmail.com")).not.toBe(
      hashEmail("maria.garcia.test@gmail.com"),
    );
    expect(hashPhone("(202) 555-0123")).toBe(hashPhone("+12025550123"));
    expect(hashNameKey("García", "María")).toBe(hashNameKey("garcia", "maria"));
    expect(displayLabel("Maria", "Garcia")).toBe("Maria G.");
  });

  it("maps Gymdesk status values case-insensitively", () => {
    expect(mapGymdeskStatus("Active").status).toBe("active");
    expect(mapGymdeskStatus("MEMBER").status).toBe("active");
    expect(mapGymdeskStatus("Frozen").status).toBe("frozen");
    expect(mapGymdeskStatus("Cancelled").status).toBe("canceled");
    expect(mapGymdeskStatus("canceled").status).toBe("canceled");
    expect(mapGymdeskStatus("Expired").status).toBe("canceled");
    expect(mapGymdeskStatus("Visitor").status).toBe("visitor");
    expect(mapGymdeskStatus("trial").status).toBe("visitor");
    expect(mapGymdeskStatus("Website Signup").status).toBe("pending");
    expect(mapGymdeskStatus("Mystery").status).toBe("unknown");
    expect(mapGymdeskStatus("Mystery").activeLike).toBe(false);
  });

  it("auto-verifies only after email ownership and exactly one active roster row", async () => {
    const user = await makeUser("maria.garcia.test@example.test");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { displayName: "Maria Garcia" },
    });
    await seedRoster({
      gymdeskId: "gd-maria",
      email: "maria.garcia.test@example.test",
      first: "Maria",
      last: "Garcia",
      status: "active",
    });

    const before = await matchUserToGymdesk(user.id);
    expect(before.kind).toBe("none");

    await prisma.profile.update({
      where: { userId: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    const matched = await matchUserToGymdesk(user.id);
    expect(matched.kind).toBe("verified");
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile?.gymMembershipVerified).toBe(true);
    expect(profile?.gymdeskMemberId).toBe("gd-maria");
  });

  it("matches 2nd email and treats non-active email hits as conflicts", async () => {
    const user = await makeUser("casey.nguyen.test@example.test");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { displayName: "Casey Nguyen", emailVerifiedAt: new Date() },
    });
    await seedRoster({
      gymdeskId: "gd-casey",
      email2: "casey.nguyen.test@example.test",
      first: "Casey",
      last: "Nguyen",
      status: "canceled",
    });
    const result = await matchUserToGymdesk(user.id);
    expect(result.kind).toBe("conflict");
    const queue = await prisma.gymdeskMatchQueue.findFirst({ where: { userId: user.id } });
    expect(queue?.reason).toBe("email_not_active");
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile?.gymMembershipVerified).toBe(false);
  });

  it("phone + last name + first initial is suggested, never automatic; name alone never matches", async () => {
    const user = await makeUser("jon.rivera.test@example.test");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { displayName: "Jon Rivera", phoneE164: "+12025550123" },
    });
    await seedRoster({
      gymdeskId: "gd-jon",
      phone: "+12025550123",
      first: "Jon",
      last: "Rivera",
      status: "active",
    });
    const suggested = await matchUserToGymdesk(user.id);
    expect(suggested.kind).toBe("suggested");
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile?.gymMembershipVerified).toBe(false);
    expect(profile?.gymdeskMemberId).toBe("");

    const nameOnly = await makeUser("pat.lee.test@example.test");
    await prisma.profile.update({
      where: { userId: nameOnly.id },
      data: { displayName: "Jon Rivera" },
    });
    const none = await matchUserToGymdesk(nameOnly.id);
    expect(none.kind).toBe("none");
  });

  it("queues conflicts for ambiguous emails, already-linked rows, and visitor/pending", async () => {
    const user = await makeUser("alex.kim.test@example.test");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { displayName: "Alex Kim", emailVerifiedAt: new Date() },
    });
    await seedRoster({
      gymdeskId: "gd-alex-1",
      email: "alex.kim.test@example.test",
      first: "Alex",
      last: "Kim",
      status: "active",
    });
    await seedRoster({
      gymdeskId: "gd-alex-2",
      email: "alex.kim.test@example.test",
      first: "Alexa",
      last: "Kim",
      status: "active",
    });
    expect((await matchUserToGymdesk(user.id)).kind).toBe("conflict");

    const taken = await makeUser("taken.slot.test@example.test");
    await seedRoster({
      gymdeskId: "gd-taken",
      email: "new.slot.test@example.test",
      first: "Taken",
      last: "Slot",
      status: "active",
    });
    await prisma.gymdeskMember.update({
      where: { gymdeskId: "gd-taken" },
      data: { linkedUserId: taken.id },
    });
    const claimant = await makeUser("new.slot.test@example.test");
    await prisma.profile.update({
      where: { userId: claimant.id },
      data: { displayName: "Taken Slot", emailVerifiedAt: new Date() },
    });
    expect((await matchUserToGymdesk(claimant.id)).kind).toBe("conflict");

    const visitorUser = await makeUser("other.kim.test@example.test");
    await prisma.profile.update({
      where: { userId: visitorUser.id },
      data: { displayName: "Other Kim", emailVerifiedAt: new Date() },
    });
    await seedRoster({
      gymdeskId: "gd-visit",
      email: "other.kim.test@example.test",
      first: "Other",
      last: "Kim",
      status: "visitor",
    });
    expect((await matchUserToGymdesk(visitorUser.id)).kind).toBe("conflict");
  });

  it("starts canceled grace then lapses after GYMDESK_GRACE_DAYS", async () => {
    const user = await makeUser("grace.user.test@example.test");
    await seedRoster({
      gymdeskId: "gd-grace",
      email: "grace.user.test@example.test",
      first: "Grace",
      last: "User",
      status: "active",
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        emailVerifiedAt: new Date(),
        gymdeskMemberId: "gd-grace",
        gymMembershipVerified: true,
      },
    });
    await prisma.gymdeskMember.update({
      where: { gymdeskId: "gd-grace" },
      data: { linkedUserId: user.id, status: "canceled" },
    });
    const start = new Date("2026-09-01T12:00:00Z");
    const afterStart = await recomputeMembership(user.id, start);
    expect(afterStart?.gymMembershipVerified).toBe(true);
    expect(afterStart?.reason).toBe("canceled_grace_start");

    const day6 = new Date("2026-09-07T12:00:00Z");
    expect((await recomputeMembership(user.id, day6))?.gymMembershipVerified).toBe(true);

    const day8 = new Date("2026-09-09T12:00:00Z");
    expect((await recomputeMembership(user.id, day8))?.gymMembershipVerified).toBe(false);
  });

  it("keeps frozen members verified for 30 days from frozenSince", async () => {
    const user = await makeUser("frozen.user.test@example.test");
    const frozenSince = new Date("2026-08-01T12:00:00Z");
    await seedRoster({
      gymdeskId: "gd-frozen",
      first: "Frozen",
      last: "User",
      status: "frozen",
      frozenSince,
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        gymdeskMemberId: "gd-frozen",
        gymMembershipVerified: true,
        gymMembershipOverride: "none",
      },
    });
    await prisma.gymdeskMember.update({
      where: { gymdeskId: "gd-frozen" },
      data: { linkedUserId: user.id },
    });
    const day29 = new Date("2026-08-30T12:00:00Z");
    expect((await recomputeMembership(user.id, day29))?.gymMembershipVerified).toBe(true);
    const day31 = new Date("2026-09-01T12:00:01Z");
    expect((await recomputeMembership(user.id, day31))?.gymMembershipVerified).toBe(false);
  });

  it("lets admin override always win over Gymdesk", async () => {
    const admin = await makeUser("admin.override.test@example.test", false, "admin");
    const user = await makeUser("force.off.test@example.test");
    await seedRoster({
      gymdeskId: "gd-force",
      email: "force.off.test@example.test",
      first: "Force",
      last: "Off",
      status: "active",
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        emailVerifiedAt: new Date(),
        gymdeskMemberId: "gd-force",
        gymMembershipVerified: true,
      },
    });
    await setGymMembershipOverride({
      adminUserId: admin.id,
      targetUserId: user.id,
      override: "force_off",
      note: "left the academy",
    });
    const off = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(off?.gymMembershipVerified).toBe(false);

    await setGymMembershipOverride({
      adminUserId: admin.id,
      targetUserId: user.id,
      override: "force_on",
      note: "staff exception",
    });
    expect(
      (await prisma.profile.findUnique({ where: { userId: user.id } }))?.gymMembershipVerified,
    ).toBe(true);
  });

  it("accepts JSON and form-urlencoded webhooks with the shared secret", async () => {
    const jsonReq = new Request(
      `http://localhost:3000/api/gymdesk/webhook/signup?t=${SECRET}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.8" },
        body: JSON.stringify({
          member_id: "gd-hook-json",
          name: "Maria Garcia",
          email: "maria.hook.test@example.test",
          phone: "2025550123",
        }),
      },
    );
    const jsonRes = await handleGymdeskWebhook({
      event: "signup",
      request: jsonReq,
      clientIp: "10.0.0.8",
    });
    expect(jsonRes.status).toBe(200);
    expect(await prisma.gymdeskMember.findUnique({ where: { gymdeskId: "gd-hook-json" } })).toMatchObject({
      status: "active",
      displayLabel: "Maria G.",
    });

    const formReq = new Request(
      `http://localhost:3000/api/gymdesk/webhook/frozen?t=${SECRET}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-forwarded-for": "10.0.0.9",
        },
        body: "member_id=gd-hook-json&name=Maria+Garcia&email=maria.hook.test%40example.test&phone=2025550123",
      },
    );
    const formRes = await handleGymdeskWebhook({
      event: "frozen",
      request: formReq,
      clientIp: "10.0.0.9",
    });
    expect(formRes.status).toBe(200);
    expect(await prisma.gymdeskMember.findUnique({ where: { gymdeskId: "gd-hook-json" } })).toMatchObject({
      status: "frozen",
    });
  });

  it("rejects unknown events and bad webhook secrets; GET query payloads still work", async () => {
    const bad = await handleGymdeskWebhook({
      event: "signup",
      request: new Request(`http://localhost:3000/api/gymdesk/webhook/signup?t=nope`),
      clientIp: "10.0.0.10",
    });
    expect(bad.status).toBe(401);

    const unknown = await handleGymdeskWebhook({
      event: "not-a-real-event",
      request: new Request(`http://localhost:3000/api/gymdesk/webhook/not-a-real-event?t=${SECRET}`),
      clientIp: "10.0.0.10",
    });
    expect(unknown.status).toBe(404);

    const getRes = await handleGymdeskWebhook({
      event: "membership-start",
      request: new Request(
        `http://localhost:3000/api/gymdesk/webhook/membership-start?t=${SECRET}&member_id=gd-get&name=Casey%20Nguyen&email=casey.get.test@example.test`,
      ),
      clientIp: "10.0.0.11",
    });
    expect(getRes.status).toBe(200);
    expect(await prisma.gymdeskMember.findUnique({ where: { gymdeskId: "gd-get" } })).toMatchObject({
      status: "active",
    });
  });

  it("parses the exact Gymdesk CSV headers, extra columns, BOM, and quotes", () => {
    const text = `\uFEFF${sampleCsv(
      [
        {
          "Member ID": "111",
          "First Name": "Maria",
          "Last Name": "Garcia",
          Phone: "(202) 555-0123",
          "2nd Phone": "",
          Email: "maria.garcia.test@example.test",
          "2nd Email": "maria.alt.test@example.test",
          "Date of birth": "1990-01-01",
          Age: "36",
          Address: "123 Fake St",
          Notes: "very private, do not store",
          Membership: "Unlimited",
          Status: "Active",
        },
      ],
      "Extra Col",
    )}`;
    const parsed = parseGymdeskCsv(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      gymdeskId: "111",
      firstName: "Maria",
      lastName: "Garcia",
      displayLabel: "Maria G.",
      mapped: { status: "active", activeLike: true },
    });
    expect(JSON.stringify(parsed.rows[0])).not.toContain("1990-01-01");
    expect(JSON.stringify(parsed.rows[0])).not.toContain("123 Fake St");
    expect(JSON.stringify(parsed.rows[0])).not.toContain("very private");
  });

  it("keeps quoted multiline Notes/Address as one record (RFC 4180)", () => {
    const notes = 'Line one\nSaid "hello" on line two\r\nand a third';
    const address = "100 Main St\nSuite 2B";
    const csv = sampleCsv([
      {
        "Member ID": "gd-multi-1",
        "First Name": "Ana",
        "Last Name": "Rivera",
        Email: "ana.rivera.test@example.test",
        Address: address,
        Notes: notes,
        Status: "Active",
      },
      {
        "Member ID": "gd-multi-2",
        "First Name": "Ben",
        "Last Name": "Cho",
        Email: "ben.cho.test@example.test",
        Status: "Frozen",
      },
    ]);
    // Naive split would invent extra rows from the Notes/Address newlines.
    expect(csv.split(/\r?\n/).length).toBeGreaterThan(3);
    const records = parseCsvRecords(csv);
    expect(records).toHaveLength(3); // header + 2 members
    const notesIdx = GYMDESK_CSV_HEADERS.indexOf("Notes");
    const addressIdx = GYMDESK_CSV_HEADERS.indexOf("Address");
    expect(records[1]![notesIdx]).toBe(notes);
    expect(records[1]![addressIdx]).toBe(address);
    expect(records[1]![notesIdx]).toContain('Said "hello"');

    const parsed = parseGymdeskCsv(`\uFEFF${csv}`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows.map((row) => row.gymdeskId)).toEqual(["gd-multi-1", "gd-multi-2"]);
    expect(parsed.rows.map((row) => row.mapped.status)).toEqual(["active", "frozen"]);
    expect(parsed.rows.every((row) => row.mapped.status !== "unknown")).toBe(true);
  });

  it("puts missing mirror-active CSV rows into the grace flow", async () => {
    const user = await makeUser("missing.csv.test@example.test");
    await seedRoster({
      gymdeskId: "gd-keep",
      email: "keep.csv.test@example.test",
      first: "Keep",
      last: "Row",
      status: "active",
    });
    await seedRoster({
      gymdeskId: "gd-missing",
      email: "missing.csv.test@example.test",
      first: "Missing",
      last: "Row",
      status: "active",
    });
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        gymdeskMemberId: "gd-missing",
        gymMembershipVerified: true,
      },
    });
    await prisma.gymdeskMember.update({
      where: { gymdeskId: "gd-missing" },
      data: { linkedUserId: user.id },
    });

    const csv = sampleCsv([
      {
        "Member ID": "gd-keep",
        "First Name": "Keep",
        "Last Name": "Row",
        Email: "keep.csv.test@example.test",
        Status: "Active",
      },
    ]);
    const parsed = parseGymdeskCsv(csv);
    const preview = await previewGymdeskCsv(parsed.rows);
    expect(preview.missingActive.map((row) => row.gymdeskId)).toContain("gd-missing");
    await applyGymdeskCsv(parsed.rows, new Date("2026-09-01T12:00:00Z"));
    const missing = await prisma.gymdeskMember.findUnique({ where: { gymdeskId: "gd-missing" } });
    expect(missing?.status).toBe("canceled");
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile?.gymMembershipVerified).toBe(true);
    expect(profile?.gymMembershipGraceUntil).not.toBeNull();
  });

  it("stores hashed email codes and matches after confirm", async () => {
    const user = await makeUser("code.user.test@example.test");
    await seedRoster({
      gymdeskId: "gd-code",
      email: "code.user.test@example.test",
      first: "Code",
      last: "User",
      status: "active",
    });
    await prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        codeHash: hashCode("123456"),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const result = await confirmEmailVerificationCode({ userId: user.id, code: "123456" });
    expect(result.kind).toBe("verified");
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    expect(profile?.emailVerifiedAt).toBeTruthy();
    expect(profile?.gymMembershipVerified).toBe(true);
  });

  it("stays disabled without secrets and cron still reports disabled", async () => {
    delete process.env.GYMDESK_WEBHOOK_SECRET;
    delete process.env.GYMDESK_MATCH_PEPPER;
    const disabled = await handleGymdeskWebhook({
      event: "signup",
      request: new Request("http://localhost:3000/api/gymdesk/webhook/signup?t=x"),
      clientIp: "10.0.0.12",
    });
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toMatchObject({ ok: true, disabled: true });
    const cron = await runGymdeskDailyCron();
    expect(cron.disabled).toBe(true);
  });
});
