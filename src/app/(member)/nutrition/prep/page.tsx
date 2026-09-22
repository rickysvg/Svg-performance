import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canUseMemberTools } from "@/lib/access";
import { PaywallNotice } from "@/components/PaywallNotice";
import { getProfileForUser } from "@/lib/profile";
import { listSavedMealsForUser } from "@/lib/nutrition";
import { listGroceryListsForUser, parseIngredientsJson } from "@/lib/meal-prep";
import { MealPrepForm } from "@/components/nutrition/MealPrepForm";
import { EmptyState } from "@/components/EmptyState";

export default async function MealPrepPage() {
  const user = await requireUser();
  const access = await canUseMemberTools(user.id);
  if (!access.allowed) {
    return <PaywallNotice feature="Meal-prep" />;
  }
  const [profile, meals, lists] = await Promise.all([
    getProfileForUser(user.id),
    listSavedMealsForUser(user.id),
    listGroceryListsForUser(user.id),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/nutrition" className="text-sm text-accent underline">
          Back to Fuel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Meal-prep</h1>
        <p className="mt-1 text-sm text-muted">
          Scale portions from saved meals, apply a simple swap, then generate a grocery
          list. Numbers stay <strong className="text-foreground">manual estimates</strong>
          . This is not a medical meal plan. Verify ingredients if you have allergies.
        </p>
      </div>
      {(profile?.allergies || profile?.foodPreferences) && (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          Preferences: {profile.foodPreferences || "none listed"}. Avoid:{" "}
          {profile.allergies || "none listed"}.
        </p>
      )}
      {meals.length === 0 ? (
        <EmptyState title="Save a meal first">
          Fuel → save a meal template, then come back to set portions.
        </EmptyState>
      ) : (
        <MealPrepForm meals={meals} />
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">Grocery lists</h2>
        {lists.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          lists.map((list) => {
            const items = parseIngredientsJson(list.itemsJson);
            return (
              <article key={list.id} className="rounded-2xl border border-line bg-card p-4">
                <h3 className="font-semibold">{list.title}</h3>
                <p className="mt-1 text-xs text-muted">{list.notes}</p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {items.map((item) => (
                    <li key={`${item.name}-${item.unit}`}>
                      {item.quantity} {item.unit} {item.name}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
