import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import {
  createNutritionEntryForUser,
  createSavedMealForUser,
  getSavedMealForUser,
} from "@/lib/nutrition";
import { DEMO_FOODS, getDemoFoodById, searchFoodOptions } from "@/lib/foods";

describe("food search and saved meals", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns DEMO commons and the member's own saved meals", () => {
    const saved = [
      {
        id: "saved-1",
        name: "My rice bowl",
        servingLabel: "bowl",
        calories: 500,
        proteinG: 30,
        carbsG: 60,
        fatG: 12,
      },
    ];
    const rice = searchFoodOptions("rice", saved);
    expect(rice.some((row) => row.kind === "saved" && row.name === "My rice bowl")).toBe(
      true,
    );
    expect(rice.some((row) => row.kind === "demo" && row.name.includes("rice"))).toBe(
      true,
    );
    expect(DEMO_FOODS.every((food) => food.name.startsWith("DEMO"))).toBe(true);
    expect(getDemoFoodById("demo-chicken-breast")?.calories).toBe(180);
  });

  it("blocks user B from using user A's saved meal", async () => {
    const userA = await makeUser("meal-a@example.com");
    const userB = await makeUser("meal-b@example.com");
    const saved = await createSavedMealForUser(userA.id, {
      name: "A's oats",
      servingLabel: "bowl",
      calories: 300,
      proteinG: 10,
      carbsG: 40,
      fatG: 8,
    });
    await expect(getSavedMealForUser(saved.id, userB.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      createNutritionEntryForUser(userB.id, {
        name: "Stolen oats",
        mealType: "breakfast",
        servings: 1,
        servingLabel: "bowl",
        calories: 300,
        proteinG: 10,
        carbsG: 40,
        fatG: 8,
        eatenAt: new Date("2026-09-21T08:00:00Z"),
        savedMealId: saved.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets the owner reuse a saved meal and still label the source as a manual estimate", async () => {
    const user = await makeUser("reuse@example.com");
    const saved = await createSavedMealForUser(user.id, {
      name: "Gym lunch",
      servingLabel: "box",
      calories: 450,
      proteinG: 35,
      carbsG: 40,
      fatG: 12,
    });
    const entry = await createNutritionEntryForUser(user.id, {
      name: saved.name,
      mealType: "lunch",
      servings: 1,
      servingLabel: saved.servingLabel,
      calories: saved.calories,
      proteinG: saved.proteinG,
      carbsG: saved.carbsG,
      fatG: saved.fatG,
      eatenAt: new Date("2026-09-21T12:00:00Z"),
      savedMealId: saved.id,
    });
    expect(entry.source).toBe("manual_estimate");
    expect(entry.savedMealId).toBe(saved.id);
  });
});
