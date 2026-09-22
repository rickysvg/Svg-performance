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

export type NutritionActionState = { error?: string; success?: string };

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

function parseEntry(formData: FormData) {
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
    eatenAt: new Date(String(formData.get("eatenAt") ?? "")),
    savedMealId: String(formData.get("savedMealId") ?? "") || null,
  };
}

export async function saveNutritionEntryAction(
  _prev: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  let celebrateStreak = false;
  try {
    const user = await requireNutritionUser();
    const entryId = String(formData.get("entryId") ?? "");
    const payload = parseEntry(formData);
    celebrateStreak = !entryId ? !(await hasActivityOnLocalDay(user.id, payload.eatenAt)) : false;
    if (entryId) {
      await updateNutritionEntryForUser(entryId, user.id, payload);
    } else {
      await createNutritionEntryForUser(user.id, payload);
    }
    revalidatePath("/nutrition");
    revalidatePath("/home");
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
  if (celebrateStreak) {
    redirect("/nutrition?celebrate=streak");
  }
  return { success: "Food log saved. These numbers are your manual estimates." };
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
