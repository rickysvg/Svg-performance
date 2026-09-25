import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { METRIC_NAMES, recordMetric } from "@/lib/metrics";
import { parseIngredientLines } from "@/lib/meal-prep";
import { timeZoneForUser } from "@/lib/profile";
import {
  APP_TIMEZONE,
  addZonedDays,
  dayKey as zonedDayKey,
  endOfZonedDay,
  startOfZonedDay,
} from "@/lib/timezone";

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
    ingredientsText?: string;
  },
) {
  const data = validateNutritionInput({
    ...input,
    mealType: "snack",
    servings: 1,
  });
  const ingredients = parseIngredientLines(input.ingredientsText ?? "");
  return prisma.savedMeal.create({
    data: {
      userId,
      name: data.name,
      servingLabel: data.servingLabel,
      calories: data.calories,
      proteinG: data.proteinG,
      carbsG: data.carbsG,
      fatG: data.fatG,
      ingredientsJson: JSON.stringify(ingredients),
    },
  });
}

export function startOfLocalDay(date = new Date(), timeZone = APP_TIMEZONE) {
  return startOfZonedDay(date, timeZone);
}

export function endOfLocalDay(date = new Date(), timeZone = APP_TIMEZONE) {
  return endOfZonedDay(date, timeZone);
}

export type NutritionDaySummary = {
  entryCount: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function summarizeEntries(
  entries: Array<{ calories: number; proteinG: number; carbsG: number; fatG: number }>,
): NutritionDaySummary {
  return {
    entryCount: entries.length,
    calories: entries.reduce((sum, row) => sum + row.calories, 0),
    proteinG: entries.reduce((sum, row) => sum + row.proteinG, 0),
    carbsG: entries.reduce((sum, row) => sum + row.carbsG, 0),
    fatG: entries.reduce((sum, row) => sum + row.fatG, 0),
  };
}

export async function getNutritionSummaryForDay(
  userId: string,
  day = new Date(),
  timeZone?: string,
) {
  const tz = timeZone ?? (await timeZoneForUser(userId));
  const entries = await prisma.nutritionEntry.findMany({
    where: {
      userId,
      eatenAt: { gte: startOfLocalDay(day, tz), lt: endOfLocalDay(day, tz) },
    },
  });
  return summarizeEntries(entries);
}

export async function getTodayNutritionSummary(userId: string, timeZone?: string) {
  return getNutritionSummaryForDay(userId, new Date(), timeZone);
}

export async function getRecentNutritionDays(
  userId: string,
  days = 7,
  now = new Date(),
  timeZone?: string,
) {
  const tz = timeZone ?? (await timeZoneForUser(userId));
  const todayStart = startOfLocalDay(now, tz);
  const start = addZonedDays(todayStart, -(days - 1), tz);
  const entries = await prisma.nutritionEntry.findMany({
    where: { userId, eatenAt: { gte: start } },
    orderBy: { eatenAt: "asc" },
  });
  const byDay = new Map<string, NutritionDaySummary>();
  for (let i = 0; i < days; i += 1) {
    const d = addZonedDays(start, i, tz);
    byDay.set(zonedDayKey(d, tz), {
      entryCount: 0,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  }
  for (const row of entries) {
    const key = zonedDayKey(row.eatenAt, tz);
    const current = byDay.get(key);
    if (!current) continue;
    current.entryCount += 1;
    current.calories += row.calories;
    current.proteinG += row.proteinG;
    current.carbsG += row.carbsG;
    current.fatG += row.fatG;
  }
  return [...byDay.entries()].map(([key, summary]) => ({ day: key, ...summary }));
}
