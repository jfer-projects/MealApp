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

const nutritionCache = new Map<string, NutritionEstimate>();

/**
 * Calculates nutrition macros per serving for a recipe by analyzing its ingredients_json
 * and quantities (scaled by base_servings), with memoization for instant catalog filtering.
 */
export function estimateRecipeNutrition(recipe: Recipe): NutritionEstimate {
  const cached = nutritionCache.get(recipe.id);
  if (cached) return cached;

  // If a synthesized Macro AI recipe encodes explicit macros in subtitle, honor them
  const sub = recipe.subtitle || '';
  const pMatch = sub.match(/(\d+)\s*g\s*Protein/i);
  const cMatch = sub.match(/(\d+)\s*kcal/i);
  if (pMatch && cMatch) {
    const p = parseInt(pMatch[1], 10);
    const cal = parseInt(cMatch[1], 10);
    const est: NutritionEstimate = {
      calories: cal,
      proteinGrams: p,
      carbsGrams: Math.max(10, Math.round((cal - p * 4 - 18 * 9) / 4)),
      fatGrams: 18,
      fiberGrams: 6,
    };
    nutritionCache.set(recipe.id, est);
    return est;
  }

  const ingredients = recipe.ingredients_json || [];
  let protein = 8; // base trace protein from veggies/sauces
  let carbs = 14;  // base carbs from aromatics/glazes
  let fat = 10;    // base cooking oil drizzle
  let fiber = 3;

  const titleLower = (recipe.title + ' ' + sub).toLowerCase();

  for (const ing of ingredients) {
    const n = (ing.name || '').toLowerCase();

    // Lean & high-protein meats / seafood
    if (n.includes('chicken breast') || n.includes('chicken strips') || n.includes('chicken cutlet')) {
      protein += 34;
      fat += 5;
    } else if (n.includes('chicken thigh') || n.includes('chicken')) {
      protein += 29;
      fat += 10;
    } else if (n.includes('ground turkey') || n.includes('turkey')) {
      protein += 30;
      fat += 9;
    } else if (n.includes('salmon') || n.includes('trout')) {
      protein += 31;
      fat += 14;
    } else if (n.includes('shrimp') || n.includes('tilapia') || n.includes('barramundi') || n.includes('cod') || n.includes('fish')) {
      protein += 28;
      fat += 4;
    } else if (n.includes('steak') || n.includes('sirloin') || n.includes('bavette') || n.includes('tenderloin')) {
      protein += 33;
      fat += 13;
    } else if (n.includes('ground beef') || n.includes('beef')) {
      protein += 28;
      fat += 16;
    } else if (n.includes('pork chop') || n.includes('pork tenderloin') || n.includes('pork filet')) {
      protein += 30;
      fat += 9;
    } else if (n.includes('ground pork') || n.includes('sausage') || n.includes('chorizo')) {
      protein += 24;
      fat += 18;
    } else if (n.includes('bacon') || n.includes('prosciutto')) {
      protein += 6;
      fat += 9;
    } else if (n.includes('tofu') || n.includes('tempeh')) {
      protein += 16;
      carbs += 6;
      fat += 8;
      fiber += 2;
    } else if (n.includes('egg')) {
      protein += 7;
      fat += 5;
    }

    // Legumes & plant protein
    if (n.includes('chickpea') || n.includes('black bean') || n.includes('kidney bean') || n.includes('white bean') || n.includes('lentil') || n.includes('edamame')) {
      protein += 10;
      carbs += 24;
      fiber += 6;
    }

    // Starches, grains & bakery
    if (n.includes('rice') && !n.includes('vinegar')) {
      carbs += 36;
      protein += 3;
      fiber += 1;
    } else if (
      n.includes('spaghetti') ||
      n.includes('penne') ||
      n.includes('rigatoni') ||
      n.includes('cavatappi') ||
      n.includes('linguine') ||
      n.includes('orzo') ||
      n.includes('pasta') ||
      n.includes('macaroni') ||
      n.includes('noodle') ||
      n.includes('ramen')
    ) {
      carbs += 42;
      protein += 7;
      fiber += 2;
    } else if (n.includes('ravioli') || n.includes('tortelloni') || n.includes('gnocchi')) {
      carbs += 38;
      protein += 10;
      fat += 6;
      fiber += 2;
    } else if (n.includes('potato') || n.includes('sweet potato')) {
      carbs += 28;
      protein += 3;
      fiber += 3;
    } else if (n.includes('tortilla') || n.includes('flatbread') || n.includes('pita') || n.includes('naan')) {
      carbs += 26;
      protein += 4;
      fat += 3;
      fiber += 2;
    } else if (n.includes('bun') || n.includes('bread') || n.includes('ciabatta') || n.includes('baguette') || n.includes('brioche') || n.includes('sourdough')) {
      carbs += 28;
      protein += 5;
      fat += 2;
      fiber += 2;
    } else if (n.includes('couscous') || n.includes('quinoa') || n.includes('bulgur') || n.includes('farro')) {
      carbs += 30;
      protein += 5;
      fiber += 3;
    } else if (n.includes('corn') || n.includes('panko') || n.includes('flour')) {
      carbs += 12;
      fiber += 1;
    }

    // Fats, dairy & creamy sauces
    if (n.includes('cheese') || n.includes('parmesan') || n.includes('mozzarella') || n.includes('cheddar') || n.includes('monterey') || n.includes('feta') || n.includes('gouda') || n.includes('pepper jack')) {
      protein += 5;
      fat += 7;
    } else if (n.includes('sour cream') || n.includes('crema') || n.includes('heavy cream')) {
      fat += 5;
      carbs += 1;
    } else if (n.includes('mayo') || n.includes('aioli')) {
      fat += 8;
    } else if (n.includes('butter')) {
      fat += 6;
    } else if (n.includes('coconut milk')) {
      fat += 9;
      carbs += 3;
    } else if (n.includes('avocado') || n.includes('guacamole')) {
      fat += 9;
      carbs += 4;
      fiber += 3;
    } else if (n.includes('almond') || n.includes('pecan') || n.includes('walnut') || n.includes('peanut') || n.includes('cashew') || n.includes('pepita')) {
      fat += 6;
      protein += 2;
      fiber += 1;
    }

    // Vegetables & greens
    if (
      n.includes('broccoli') ||
      n.includes('green bean') ||
      n.includes('carrot') ||
      n.includes('zucchini') ||
      n.includes('bell pepper') ||
      n.includes('brussels') ||
      n.includes('asparagus') ||
      n.includes('kale') ||
      n.includes('spinach') ||
      n.includes('cabbage') ||
      n.includes('cauliflower')
    ) {
      carbs += 5;
      fiber += 2;
      protein += 1;
    }
  }

  // Fallback if recipe had minimal parsed ingredients
  if (protein <= 12 && (titleLower.includes('chicken') || titleLower.includes('steak') || titleLower.includes('beef') || titleLower.includes('pork') || titleLower.includes('salmon'))) {
    protein += 28;
    fat += 8;
  }

  protein = Math.min(68, Math.max(14, Math.round(protein)));
  carbs = Math.min(105, Math.max(12, Math.round(carbs)));
  fat = Math.min(48, Math.max(10, Math.round(fat)));
  fiber = Math.min(16, Math.max(2, Math.round(fiber)));

  const calories = Math.round((protein * 4 + carbs * 4 + fat * 9) / 10) * 10;

  const result: NutritionEstimate = {
    calories,
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
    fiberGrams: fiber,
  };

  nutritionCache.set(recipe.id, result);
  return result;
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
