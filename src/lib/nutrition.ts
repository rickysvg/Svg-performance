import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const NUTRITION_SOURCE = "manual_estimate";

function assertOwn<T extends { userId: string }>(row: T | null, userId: string): T {
  if (!row) {
    throw new NotFoundError("Nutrition entry not found.");
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's food log.");
  }
  return row;
}

function parseAmount(value: number, label: string, max: number) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new AppError("NUTRITION", `${label} should be between 0 and ${max}.`);
  }
  return Math.round(value * 10) / 10;
}

export function validateNutritionInput(input: {
  name: string;
  mealType: string;
  servings: number;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
}) {
  const name = input.name.trim().slice(0, 80);
  if (!name) {
    throw new AppError("NUTRITION", "Give this meal a name.");
  }
  if (!MEAL_TYPES.includes(input.mealType as MealType)) {
    throw new AppError("NUTRITION", "Pick breakfast, lunch, dinner, or snack.");
  }
  return {
    name,
    mealType: input.mealType,
    servings: parseAmount(input.servings, "Servings", 20) || 1,
    servingLabel: input.servingLabel.trim().slice(0, 40) || "serving",
    calories: parseAmount(input.calories, "Calories", 5000),
    proteinG: parseAmount(input.proteinG, "Protein", 400),
    carbsG: parseAmount(input.carbsG, "Carbs", 600),
    fatG: parseAmount(input.fatG, "Fat", 300),
    notes: (input.notes ?? "").trim().slice(0, 400),
    source: NUTRITION_SOURCE,
  };
}

export async function listNutritionEntriesForUser(userId: string) {
  return prisma.nutritionEntry.findMany({
    where: { userId },
    orderBy: { eatenAt: "desc" },
  });
}

export async function getNutritionEntryForUser(entryId: string, userId: string) {
  const row = await prisma.nutritionEntry.findUnique({ where: { id: entryId } });
  return assertOwn(row, userId);
}

export async function createNutritionEntryForUser(
  userId: string,
  input: {
    name: string;
    mealType: string;
    servings: number;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    notes?: string;
    eatenAt: Date;
    savedMealId?: string | null;
  },
) {
  const data = validateNutritionInput(input);
  if (Number.isNaN(input.eatenAt.getTime())) {
    throw new AppError("NUTRITION", "Enter a valid date.");
  }
  if (input.savedMealId) {
    const saved = await prisma.savedMeal.findUnique({
      where: { id: input.savedMealId },
    });
    if (!saved || saved.userId !== userId) {
      throw new ForbiddenError("That saved meal is not yours.");
    }
  }
  const entry = await prisma.nutritionEntry.create({
    data: {
      userId,
      savedMealId: input.savedMealId || null,
      eatenAt: input.eatenAt,
      ...data,
    },
  });
  await recordMetric(METRIC_NAMES.foodLogged, userId);
  return entry;
}

export async function updateNutritionEntryForUser(
  entryId: string,
  userId: string,
  input: {
    name: string;
    mealType: string;
    servings: number;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    notes?: string;
    eatenAt: Date;
  },
) {
  await getNutritionEntryForUser(entryId, userId);
  const data = validateNutritionInput(input);
  if (Number.isNaN(input.eatenAt.getTime())) {
    throw new AppError("NUTRITION", "Enter a valid date.");
  }
  return prisma.nutritionEntry.update({
    where: { id: entryId },
    data: { ...data, eatenAt: input.eatenAt },
  });
}

export async function deleteNutritionEntryForUser(entryId: string, userId: string) {
  await getNutritionEntryForUser(entryId, userId);
  await prisma.nutritionEntry.delete({ where: { id: entryId } });
}

export async function listSavedMealsForUser(userId: string) {
  return prisma.savedMeal.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

export async function getSavedMealForUser(mealId: string, userId: string) {
  const row = await prisma.savedMeal.findUnique({ where: { id: mealId } });
  if (!row) {
    throw new NotFoundError("Saved meal not found.");
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("You cannot access another member's saved meal.");
  }
  return row;
}

export async function deleteSavedMealForUser(mealId: string, userId: string) {
  await getSavedMealForUser(mealId, userId);
  await prisma.savedMeal.delete({ where: { id: mealId } });
}

export async function createSavedMealForUser(
  userId: string,
  input: {
    name: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  },
) {
  const data = validateNutritionInput({
    ...input,
    mealType: "snack",
    servings: 1,
  });
  return prisma.savedMeal.create({
    data: {
      userId,
      name: data.name,
      servingLabel: data.servingLabel,
      calories: data.calories,
      proteinG: data.proteinG,
      carbsG: data.carbsG,
      fatG: data.fatG,
    },
  });
}

export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export async function getTodayNutritionSummary(userId: string) {
  const entries = await prisma.nutritionEntry.findMany({
    where: {
      userId,
      eatenAt: { gte: startOfLocalDay(), lt: endOfLocalDay() },
    },
  });
  return {
    entryCount: entries.length,
    calories: entries.reduce((sum, row) => sum + row.calories, 0),
    proteinG: entries.reduce((sum, row) => sum + row.proteinG, 0),
    carbsG: entries.reduce((sum, row) => sum + row.carbsG, 0),
    fatG: entries.reduce((sum, row) => sum + row.fatG, 0),
  };
}
