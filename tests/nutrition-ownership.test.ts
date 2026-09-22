import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import {
  createNutritionEntryForUser,
  deleteNutritionEntryForUser,
  getNutritionEntryForUser,
  updateNutritionEntryForUser,
} from "@/lib/nutrition";
import { makeUser, resetDatabase } from "./helpers";

describe("nutrition ownership", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks user B from reading or changing user A's food log", async () => {
    const userA = await makeUser("food-a@example.com");
    const userB = await makeUser("food-b@example.com");
    const entry = await createNutritionEntryForUser(userA.id, {
      name: "Chicken and rice",
      mealType: "lunch",
      servings: 1,
      servingLabel: "bowl",
      calories: 550,
      proteinG: 40,
      carbsG: 50,
      fatG: 15,
      eatenAt: new Date("2026-09-20T12:00:00Z"),
    });

    expect(entry.source).toBe("manual_estimate");
    await expect(getNutritionEntryForUser(entry.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      updateNutritionEntryForUser(entry.id, userB.id, {
        name: "Hacked",
        mealType: "lunch",
        servings: 1,
        servingLabel: "bowl",
        calories: 1,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        eatenAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      deleteNutritionEntryForUser(entry.id, userB.id),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const still = await getNutritionEntryForUser(entry.id, userA.id);
    expect(still.name).toBe("Chicken and rice");
    expect(still.calories).toBe(550);
  });

  it("lets the owner correct a mistaken calorie estimate", async () => {
    const user = await makeUser("fix-food@example.com");
    const entry = await createNutritionEntryForUser(user.id, {
      name: "Eggs",
      mealType: "breakfast",
      servings: 1,
      servingLabel: "plate",
      calories: 400,
      proteinG: 20,
      carbsG: 2,
      fatG: 30,
      eatenAt: new Date("2026-09-20T08:00:00Z"),
    });
    const fixed = await updateNutritionEntryForUser(entry.id, user.id, {
      name: "Eggs",
      mealType: "breakfast",
      servings: 1,
      servingLabel: "plate",
      calories: 280,
      proteinG: 18,
      carbsG: 2,
      fatG: 20,
      eatenAt: new Date("2026-09-20T08:00:00Z"),
    });
    expect(fixed.calories).toBe(280);
    expect(fixed.source).toBe("manual_estimate");
  });
});
