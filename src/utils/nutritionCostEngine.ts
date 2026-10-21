import { MacroGoals, MacroMealSuggestion, Recipe, ServingsSize, WeeklyPlanItem } from '../types/freshdiy';

export interface NutritionEstimate {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
}

export interface CostSavingsEstimate {
  totalServings: number;
  mealsCount: number;
  helloFreshEstimatedCost: number;
  freshDiyGroceryCost: number;
  weeklySavings: number;
  annualSavings: number;
}

/**
 * Calculates or estimates nutrition macros per serving for a recipe.
 */
export function estimateRecipeNutrition(recipe: Recipe): NutritionEstimate {
  // Infer base nutrition from main ingredients
  let baseCals = 650;
  let baseProtein = 38;
  let baseCarbs = 62;
  let baseFat = 24;
  let baseFiber = 6;

  const titleLower = (recipe.title + ' ' + (recipe.subtitle || '')).toLowerCase();

  if (titleLower.includes('salad') || titleLower.includes('bowl')) {
    baseCals = 580;
    baseProtein = 32;
    baseCarbs = 54;
    baseFat = 20;
    baseFiber = 8;
  } else if (titleLower.includes('burger') || titleLower.includes('casserole') || titleLower.includes('pasta')) {
    baseCals = 740;
    baseProtein = 42;
    baseCarbs = 76;
    baseFat = 28;
    baseFiber = 5;
  } else if (titleLower.includes('salmon') || titleLower.includes('fish') || titleLower.includes('shrimp')) {
    baseCals = 610;
    baseProtein = 39;
    baseCarbs = 48;
    baseFat = 22;
    baseFiber = 5;
  } else if (titleLower.includes('tacos') || titleLower.includes('fajitas')) {
    baseCals = 640;
    baseProtein = 36;
    baseCarbs = 58;
    baseFat = 22;
    baseFiber = 7;
  }

  // Adjust for prep time or rapid recipes
  if (recipe.prep_time <= 20) {
    baseCals -= 30;
  }

  return {
    calories: baseCals,
    proteinGrams: baseProtein,
    carbsGrams: baseCarbs,
    fatGrams: baseFat,
    fiberGrams: baseFiber,
  };
}

/**
 * Computes weekly cost comparison and savings for the active dated plan.
 * HelloFresh benchmark: ~$11.49 / serving + $10.99 shipping per box.
 * FreshDIY standard grocery store benchmark: ~$3.75 / serving (using bulk rice, produce, family-pack proteins).
 */
export function computeWeeklySavings(
  weeklyPlan: WeeklyPlanItem[],
  recipes: Recipe[],
  hfPricePerServing: number = 11.49
): CostSavingsEstimate {
  let totalServings = 0;
  let mealsCount = 0;

  for (const item of weeklyPlan) {
    if (item.status === 'skipped') continue;
    const r = recipes.find((rec) => rec.id === item.recipe_id);
    if (!r) continue;
    totalServings += item.servings || 4;
    mealsCount += 1;
  }

  if (mealsCount === 0) {
    return {
      totalServings: 0,
      mealsCount: 0,
      helloFreshEstimatedCost: 0,
      freshDiyGroceryCost: 0,
      weeklySavings: 0,
      annualSavings: 0,
    };
  }

  const HF_PER_SERVING = hfPricePerServing > 0 ? hfPricePerServing : 11.49;
  const HF_SHIPPING = 10.99;
  const DIY_PER_SERVING = 3.85;

  const hfCost = Math.round((totalServings * HF_PER_SERVING + HF_SHIPPING) * 100) / 100;
  const diyCost = Math.round((totalServings * DIY_PER_SERVING) * 100) / 100;
  const savings = Math.round((hfCost - diyCost) * 100) / 100;
  const annual = Math.round(savings * 52);

  return {
    totalServings,
    mealsCount,
    helloFreshEstimatedCost: hfCost,
    freshDiyGroceryCost: diyCost,
    weeklySavings: savings,
    annualSavings: annual,
  };
}

/**
 * Rule-based fallback that matches catalog recipes to target macros
 * and scores them based on on-hand pantry/fridge ingredients.
 */
export function suggestMacroMealsFallback(params: {
  macroGoals: MacroGoals;
  onHandItems: {
    freezer: string[];
    fridge: string[];
    pantry: string[];
  };
  recipes: Recipe[];
  isDairyFree: boolean;
}): MacroMealSuggestion[] {
  const { macroGoals, onHandItems, recipes } = params;

  const onHandLower = new Set(
    [...onHandItems.freezer, ...onHandItems.fridge, ...onHandItems.pantry].map((s) =>
      s.toLowerCase().trim()
    )
  );

  const scored = recipes
    .filter((r) => r.is_latest)
    .map((recipe) => {
      const nut = estimateRecipeNutrition(recipe);

      // Distance score from target macros
      const calDiff = Math.abs(nut.calories - macroGoals.calories);
      const proteinDiff = Math.max(0, macroGoals.proteinGrams - nut.proteinGrams) * 4;
      const carbDiff = Math.abs(nut.carbsGrams - macroGoals.carbsGrams) * 2;
      const fatDiff = Math.abs(nut.fatGrams - macroGoals.fatGrams) * 2;
      const totalDiff = calDiff + proteinDiff + carbDiff + fatDiff;

      // Pantry match score
      const ingredients = recipe.ingredients_json || [];
      const fromHome: string[] = [];
      const toBuy: string[] = [];

      for (const ing of ingredients) {
        const ingLower = ing.name.toLowerCase().trim();
        const hasIt = Array.from(onHandLower).some(
          (h) => h.includes(ingLower) || ingLower.includes(h)
        );
        if (hasIt) {
          fromHome.push(ing.name);
        } else {
          toBuy.push(ing.name);
        }
      }

      const matchScore = Math.max(75, Math.min(98, Math.round(100 - totalDiff / 15)));

      return {
        id: `offline-${recipe.id}`,
        title: recipe.title,
        subtitle: recipe.subtitle || 'Catalog Recipe Aligned with Macros',
        matchedRecipeId: recipe.id,
        prepTimeMinutes: recipe.prep_time || 30,
        nutrition: nut,
        macroMatchScore: matchScore,
        macroHighlights: [
          `${nut.proteinGrams}g Protein`,
          `${nut.calories} kcal`,
          fromHome.length > 0 ? `${fromHome.length} ingredients at home` : 'Quick Prep',
        ],
        ingredientsFromHome: fromHome,
        ingredientsToBuy: toBuy,
        cookingSummary: `Prepared in ${recipe.prep_time} minutes with ${fromHome.length} ingredients from your kitchen.`,
      };
    })
    .sort((a, b) => b.macroMatchScore - a.macroMatchScore);

  return scored.slice(0, 3);
}
