"use client";

import { useActionState } from "react";
import { generateGroceryListAction, type MealPrepActionState } from "@/app/actions/meal-prep";
import { StatusBanner } from "@/components/StatusBanner";
import { SIMPLE_SWAPS } from "@/lib/meal-prep";

export function MealPrepForm({
  meals,
}: {
  meals: { id: string; name: string; servingLabel: string }[];
}) {
  const [state, action, pending] = useActionState(
    generateGroceryListAction,
    {} as MealPrepActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="title"
        placeholder="This week's grocery list"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <ul className="space-y-2">
        {meals.map((meal) => (
          <li key={meal.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
            <div>
              <p className="text-sm font-semibold">{meal.name}</p>
              <p className="text-xs text-muted">{meal.servingLabel}</p>
            </div>
            <label className="text-xs">
              Portions
              <input
                name={`servings-${meal.id}`}
                type="number"
                min={0}
                max={21}
                defaultValue={0}
                className="mt-1 w-20 rounded-lg border border-line bg-background px-2 py-2"
              />
            </label>
          </li>
        ))}
      </ul>
      <fieldset className="space-y-2 rounded-xl border border-line p-3">
        <legend className="text-sm font-semibold">Simple swaps</legend>
        {Object.entries(SIMPLE_SWAPS).map(([from, to]) => (
          <label key={from} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={`swap:${from}`} className="h-5 w-5 accent-accent" />
            {from} → {to}
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={pending || meals.length === 0}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Building…" : "Generate grocery list"}
      </button>
    </form>
  );
}
