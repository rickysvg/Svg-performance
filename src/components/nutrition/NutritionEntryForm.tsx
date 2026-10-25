"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  saveNutritionEntryAction,
  type NutritionActionState,
  type NutritionSavedValues,
} from "@/app/actions/nutrition";
import { StatusBanner } from "@/components/StatusBanner";
import { MEAL_TYPES } from "@/lib/nutrition";
import { searchFoodOptions, type SearchableMeal } from "@/lib/foods";
import { APP_TIMEZONE, formatDateTimeLocal } from "@/lib/timezone";

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
  servings?: number;
  notes?: string;
  eatenAtLocal?: string;
  savedMealId?: string;
};

export function NutritionEntryForm({
  savedMeals,
  entry,
  defaultMeal,
  timeZone = APP_TIMEZONE,
  defaultEatenAt,
  onSaved,
}: {
  savedMeals: Saved[];
  /** Meal for the member's clock, computed on the server so SSR matches. */
  defaultMeal?: string;
  /** Member zone. The When field is wall time in this zone, not the server clock. */
  timeZone?: string;
  /** Wall time for a new entry, computed on the server. */
  defaultEatenAt?: string;
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
  /** Fired after a save so the fuel page can update totals and the list in place. */
  onSaved?: (saved: NutritionSavedValues, celebrate: boolean) => void;
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
  const [appliedSave, setAppliedSave] = useState<number | undefined>();
  const onSavedRef = useRef(onSaved);
  const reportedSave = useRef<number | undefined>(undefined);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);
  useEffect(() => {
    if (!state.savedAt || !state.saved || reportedSave.current === state.savedAt) return;
    reportedSave.current = state.savedAt;
    onSavedRef.current?.(state.saved, Boolean(state.celebrate));
  }, [state.savedAt, state.saved, state.celebrate]);
  if (state.savedAt && state.saved && appliedSave !== state.savedAt) {
    setAppliedSave(state.savedAt);
    if (entry) {
      setPrefill({
        name: state.saved.name,
        servingLabel: state.saved.servingLabel,
        calories: state.saved.calories,
        proteinG: state.saved.proteinG,
        carbsG: state.saved.carbsG,
        fatG: state.saved.fatG,
        servings: state.saved.servings,
        notes: state.saved.notes,
        eatenAtLocal: formatDateTimeLocal(new Date(state.saved.eatenAt), timeZone),
      });
      setMealType(state.saved.mealType);
    } else {
      setPrefill(null);
      setQuery("");
      setMealType(defaultMeal ?? "breakfast");
    }
    setFormKey((value) => value + 1);
  }
  const eatenAtValue =
    prefill?.eatenAtLocal ??
    (entry
      ? formatDateTimeLocal(new Date(entry.eatenAt), timeZone)
      : defaultEatenAt ?? formatDateTimeLocal(new Date(), timeZone));

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
      aria-busy={pending}
      data-nutrition-saving={pending ? "true" : undefined}
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
            defaultValue={prefill?.servings ?? entry?.servings ?? 1}
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
      <div className="grid min-w-0 grid-cols-3 gap-2 [&>*]:min-w-0">
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
          defaultValue={eatenAtValue}
          className="mt-1 w-full min-w-0 max-w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Notes
        <textarea
          data-testid="nutrition-notes"
          name="notes"
          defaultValue={prefill?.notes ?? entry?.notes}
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
        className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? (
          <>
            <span
              data-nutrition-spinner
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              aria-hidden
            />
            Saving…
          </>
        ) : entry ? (
          "Save correction"
        ) : (
          "Save estimate"
        )}
      </button>
    </form>
  );
}
