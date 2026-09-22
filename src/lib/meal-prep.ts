import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { DEMO_FOODS } from "@/lib/foods";
import { getProfileForUser } from "@/lib/profile";

export type GroceryItem = {
  name: string;
  quantity: number;
  unit: string;
};

export type MealPrepLine = {
  mealName: string;
  servings: number;
  ingredients: GroceryItem[];
};

const DEMO_INGREDIENTS: Record<string, GroceryItem[]> = {
  "demo-chicken-breast": [{ name: "chicken breast", quantity: 4, unit: "oz" }],
  "demo-ground-turkey": [{ name: "ground turkey", quantity: 4, unit: "oz" }],
  "demo-salmon": [{ name: "salmon fillet", quantity: 4, unit: "oz" }],
  "demo-eggs": [{ name: "eggs", quantity: 2, unit: "count" }],
  "demo-greek-yogurt": [{ name: "plain Greek yogurt", quantity: 1, unit: "cup" }],
  "demo-protein-shake": [{ name: "whey protein", quantity: 1, unit: "scoop" }],
  "demo-white-rice": [{ name: "white rice, dry", quantity: 0.33, unit: "cup" }],
  "demo-brown-rice": [{ name: "brown rice, dry", quantity: 0.33, unit: "cup" }],
  "demo-oats": [{ name: "rolled oats", quantity: 0.5, unit: "cup" }],
  "demo-banana": [{ name: "banana", quantity: 1, unit: "count" }],
  "demo-apple": [{ name: "apple", quantity: 1, unit: "count" }],
  "demo-broccoli": [{ name: "broccoli", quantity: 1, unit: "cup" }],
  "demo-spinach": [{ name: "spinach", quantity: 2, unit: "cup" }],
  "demo-olive-oil": [{ name: "olive oil", quantity: 1, unit: "tbsp" }],
};

export const SIMPLE_SWAPS: Record<string, string> = {
  "chicken breast": "turkey breast",
  "ground turkey": "lean ground beef",
  "salmon fillet": "cod",
  "white rice, dry": "cauliflower rice",
  "brown rice, dry": "quinoa, dry",
  "whey protein": "plant protein",
  eggs: "egg whites",
  banana: "berries",
};

export function parseIngredientsJson(raw: string): GroceryItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { name?: string; quantity?: number; unit?: string };
        const name = String(row.name ?? "").trim().toLowerCase();
        if (!name) return null;
        return {
          name,
          quantity: Number.isFinite(row.quantity) ? Number(row.quantity) : 1,
          unit: String(row.unit ?? "item").trim() || "item",
        };
      })
      .filter((row): row is GroceryItem => Boolean(row));
  } catch {
    return [];
  }
}

export function parseIngredientLines(text: string): GroceryItem[] {
  return text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+(?:\.\d+)?)\s+(\S+)\s+(.+)$/.exec(line);
      if (match) {
        return { quantity: Number(match[1]), unit: match[2], name: match[3].toLowerCase() };
      }
      return { quantity: 1, unit: "item", name: line.toLowerCase() };
    });
}

export function ingredientsForSavedMeal(meal: {
  name: string;
  ingredientsJson?: string | null;
}): GroceryItem[] {
  const stored = parseIngredientsJson(meal.ingredientsJson ?? "[]");
  if (stored.length > 0) return stored;
  const demo = DEMO_FOODS.find((food) => food.name === meal.name);
  if (demo && DEMO_INGREDIENTS[demo.id]) {
    return DEMO_INGREDIENTS[demo.id];
  }
  return [{ name: meal.name.replace(/^DEMO — /i, "").toLowerCase(), quantity: 1, unit: "serving" }];
}

export function scaleItems(items: GroceryItem[], servings: number): GroceryItem[] {
  const factor = Number.isFinite(servings) && servings > 0 ? servings : 1;
  return items.map((item) => ({
    ...item,
    quantity: Math.round(item.quantity * factor * 100) / 100,
  }));
}

export function applySwaps(items: GroceryItem[], swaps: Record<string, string>): GroceryItem[] {
  return items.map((item) => ({
    ...item,
    name: (swaps[item.name] ?? item.name).toLowerCase(),
  }));
}

export function mergeGroceryItems(lines: GroceryItem[]): GroceryItem[] {
  const map = new Map<string, GroceryItem>();
  for (const item of lines) {
    const key = `${item.name}|${item.unit}`;
    const current = map.get(key);
    if (current) {
      current.quantity = Math.round((current.quantity + item.quantity) * 100) / 100;
    } else {
      map.set(key, { ...item });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function allergyHits(items: GroceryItem[], allergies: string) {
  const tokens = allergies
    .toLowerCase()
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  if (tokens.length === 0) return [];
  return items.filter((item) => tokens.some((token) => item.name.includes(token)));
}

export async function generateGroceryListForUser(input: {
  userId: string;
  title: string;
  lines: MealPrepLine[];
  swaps: Record<string, string>;
}) {
  if (input.lines.length === 0) {
    throw new AppError("MEAL_PREP", "Pick at least one saved meal.");
  }
  const scaled = input.lines.flatMap((line) =>
    applySwaps(scaleItems(line.ingredients, line.servings), input.swaps),
  );
  const items = mergeGroceryItems(scaled);
  const profile = await getProfileForUser(input.userId);
  const hits = allergyHits(items, profile?.allergies ?? "");
  const notes = hits.length
    ? `Verify ingredients. Possible allergy matches from your profile: ${hits.map((row) => row.name).join(", ")}.`
    : "Estimates only. Verify ingredients yourself if you have allergies. This is not a medical meal plan.";
  return prisma.groceryList.create({
    data: {
      userId: input.userId,
      title: (input.title.trim() || "Meal-prep grocery list").slice(0, 80),
      itemsJson: JSON.stringify(items),
      notes,
    },
  });
}

export async function listGroceryListsForUser(userId: string) {
  return prisma.groceryList.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGroceryListForUser(listId: string, userId: string) {
  const row = await prisma.groceryList.findUnique({ where: { id: listId } });
  if (!row || row.userId !== userId) {
    throw new ForbiddenError("You cannot open another member's grocery list.");
  }
  return { ...row, items: parseIngredientsJson(row.itemsJson) };
}
