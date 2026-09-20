import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { PaywallNotice } from "@/components/PaywallNotice";
import { getProfileForUser } from "@/lib/profile";
import {
  getTodayNutritionSummary,
  listNutritionEntriesForUser,
  listSavedMealsForUser,
} from "@/lib/nutrition";
import { NutritionEntryForm } from "@/components/nutrition/NutritionEntryForm";
import { SavedMealForm } from "@/components/nutrition/SavedMealForm";

export default async function NutritionPage() {
  const user = await requireUser();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    return <PaywallNotice feature="Nutrition" />;
  }

  const [profile, entries, saved, today] = await Promise.all([
    getProfileForUser(user.id),
    listNutritionEntriesForUser(user.id),
    listSavedMealsForUser(user.id),
    getTodayNutritionSummary(user.id),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nutrition</h1>
        <p className="mt-1 text-sm text-muted">
          Manual entries only. Calories and macros are{" "}
          <strong className="text-foreground">your estimates</strong>, labeled
          as manual estimates. This is not medical advice. Verify ingredients
          yourself if you have allergies.
        </p>
      </div>

      {(profile?.allergies || profile?.foodPreferences) && (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          Preferences: {profile.foodPreferences || "none listed"}. Avoid:{" "}
          {profile.allergies || "none listed"}.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Today (manual estimates)</h2>
        <p className="mt-2 text-sm text-muted">
          {today.entryCount} item{today.entryCount === 1 ? "" : "s"} ·{" "}
          {Math.round(today.calories)} kcal · P {Math.round(today.proteinG)}g · C{" "}
          {Math.round(today.carbsG)}g · F {Math.round(today.fatG)}g
        </p>
      </section>

      <NutritionEntryForm savedMeals={saved} />
      <SavedMealForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your log</h2>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
            No meals yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/nutrition/${entry.id}`}
                  className="block rounded-2xl border border-line bg-card p-4 hover:border-accent"
                >
                  <p className="font-semibold">{entry.name}</p>
                  <p className="text-sm text-muted">
                    {entry.mealType} · {new Date(entry.eatenAt).toLocaleString()} ·{" "}
                    {Math.round(entry.calories)} kcal · source: {entry.source.replace("_", " ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
