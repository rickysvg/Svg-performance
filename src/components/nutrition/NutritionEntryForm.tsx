"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveNutritionEntryAction,
  type NutritionActionState,
} from "@/app/actions/nutrition";
import { StatusBanner } from "@/components/StatusBanner";
import { MEAL_TYPES } from "@/lib/nutrition";
import { searchFoodOptions, type SearchableMeal } from "@/lib/foods";

type Saved = {
  id: string;
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type Prefill = {
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  savedMealId?: string;
};

function toDateInput(value?: Date | string) {
  const date = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NutritionEntryForm({
  savedMeals,
  entry,
  defaultMeal,
}: {
  savedMeals: Saved[];
  /** Meal for the member's clock, computed on the server so SSR matches. */
  defaultMeal?: string;
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
  const [query, setQuery] = useState("");
  const [prefill, setPrefill] = useState<Prefill | null>(
    entry
      ? {
          name: entry.name,
          servingLabel: entry.servingLabel,
          calories: entry.calories,
          proteinG: entry.proteinG,
          carbsG: entry.carbsG,
          fatG: entry.fatG,
        }
      : null,
  );
  const [formKey, setFormKey] = useState(0);
  const [mealType, setMealType] = useState(entry?.mealType ?? defaultMeal ?? "breakfast");
  const [clearedFor, setClearedFor] = useState<number | undefined>();
  if (!entry && state.savedAt && clearedFor !== state.savedAt) {
    setClearedFor(state.savedAt);
    setPrefill(null);
    setQuery("");
    setMealType(defaultMeal ?? "breakfast");
    setFormKey((value) => value + 1);
  }

  const matches = useMemo(
    () => searchFoodOptions(query, savedMeals).slice(0, 8),
    [query, savedMeals],
  );

  function applyItem(item: SearchableMeal) {
    setPrefill({
      name: item.name,
      servingLabel: item.servingLabel,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      savedMealId: item.kind === "saved" ? item.id : undefined,
    });
    setFormKey((value) => value + 1);
    setQuery("");
  }

  return (
    <form
      data-testid="nutrition-form"
      key={formKey}
      action={action}
      className="space-y-4 rounded-2xl border border-line bg-card p-5"
    >
      <h2 className="text-lg">
        {entry ? "Correct this entry" : "Log a meal or snack"}
      </h2>
      <StatusBanner error={state.error} success={state.success} />
      {entry ? <input type="hidden" name="entryId" value={entry.id} /> : null}
      {prefill?.savedMealId ? (
        <input type="hidden" name="savedMealId" value={prefill.savedMealId} />
      ) : null}
      <p className="text-xs text-muted">Your estimate. Not medical advice.</p>
      {!entry ? (
        <div>
          <label className="block text-sm">
            Search saved meals or foods
            <input
              data-testid="nutrition-chicken-rice-yogurt"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chicken, rice, yogurt…"
              className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
            />
          </label>
          {query.trim() ? (
            <ul className="mt-2 max-h-56 overflow-auto rounded-xl border border-line">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">No matches.</li>
              ) : (
                matches.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => applyItem(item)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent/10"
                    >
                      <span>
                        {item.name}
                        {item.kind === "saved" ? (
                          <span className="ml-2 text-xs text-muted">saved</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted">
                        {Math.round(item.calories)} kcal / {item.servingLabel}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
      <label className="block text-sm">
        Name
        <input
          data-testid="nutrition-name"
          name="name"
          required
          defaultValue={prefill?.name ?? entry?.name}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Calories (estimate)
        <input
          data-testid="nutrition-calories"
          name="calories"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={prefill?.calories ?? entry?.calories ?? ""}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Meal
        <select
          data-testid="nutrition-meal-type"
          name="mealType"
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
          data-meal-type
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {MEAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <details className="rounded-xl border border-line px-3 py-3">
        <summary className="cursor-pointer text-sm font-semibold">More</summary>
        <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Servings
          <input
            data-testid="nutrition-servings"
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
            data-testid="nutrition-serving-label"
            name="servingLabel"
            defaultValue={prefill?.servingLabel ?? entry?.servingLabel ?? "serving"}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm">
          Protein g
          <input
            data-testid="nutrition-protein-g"
            name="proteinG"
            type="number"
            min={0}
            step="0.1"
            defaultValue={prefill?.proteinG ?? entry?.proteinG ?? 0}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Carbs g
          <input
            data-testid="nutrition-carbs-g"
            name="carbsG"
            type="number"
            min={0}
            step="0.1"
            defaultValue={prefill?.carbsG ?? entry?.carbsG ?? 0}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Fat g
          <input
            data-testid="nutrition-fat-g"
            name="fatG"
            type="number"
            min={0}
            step="0.1"
            defaultValue={prefill?.fatG ?? entry?.fatG ?? 0}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
      </div>
      <label className="block text-sm">
        When
        <input
          data-testid="nutrition-eaten-at"
          name="eatenAt"
          type="datetime-local"
          defaultValue={toDateInput(entry?.eatenAt)}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Notes
        <textarea
          data-testid="nutrition-notes"
          name="notes"
          defaultValue={entry?.notes}
          rows={2}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
        </div>
      </details>
      <button
        data-testid="nutrition-save-estimate"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : entry ? "Save correction" : "Save estimate"}
      </button>
    </form>
  );
}
