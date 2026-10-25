"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { NutritionEntryForm } from "@/components/nutrition/NutritionEntryForm";
import { EmptyState } from "@/components/EmptyState";
import { CELEBRATION_COPY } from "@/components/celebration/Celebration";
import type { NutritionSavedValues } from "@/app/actions/nutrition";
import type { NutritionDaySummary } from "@/lib/nutrition";
import { dayKey, formatMemberDateTime } from "@/lib/timezone";

type SavedMeal = {
  id: string;
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type FuelEntry = {
  id: string;
  name: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  eatenAt: string;
  source: string;
};

export function FuelBoard({
  entries: initialEntries,
  today: initialToday,
  savedMeals,
  defaultMeal,
  timeZone,
  defaultEatenAt,
}: {
  entries: FuelEntry[];
  today: NutritionDaySummary;
  savedMeals: SavedMeal[];
  defaultMeal: string;
  timeZone: string;
  defaultEatenAt: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [today, setToday] = useState(initialToday);
  const [streak, setStreak] = useState(false);
  const appliedSave = useRef("");
  const todayKey = dayKey(new Date(), timeZone);

  function onSaved(saved: NutritionSavedValues, celebrate: boolean) {
    const key = `${saved.id}:${saved.eatenAt}:${saved.calories}:${saved.proteinG}`;
    if (appliedSave.current === key) return;
    appliedSave.current = key;
    setEntries((current) => {
      if (current.some((row) => row.id === saved.id)) {
        return current.map((row) =>
          row.id === saved.id
            ? {
                id: saved.id,
                name: saved.name,
                mealType: saved.mealType,
                calories: saved.calories,
                proteinG: saved.proteinG,
                carbsG: saved.carbsG,
                fatG: saved.fatG,
                eatenAt: saved.eatenAt,
                source: saved.source,
              }
            : row,
        );
      }
      return [
        {
          id: saved.id,
          name: saved.name,
          mealType: saved.mealType,
          calories: saved.calories,
          proteinG: saved.proteinG,
          carbsG: saved.carbsG,
          fatG: saved.fatG,
          eatenAt: saved.eatenAt,
          source: saved.source,
        },
        ...current,
      ];
    });
    if (dayKey(new Date(saved.eatenAt), timeZone) === todayKey) {
      setToday((current) => {
        const previous = current.entryCount === 0 ? null : entries.find((row) => row.id === saved.id);
        if (previous) {
          return {
            entryCount: current.entryCount,
            calories: current.calories - previous.calories + saved.calories,
            proteinG: current.proteinG - previous.proteinG + saved.proteinG,
            carbsG: current.carbsG - previous.carbsG + saved.carbsG,
            fatG: current.fatG - previous.fatG + saved.fatG,
          };
        }
        return {
          entryCount: current.entryCount + 1,
          calories: current.calories + saved.calories,
          proteinG: current.proteinG + saved.proteinG,
          carbsG: current.carbsG + saved.carbsG,
          fatG: current.fatG + saved.fatG,
        };
      });
    }
    if (celebrate) setStreak(true);
  }

  const streakCopy = CELEBRATION_COPY.streak;

  return (
    <>
      <section className="min-w-0 rounded-2xl border border-line bg-card p-5" data-fuel-today>
        <h2>Today (manual estimates)</h2>
        <p className="mt-2 break-words text-sm text-muted">
          {today.entryCount} item{today.entryCount === 1 ? "" : "s"} · {Math.round(today.calories)} kcal · P{" "}
          {Math.round(today.proteinG)}g · C {Math.round(today.carbsG)}g · F {Math.round(today.fatG)}g
        </p>
      </section>

      {streak && streakCopy ? (
        <section
          data-fuel-streak
          className="rounded-2xl border border-[#CBF805] bg-black px-4 py-4 text-white"
        >
          <p className="font-display text-xs uppercase tracking-wide text-[#CBF805]">{streakCopy.title}</p>
          <p className="mt-2 text-sm">{streakCopy.body}</p>
        </section>
      ) : null}

      <NutritionEntryForm
        savedMeals={savedMeals}
        defaultMeal={defaultMeal}
        timeZone={timeZone}
        defaultEatenAt={defaultEatenAt}
        onSaved={onSaved}
      />

      <section className="min-w-0 space-y-3" data-coach-clear data-fuel-log>
        <h2 className="text-lg">Your log</h2>
        {entries.length === 0 ? (
          <EmptyState title="No meals yet">
            Search a food or type an estimate above. Numbers stay yours to correct.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  data-testid={`nutrition-entry-${entry.id}`}
                  href={`/nutrition/${entry.id}`}
                  className="block min-w-0 rounded-2xl border border-line bg-card p-4 hover:border-accent"
                >
                  <p className="break-words font-semibold">{entry.name}</p>
                  <p className="break-words text-sm text-muted">
                    {entry.mealType} · {formatMemberDateTime(new Date(entry.eatenAt), timeZone)} ·{" "}
                    {Math.round(entry.calories)} kcal · source: {entry.source.replace("_", " ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
