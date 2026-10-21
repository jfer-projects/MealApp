import { Recipe, WeeklyPlanItem, ServingsSize } from '../types/freshdiy';

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
  recipes: Recipe[]
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

  const HF_PER_SERVING = 11.49;
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
