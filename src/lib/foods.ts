export type DemoFood = {
  id: string;
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isDemo: true;
};

/**
 * Small built-in list so logging is faster. Every item is labeled DEMO.
 * Numbers are round estimates, not lab values. Members can still correct.
 */
export const DEMO_FOODS: DemoFood[] = [
  {
    id: "demo-chicken-breast",
    name: "DEMO — Chicken breast, cooked",
    servingLabel: "4 oz",
    calories: 180,
    proteinG: 35,
    carbsG: 0,
    fatG: 4,
    isDemo: true,
  },
  {
    id: "demo-ground-turkey",
    name: "DEMO — Ground turkey, cooked",
    servingLabel: "4 oz",
    calories: 190,
    proteinG: 28,
    carbsG: 0,
    fatG: 8,
    isDemo: true,
  },
  {
    id: "demo-salmon",
    name: "DEMO — Salmon, cooked",
    servingLabel: "4 oz",
    calories: 230,
    proteinG: 25,
    carbsG: 0,
    fatG: 14,
    isDemo: true,
  },
  {
    id: "demo-eggs",
    name: "DEMO — Eggs, scrambled",
    servingLabel: "2 eggs",
    calories: 180,
    proteinG: 12,
    carbsG: 2,
    fatG: 14,
    isDemo: true,
  },
  {
    id: "demo-greek-yogurt",
    name: "DEMO — Plain Greek yogurt",
    servingLabel: "1 cup",
    calories: 130,
    proteinG: 20,
    carbsG: 8,
    fatG: 0,
    isDemo: true,
  },
  {
    id: "demo-protein-shake",
    name: "DEMO — Whey protein shake",
    servingLabel: "1 scoop in water",
    calories: 120,
    proteinG: 24,
    carbsG: 3,
    fatG: 1,
    isDemo: true,
  },
  {
    id: "demo-white-rice",
    name: "DEMO — White rice, cooked",
    servingLabel: "1 cup",
    calories: 200,
    proteinG: 4,
    carbsG: 45,
    fatG: 0.5,
    isDemo: true,
  },
  {
    id: "demo-brown-rice",
    name: "DEMO — Brown rice, cooked",
    servingLabel: "1 cup",
    calories: 215,
    proteinG: 5,
    carbsG: 45,
    fatG: 2,
    isDemo: true,
  },
  {
    id: "demo-oatmeal",
    name: "DEMO — Oatmeal, cooked",
    servingLabel: "1 cup",
    calories: 160,
    proteinG: 6,
    carbsG: 28,
    fatG: 3,
    isDemo: true,
  },
  {
    id: "demo-sweet-potato",
    name: "DEMO — Sweet potato, baked",
    servingLabel: "1 medium",
    calories: 110,
    proteinG: 2,
    carbsG: 26,
    fatG: 0,
    isDemo: true,
  },
  {
    id: "demo-black-beans",
    name: "DEMO — Black beans, cooked",
    servingLabel: "1/2 cup",
    calories: 110,
    proteinG: 7,
    carbsG: 20,
    fatG: 0.5,
    isDemo: true,
  },
  {
    id: "demo-banana",
    name: "DEMO — Banana",
    servingLabel: "1 medium",
    calories: 105,
    proteinG: 1,
    carbsG: 27,
    fatG: 0,
    isDemo: true,
  },
  {
    id: "demo-apple",
    name: "DEMO — Apple",
    servingLabel: "1 medium",
    calories: 95,
    proteinG: 0,
    carbsG: 25,
    fatG: 0,
    isDemo: true,
  },
  {
    id: "demo-avocado",
    name: "DEMO — Avocado",
    servingLabel: "1/2 fruit",
    calories: 120,
    proteinG: 1,
    carbsG: 6,
    fatG: 11,
    isDemo: true,
  },
  {
    id: "demo-peanut-butter",
    name: "DEMO — Peanut butter",
    servingLabel: "1 tbsp",
    calories: 95,
    proteinG: 4,
    carbsG: 3,
    fatG: 8,
    isDemo: true,
  },
  {
    id: "demo-broccoli",
    name: "DEMO — Broccoli, cooked",
    servingLabel: "1 cup",
    calories: 55,
    proteinG: 4,
    carbsG: 11,
    fatG: 0.5,
    isDemo: true,
  },
  {
    id: "demo-mixed-salad",
    name: "DEMO — Mixed green salad, no dressing",
    servingLabel: "2 cups",
    calories: 20,
    proteinG: 2,
    carbsG: 4,
    fatG: 0,
    isDemo: true,
  },
  {
    id: "demo-tortilla",
    name: "DEMO — Whole wheat tortilla",
    servingLabel: "1 medium",
    calories: 130,
    proteinG: 4,
    carbsG: 22,
    fatG: 3,
    isDemo: true,
  },
];

export type SearchableMeal = {
  id: string;
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kind: "demo" | "saved";
};

export function searchFoodOptions(
  query: string,
  savedMeals: Array<{
    id: string;
    name: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>,
): SearchableMeal[] {
  const needle = query.trim().toLowerCase();
  const saved: SearchableMeal[] = savedMeals.map((meal) => ({
    ...meal,
    kind: "saved" as const,
  }));
  const demo: SearchableMeal[] = DEMO_FOODS.map((food) => ({
    id: food.id,
    name: food.name,
    servingLabel: food.servingLabel,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    kind: "demo" as const,
  }));
  const all = [...saved, ...demo];
  if (!needle) {
    return all;
  }
  return all.filter((item) => item.name.toLowerCase().includes(needle));
}

export function getDemoFoodById(id: string) {
  return DEMO_FOODS.find((food) => food.id === id) ?? null;
}
