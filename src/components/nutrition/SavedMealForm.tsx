"use client";

import { useActionState } from "react";
import {
  saveMealTemplateAction,
  type NutritionActionState,
} from "@/app/actions/nutrition";
import { StatusBanner } from "@/components/StatusBanner";

export function SavedMealForm() {
  const [state, action, pending] = useActionState(
    saveMealTemplateAction,
    {} as NutritionActionState,
  );
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2>Save a meal you repeat</h2>
      <StatusBanner error={state.error} success={state.success} />
      <input
        data-testid="nutrition-name-2"
        name="name"
        required
        placeholder="Name"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input
        data-testid="nutrition-serving-label-2"
        name="servingLabel"
        placeholder="serving"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <textarea
        data-testid="nutrition-ingredients"
        name="ingredients"
        rows={2}
        placeholder="Ingredients (optional): 4 oz chicken breast, 1 cup rice"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <div className="grid grid-cols-2 gap-3">
        <input data-testid="nutrition-calories-2" name="calories" type="number" min={0} placeholder="kcal" className="rounded-xl border border-line bg-background px-3 py-3" />
        <input data-testid="nutrition-protein-g-2" name="proteinG" type="number" min={0} placeholder="protein g" className="rounded-xl border border-line bg-background px-3 py-3" />
        <input data-testid="nutrition-carbs-g-2" name="carbsG" type="number" min={0} placeholder="carbs g" className="rounded-xl border border-line bg-background px-3 py-3" />
        <input data-testid="nutrition-fat-g-2" name="fatG" type="number" min={0} placeholder="fat g" className="rounded-xl border border-line bg-background px-3 py-3" />
      </div>
      <button
        data-testid="nutrition-save-meal-template"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save meal template"}
      </button>
    </form>
  );
}
