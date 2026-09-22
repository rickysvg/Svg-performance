import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  assignMemberToCoach,
  listMemberTrendsForStaff,
} from "@/lib/reports";
import {
  createHelpRequest,
  listHelpRequestsForStaff,
  setHelpRequestStatus,
} from "@/lib/help";
import { sendCoachMessage } from "@/lib/coach/chat";
import { createNutritionEntryForUser } from "@/lib/nutrition";

describe("coach / admin reporting authz", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks members from listing trends or the help inbox", async () => {
    const member = await makeUser("member-report@example.com");
    await expect(
      listMemberTrendsForStaff({ staffUserId: member.id, staffRole: member.role }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      listHelpRequestsForStaff({ staffUserId: member.id, staffRole: member.role }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets a coach see only assigned members, without food diary dumps", async () => {
    const admin = await makeUser("report-admin@example.com", false, "admin");
    const coach = await makeUser("report-coach@example.com", false, "coach");
    const assigned = await makeUser("assigned@example.com");
    const other = await makeUser("other@example.com");

    await assignMemberToCoach({
      adminUserId: admin.id,
      coachUserId: coach.id,
      memberUserId: assigned.id,
    });

    await createNutritionEntryForUser(assigned.id, {
      name: "Secret burrito",
      mealType: "lunch",
      servings: 1,
      servingLabel: "each",
      calories: 700,
      proteinG: 30,
      carbsG: 70,
      fatG: 25,
      eatenAt: new Date("2026-09-21T12:00:00Z"),
    });
    await sendCoachMessage({
      userId: assigned.id,
      message: "I have chest pain but I want to train through the pain.",
    });

    const empty = await listMemberTrendsForStaff({
      staffUserId: coach.id,
      staffRole: "coach",
    });
    expect(empty.map((row) => row.userId)).toEqual([assigned.id]);
    expect(empty[0].aiHandoffFlags).toBeGreaterThan(0);
    expect(JSON.stringify(empty)).not.toMatch(/Secret burrito/i);
    expect(empty[0]).not.toHaveProperty("nutritionEntries");
    expect(empty.map((row) => row.userId)).not.toContain(other.id);

    const asAdmin = await listMemberTrendsForStaff({
      staffUserId: admin.id,
      staffRole: "admin",
    });
    expect(asAdmin.map((row) => row.userId).sort()).toEqual(
      [assigned.id, other.id].sort(),
    );
  });

  it("lets members open help requests and staff move open → seen → closed", async () => {
    const admin = await makeUser("help-admin@example.com", false, "admin");
    const coach = await makeUser("help-coach@example.com", false, "coach");
    const member = await makeUser("help-member@example.com");
    const stranger = await makeUser("help-stranger@example.com");

    await assignMemberToCoach({
      adminUserId: admin.id,
      coachUserId: coach.id,
      memberUserId: member.id,
    });

    const request = await createHelpRequest({
      memberUserId: member.id,
      topic: "training",
      note: "Can you watch my squat next class?",
    });
    expect(request.status).toBe("open");

    await expect(
      setHelpRequestStatus({
        staffUserId: coach.id,
        staffRole: "coach",
        requestId: request.id,
        status: "seen",
      }),
    ).resolves.toMatchObject({ status: "seen" });

    const otherRequest = await createHelpRequest({
      memberUserId: stranger.id,
      topic: "class",
      note: "I have a schedule question.",
    });
    await expect(
      setHelpRequestStatus({
        staffUserId: coach.id,
        staffRole: "coach",
        requestId: otherRequest.id,
        status: "closed",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await setHelpRequestStatus({
      staffUserId: admin.id,
      staffRole: "admin",
      requestId: otherRequest.id,
      status: "closed",
    });
    const inbox = await listHelpRequestsForStaff({
      staffUserId: admin.id,
      staffRole: "admin",
    });
    expect(inbox.map((row) => row.status).sort()).toEqual(["closed", "seen"].sort());
  });

  it("does not let a coach assign members", async () => {
    const coach = await makeUser("cannot-assign@example.com", false, "coach");
    const member = await makeUser("target-assign@example.com");
    await expect(
      assignMemberToCoach({
        adminUserId: coach.id,
        coachUserId: coach.id,
        memberUserId: member.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
