import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";
import { getTrialState } from "@/lib/trial";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import {
  getTodayNutritionSummary,
  listNutritionEntriesForUser,
  listSavedMealsForUser,
  mealTypeForZonedNow,
} from "@/lib/nutrition";
import { FuelBoard } from "@/components/nutrition/FuelBoard";
import { SavedMealForm } from "@/components/nutrition/SavedMealForm";
import { formatDateTimeLocal } from "@/lib/timezone";

export default async function NutritionPage() {
  const user = await requireUser();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    const trial = await getTrialState(user.id);
    return (
      <main className="space-y-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">Fuel</h1>
        <UpgradePreview
          kind="fuel"
          canStartTrial={trial.canStartTrial}
          trialDays={trial.trialLengthDays}
          next="/nutrition"
        />
      </main>
    );
  }

  const [profile, entries, saved, today, timeZone] = await Promise.all([
    getProfileForUser(user.id),
    listNutritionEntriesForUser(user.id),
    listSavedMealsForUser(user.id),
    getTodayNutritionSummary(user.id),
    timeZoneForUser(user.id),
  ]);
  const defaultMeal = mealTypeForZonedNow(new Date(), timeZone);

  return (
    <main className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl">Nutrition</h1>
        <p className="mt-1 text-sm text-muted">Your estimates. Not medical advice.</p>
      </div>

      {(profile?.allergies || profile?.foodPreferences) && (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          Preferences: {profile.foodPreferences || "none listed"}. Avoid:{" "}
          {profile.allergies || "none listed"}.
        </p>
      )}

      <FuelBoard
        today={today}
        savedMeals={saved}
        defaultMeal={defaultMeal}
        timeZone={timeZone}
        defaultEatenAt={formatDateTimeLocal(new Date(), timeZone)}
        entries={entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          mealType: entry.mealType,
          calories: entry.calories,
          proteinG: entry.proteinG,
          carbsG: entry.carbsG,
          fatG: entry.fatG,
          eatenAt: new Date(entry.eatenAt).toISOString(),
          source: entry.source,
        }))}
      />
      <details className="rounded-2xl border border-line bg-card px-4 py-3">
        <summary className="cursor-pointer font-semibold">More</summary>
        <div className="mt-4 space-y-4">
          <SavedMealForm />
          <p className="text-sm">
            <Link href="/nutrition/prep" className="text-accent underline">
              Meal-prep → portions, swaps, grocery list
            </Link>
          </p>
        </div>
      </details>

    </main>
  );
}
