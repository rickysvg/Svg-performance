"use client";

import { useActionState } from "react";
import {
  saveNutritionEntryAction,
  type NutritionActionState,
} from "@/app/actions/nutrition";
import { StatusBanner } from "@/components/StatusBanner";
import { MEAL_TYPES } from "@/lib/nutrition";

type Saved = {
  id: string;
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

function toDateInput(value?: Date | string) {
  const date = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NutritionEntryForm({
  savedMeals,
  entry,
}: {
  savedMeals: Saved[];
  entry?: {
    id: string;
    name: string;
    mealType: string;
    servings: number;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    notes: string;
    eatenAt: Date | string;
  };
}) {
  const [state, action, pending] = useActionState(
    saveNutritionEntryAction,
    {} as NutritionActionState,
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">
        {entry ? "Correct this entry" : "Log a meal or snack"}
      </h2>
      <StatusBanner error={state.error} success={state.success} />
      {entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}
      <p className="text-xs text-muted">
        Source is always <strong>manual estimate</strong>. There is no food database.
      </p>
      {!entry && savedMeals.length > 0 ? (
        <label className="block text-sm">
          Start from a saved meal (optional)
          <select
            name="savedMealId"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            defaultValue=""
          >
            <option value="">None — type it in</option>
            {savedMeals.map((meal) => (
              <option key={meal.id} value={meal.id}>
                {meal.name} ({Math.round(meal.calories)} kcal / {meal.servingLabel})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block text-sm">
        Name
        <input
          name="name"
          required
          defaultValue={entry?.name}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Meal
        <select
          name="mealType"
          defaultValue={entry?.mealType ?? "lunch"}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {MEAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Servings
          <input
            name="servings"
            type="number"
            min={0.1}
            step="0.1"
            defaultValue={entry?.servings ?? 1}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Serving label
          <input
            name="servingLabel"
            defaultValue={entry?.servingLabel ?? "serving"}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Calories (estimate)
          <input
            name="calories"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={entry?.calories ?? ""}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Protein g
          <input
            name="proteinG"
            type="number"
            min={0}
            step="0.1"
            defaultValue={entry?.proteinG ?? 0}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Carbs g
          <input
            name="carbsG"
            type="number"
            min={0}
            step="0.1"
            defaultValue={entry?.carbsG ?? 0}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Fat g
          <input
            name="fatG"
            type="number"
            min={0}
            step="0.1"
            defaultValue={entry?.fatG ?? 0}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <label className="block text-sm">
        When
        <input
          name="eatenAt"
          type="datetime-local"
          defaultValue={toDateInput(entry?.eatenAt)}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Notes
        <textarea
          name="notes"
          defaultValue={entry?.notes}
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : entry ? "Save correction" : "Save estimate"}
      </button>
    </form>
  );
}
