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
      <h2 className="font-semibold">Save a meal you repeat</h2>
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="name"
        required
        placeholder="Name"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input
        name="servingLabel"
        placeholder="serving"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <div className="grid grid-cols-2 gap-3">
        <input name="calories" type="number" min={0} placeholder="kcal" className="rounded-xl border border-line bg-background px-3 py-3" />
        <input name="proteinG" type="number" min={0} placeholder="protein g" className="rounded-xl border border-line bg-background px-3 py-3" />
        <input name="carbsG" type="number" min={0} placeholder="carbs g" className="rounded-xl border border-line bg-background px-3 py-3" />
        <input name="fatG" type="number" min={0} placeholder="fat g" className="rounded-xl border border-line bg-background px-3 py-3" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save meal template"}
      </button>
    </form>
  );
}
