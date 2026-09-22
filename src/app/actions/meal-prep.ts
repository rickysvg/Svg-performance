"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { publicErrorMessage } from "@/lib/errors";
import {
  SIMPLE_SWAPS,
  generateGroceryListForUser,
  ingredientsForSavedMeal,
  type MealPrepLine,
} from "@/lib/meal-prep";
import { listSavedMealsForUser } from "@/lib/nutrition";

export type MealPrepActionState = { error?: string; success?: string; listId?: string };

export async function generateGroceryListAction(
  _prev: MealPrepActionState,
  formData: FormData,
): Promise<MealPrepActionState> {
  try {
    const user = await requireUserOrThrow();
    const access = await canUseMemberTools(user.id);
    if (!access.allowed) {
      throw new AppError("PAYWALL", "Meal-prep is part of Nutrition on a TEST subscription.");
    }
    const saved = await listSavedMealsForUser(user.id);
    const lines: MealPrepLine[] = [];
    for (const meal of saved) {
      const servings = Number(formData.get(`servings-${meal.id}`) ?? 0);
      if (!Number.isFinite(servings) || servings <= 0) continue;
      lines.push({
        mealName: meal.name,
        servings,
        ingredients: ingredientsForSavedMeal(meal),
      });
    }
    const swaps: Record<string, string> = {};
    for (const [from, to] of Object.entries(SIMPLE_SWAPS)) {
      if (formData.get(`swap:${from}`) === "on") {
        swaps[from] = to;
      }
    }
    const list = await generateGroceryListForUser({
      userId: user.id,
      title: String(formData.get("title") ?? "Meal-prep grocery list"),
      lines,
      swaps,
    });
    revalidatePath("/nutrition/prep");
    revalidatePath("/nutrition");
    return { success: "Grocery list saved. Estimates only — verify ingredients.", listId: list.id };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
