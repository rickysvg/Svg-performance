import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { registerAccount } from "@/lib/auth";
import { getEffectivePlanId } from "@/lib/entitlements";
import { canUseMemberTools } from "@/lib/access";
import {
  createTesterInvite,
  isTesterFlagActive,
  listTesterInvites,
  normalizeTesterCode,
  redeemTesterCode,
  TESTER_LAUNCH_AT,
  testerAccessOpen,
} from "@/lib/tester";

describe("beta tester invite codes", () => {
  const env = process.env;

  beforeEach(async () => {
    await resetDatabase();
    delete env.ADMIN_EMAILS;
  });

  afterAll(async () => {
    delete env.ADMIN_EMAILS;
    await prisma.$disconnect();
  });

  it("lets only ADMIN_EMAILS create a code and records who redeems it", async () => {
    const outsider = await makeUser("coach@svg.example", false, "admin");
    await expect(
      createTesterInvite({ actor: outsider, maxUses: 2, note: "camp" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    env.ADMIN_EMAILS = "Ricky@SVG.example";
    const ricky = await makeUser("ricky@svg.example", false, "admin");
    const invite = await createTesterInvite({ actor: ricky, maxUses: 2, note: "camp" });
    expect(invite.code).toMatch(/^SVG-[A-Z0-9]{6}$/);
    expect(normalizeTesterCode(invite.code.toLowerCase())).toBe(invite.code);

    const athlete = await makeUser("athlete@example.com");
    await prisma.profile.update({
      where: { userId: athlete.id },
      data: { trialEndsAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    await redeemTesterCode(athlete.id, ` ${invite.code.toLowerCase()} `);

    const rows = await listTesterInvites();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.uses).toBe(1);
    expect(rows[0]?.redemptions.map((row) => row.user.email)).toEqual(["athlete@example.com"]);
    expect(await prisma.subscription.count({ where: { userId: athlete.id } })).toBe(0);
    expect(await getEffectivePlanId(athlete.id)).toBe("performance");
    expect((await canUseMemberTools(athlete.id)).allowed).toBe(true);

    const second = await makeUser("second@example.com");
    await redeemTesterCode(second.id, invite.code);
    await expect(redeemTesterCode(await makeUser("third@example.com").then((user) => user.id), invite.code)).rejects.toMatchObject({
      message: "That tester code has no uses left.",
    });
    await expect(redeemTesterCode(athlete.id, invite.code)).rejects.toMatchObject({
      message: "This account already used a tester code.",
    });
  });

  it("redeems a code during signup and closes access on Nov 16", async () => {
    env.ADMIN_EMAILS = "ricky@svg.example";
    const ricky = await makeUser("ricky@svg.example");
    const invite = await createTesterInvite({ actor: ricky, maxUses: 1 });
    const user = await registerAccount({
      email: "signup-tester@example.com",
      password: "password12",
      displayName: "Sam",
      isAdultConfirmed: true,
      claimsGymMembership: false,
      testerCode: invite.code,
    });
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.tester).toBe(true);
    expect(profile.testerRedeemedAt).not.toBeNull();
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(0);
    expect(await getEffectivePlanId(user.id, new Date("2026-11-15T12:00:00.000Z"))).toBe("performance");
    expect(isTesterFlagActive(true, TESTER_LAUNCH_AT)).toBe(false);
    expect(testerAccessOpen(TESTER_LAUNCH_AT)).toBe(false);
    expect(await getEffectivePlanId(user.id, TESTER_LAUNCH_AT)).toBe("member_access");
    await expect(redeemTesterCode(ricky.id, "nope", new Date("2026-11-16T18:00:00.000Z"))).rejects.toMatchObject({
      message: "Tester access closed on Nov 16, 2026.",
    });
    await expect(
      registerAccount({
        email: "bad-code@example.com",
        password: "password12",
        displayName: "No",
        isAdultConfirmed: true,
        claimsGymMembership: false,
        testerCode: "SVG-ZZZZZZ",
      }),
    ).rejects.toMatchObject({ message: "That tester code is not valid." });
    expect(await prisma.user.findUnique({ where: { email: "bad-code@example.com" } })).toBeNull();
  });
});
