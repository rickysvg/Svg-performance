"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { AppError } from "@/lib/errors";
import {
  createNutritionEntryForUser,
  createSavedMealForUser,
  deleteNutritionEntryForUser,
  updateNutritionEntryForUser,
} from "@/lib/nutrition";
import { hasActivityOnLocalDay } from "@/lib/home";
import { publicErrorMessage } from "@/lib/errors";
import { timeZoneForUser } from "@/lib/profile";
import { parseDateTimeLocal } from "@/lib/timezone";

export type NutritionSavedValues = {
  name: string;
  mealType: string;
  servings: number;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string;
  eatenAt: string;
};

export type NutritionActionState = {
  error?: string;
  success?: string;
  savedAt?: number;
  saved?: NutritionSavedValues;
};

async function requireNutritionUser() {
  const user = await requireUserOrThrow();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    throw new AppError(
      "PAYWALL",
      "Nutrition is part of a TEST subscription. Access unlocks only after Stripe confirms payment.",
    );
  }
  return user;
}

function parseEatenAt(raw: string, timeZone: string) {
  const zoned = parseDateTimeLocal(raw, timeZone);
  if (zoned) return zoned;
  return new Date(raw);
}

function parseEntry(formData: FormData, timeZone: string) {
  return {
    name: String(formData.get("name") ?? ""),
    mealType: String(formData.get("mealType") ?? "snack"),
    servings: Number(formData.get("servings") ?? 1),
    servingLabel: String(formData.get("servingLabel") ?? "serving"),
    calories: Number(formData.get("calories") ?? 0),
    proteinG: Number(formData.get("proteinG") ?? 0),
    carbsG: Number(formData.get("carbsG") ?? 0),
    fatG: Number(formData.get("fatG") ?? 0),
    notes: String(formData.get("notes") ?? ""),
    eatenAt: parseEatenAt(String(formData.get("eatenAt") ?? ""), timeZone),
    savedMealId: String(formData.get("savedMealId") ?? "") || null,
  };
}

function savedValues(row: {
  name: string;
  mealType: string;
  servings: number;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string;
  eatenAt: Date;
}): NutritionSavedValues {
  return {
    name: row.name,
    mealType: row.mealType,
    servings: row.servings,
    servingLabel: row.servingLabel,
    calories: row.calories,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
    notes: row.notes,
    eatenAt: row.eatenAt.toISOString(),
  };
}

export async function saveNutritionEntryAction(
  _prev: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  let celebrateStreak = false;
  try {
    const user = await requireNutritionUser();
    const timeZone = await timeZoneForUser(user.id);
    const entryId = String(formData.get("entryId") ?? "");
    const payload = parseEntry(formData, timeZone);
    celebrateStreak = !entryId
      ? !(await hasActivityOnLocalDay(user.id, payload.eatenAt, timeZone))
      : false;
    const saved = entryId
      ? await updateNutritionEntryForUser(entryId, user.id, payload, timeZone)
      : await createNutritionEntryForUser(user.id, payload);
    revalidatePath("/nutrition");
    revalidatePath("/home");
    if (!celebrateStreak) {
      return {
        success: "Food log saved. These numbers are your manual estimates.",
        savedAt: Date.now(),
        saved: savedValues(saved),
      };
    }
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  redirect("/nutrition?celebrate=streak");
}

export async function deleteNutritionEntryAction(formData: FormData) {
  const user = await requireNutritionUser();
  await deleteNutritionEntryForUser(String(formData.get("entryId") ?? ""), user.id);
  revalidatePath("/nutrition");
  revalidatePath("/home");
  redirect("/nutrition");
}

export async function saveMealTemplateAction(
  _prev: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  try {
    const user = await requireNutritionUser();
    await createSavedMealForUser(user.id, {
      name: String(formData.get("name") ?? ""),
      servingLabel: String(formData.get("servingLabel") ?? "serving"),
      calories: Number(formData.get("calories") ?? 0),
      proteinG: Number(formData.get("proteinG") ?? 0),
      carbsG: Number(formData.get("carbsG") ?? 0),
      fatG: Number(formData.get("fatG") ?? 0),
      ingredientsText: String(formData.get("ingredients") ?? ""),
    });
    revalidatePath("/nutrition");
    return { success: "Saved meal stored for reuse." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
