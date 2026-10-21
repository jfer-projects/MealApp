import {
  CabinetItem,
  Recipe,
  RecipeIngredient,
  ServingsSize,
} from '../types/freshdiy';
import { evaluateBlendStock } from './blendDecoder';
import { transformIngredient } from './dairyEngine';

export interface RecipeMatchResult {
  recipe: Recipe;
  matchPercentage: number;
  totalIngredients: number;
  matchedFridgeItems: string[];
  matchedCabinetItems: string[];
  missingItems: RecipeIngredient[];
   fridgeHitCount: number;
}

export const COMMON_FRIDGE_STAPLES: {
  category: string;
  items: string[];
}[] = [
  {
    category: 'Proteins',
    items: [
      'Ground Beef',
      'Chicken Breast',
      'Chicken Thighs',
      'Ground Pork',
      'Pork Chops',
      'Salmon',
    ],
  },
  {
    category: 'Produce',
    items: [
      'Potatoes',
      'Broccoli',
      'Carrots',
      'Green Beans',
      'Bell Pepper',
      'Zucchini',
      'Spinach',
      'Tomatoes',
      'Cucumber',
      'Onion',
      'Scallions',
      'Garlic',
      'Cabbage',
      'Lime',
      'Lemon',
    ],
  },
  {
    category: 'Grains & Bakery',
    items: [
      'Jasmine Rice',
      'Spaghetti',
      'Penne',
      'Orzo',
      'Tortillas',
      'Flatbreads',
      'Potato Buns',
      'Black Beans',
    ],
  },
  {
    category: 'Dairy / DF Staples',
    items: [
      'Dairy-Free Sour Cream',
      'Plant-Based Butter',
      'Unsweetened Oat Milk',
      'Nutritional Yeast',
      'Dairy-Free Shredded Cheese',
      'Dairy-Free Cream Cheese',
      'Dairy-Free Plain Yogurt',
    ],
  },
];

function ingredientMatchesTerm(ingName: string, term: string): boolean {
  const a = ingName.toLowerCase().trim();
  const b = term.toLowerCase().trim();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/**
 * Evaluates a recipe against:
 * 1. The family's on-hand Fridge/Freezer/Counter items (proteins, produce, grains, DF staples)
 * 2. The live Spice & Pantry Cabinet inventory (including HelloFresh Proprietary Blend decoding)
 */
export function evaluateRecipeMatch(
  recipe: Recipe,
  onHandFridgeItems: string[],
  cabinet: CabinetItem[],
  servings: ServingsSize,
  isDairyFree: boolean
): RecipeMatchResult {
  const scaledIngredients = recipe.ingredients_json.map((ing) =>
    transformIngredient(ing, recipe.base_servings || 4, servings, isDairyFree)
  );

  const matchedFridgeItems: string[] = [];
  const matchedCabinetItems: string[] = [];
  const missingItems: RecipeIngredient[] = [];

  for (const ing of scaledIngredients) {
    // 1. Check if matched by user's on-hand Fridge/Freezer items
    const matchedFridge = onHandFridgeItems.find(
      (item) =>
        ingredientMatchesTerm(ing.name, item) ||
        (ing.original_dairy_name &&
          ingredientMatchesTerm(ing.original_dairy_name, item))
    );

    if (matchedFridge) {
      matchedFridgeItems.push(ing.name);
      continue;
    }

    // 2. Check if it's a HelloFresh proprietary blend that can be mixed from the Cabinet
    if (ing.blend_name) {
      const blendEval = evaluateBlendStock(ing.blend_name, cabinet);
      if (blendEval && blendEval.overallStatus !== 'missing_items') {
        matchedCabinetItems.push(`${ing.name} (DIY from Cabinet)`);
        continue;
      }
    }

    // 3. Check if directly in stock (or low) in the Kitchen Inventory (Freezer, Fridge, or Spice Cabinet)
    const cabMatch = cabinet.find(
      (c) =>
        c.status !== 'out_of_stock' &&
        (ingredientMatchesTerm(ing.name, c.item_name) ||
          (ing.original_dairy_name &&
            ingredientMatchesTerm(ing.original_dairy_name, c.item_name)))
    );

    if (cabMatch) {
      const isFreezerOrFridge =
        cabMatch.category === 'Freezer & Deep Freeze' ||
        cabMatch.category === 'Refrigerator' ||
        (cabMatch.freezer_qty ?? 0) > 0 ||
        (cabMatch.fridge_qty ?? 0) > 0;
      if (isFreezerOrFridge) {
        matchedFridgeItems.push(ing.name);
      } else {
        matchedCabinetItems.push(ing.name);
      }
      continue;
    }

    // Otherwise, we need to buy this ingredient
    missingItems.push(ing);
  }

  const totalIngredients = scaledIngredients.length || 1;
  const totalMatched = matchedFridgeItems.length + matchedCabinetItems.length;
  const matchPercentage = Math.round((totalMatched / totalIngredients) * 100);

  return {
    recipe,
    matchPercentage,
    totalIngredients,
    matchedFridgeItems,
    matchedCabinetItems,
    missingItems,
    fridgeHitCount: matchedFridgeItems.length,
  };
}

/**
 * Ranks all latest recipes by how well they utilize the user's on-hand Fridge/Freezer items
 * and in-stock Cabinet spices/sauces.
 */
export function rankRecipesByOnHandIngredients(
  recipes: Recipe[],
  onHandFridgeItems: string[],
  cabinet: CabinetItem[],
  servings: ServingsSize,
  isDairyFree: boolean
): RecipeMatchResult[] {
  return recipes
    .filter((r) => r.is_latest)
    .map((recipe) =>
      evaluateRecipeMatch(
        recipe,
        onHandFridgeItems,
        cabinet,
        servings,
        isDairyFree
      )
    )
    .sort((a, b) => {
      // Prioritize recipes that use at least 1 selected fridge item when fridge items are selected
      if (onHandFridgeItems.length > 0 && a.fridgeHitCount !== b.fridgeHitCount) {
        if (b.fridgeHitCount !== a.fridgeHitCount) {
          // Weight fridge hits heavily + overall match percentage
          const scoreA = a.fridgeHitCount * 25 + a.matchPercentage;
          const scoreB = b.fridgeHitCount * 25 + b.matchPercentage;
          if (scoreB !== scoreA) return scoreB - scoreA;
        }
      }
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage;
      }
      return a.missingItems.length - b.missingItems.length;
    });
}
