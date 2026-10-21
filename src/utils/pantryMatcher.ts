import {
  CabinetItem,
  Recipe,
  RecipeIngredient,
  ServingsSize,
} from '../types/freshdiy';
import { evaluateBlendStock, HELLOFRESH_PROPRIETARY_BLENDS } from './blendDecoder';
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

const PRODUCE_PEPPERS = [
  'bell pepper',
  'poblano',
  'jalapeno',
  'jalapeño',
  'long green pepper',
  'sweet pepper',
  'chili pepper',
  'serrano',
  'habanero',
  'pepper jack',
  'peppermint',
];

function normalizeStem(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/ies\b/g, 'y')
    .replace(/oes\b/g, 'o')
    .replace(/s\b/g, '');
}

/**
 * Culinary-aware ingredient matcher that prevents substring false positives
 * (e.g. "Black Pepper" or "Pepper" spice matching "Bell Pepper", or "Rice" matching "Rice Vinegar").
 */
export function ingredientMatchesTerm(ingName: string, term: string): boolean {
  const aRaw = ingName.toLowerCase().trim();
  const bRaw = term.toLowerCase().trim();
  if (!aRaw || !bRaw) return false;
  if (aRaw === bRaw) return true;

  // Collision guard 1: "pepper" or "black pepper" (spice) vs fresh produce peppers
  const isASpicePepper = aRaw === 'pepper' || aRaw === 'black pepper' || aRaw === 'white pepper';
  const isBSpicePepper = bRaw === 'pepper' || bRaw === 'black pepper' || bRaw === 'white pepper';
  if (isASpicePepper || isBSpicePepper) {
    const other = isASpicePepper ? bRaw : aRaw;
    if (PRODUCE_PEPPERS.some((p) => other.includes(p))) return false;
  }

  // Collision guard 2: "rice" (grain) vs "rice vinegar" / "rice wine"
  if ((aRaw.includes('rice') && !aRaw.includes('vinegar')) && bRaw.includes('vinegar')) return false;
  if ((bRaw.includes('rice') && !bRaw.includes('vinegar')) && aRaw.includes('vinegar')) return false;

  // Collision guard 3: "onion" (fresh bulb) vs "onion powder" or "scallion/green onion"
  if ((aRaw === 'onion' || aRaw === 'yellow onion' || aRaw === 'red onion') && bRaw.includes('powder')) return false;
  if ((bRaw === 'onion' || bRaw === 'yellow onion' || bRaw === 'red onion') && aRaw.includes('powder')) return false;

  // Collision guard 4: "garlic" (fresh clove) vs "garlic powder"
  if ((aRaw === 'garlic' || aRaw === 'garlic clove') && bRaw.includes('powder')) return false;
  if ((bRaw === 'garlic' || bRaw === 'garlic clove') && aRaw.includes('powder')) return false;

  // Collision guard 5: "milk" vs "coconut milk" or "buttermilk"
  if ((aRaw === 'milk' || bRaw === 'milk') && (aRaw.includes('coconut') !== bRaw.includes('coconut'))) {
    return false;
  }

  const a = normalizeStem(aRaw);
  const b = normalizeStem(bRaw);
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  // Short terms (<= 5 chars like "oil", "egg", "pea", "ham") must match on word boundaries
  if (shorter.length <= 5) {
    const escaped = shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(longer);
  }

  return longer.includes(shorter);
}

export interface PrecomputedPantryContext {
  fridgeTerms: string[];
  activeCabinet: {
    itemName: string;
    isFreezerOrFridge: boolean;
  }[];
  readyBlends: Set<string>;
}

/**
 * Pre-computes normalized lookup tables and blend readiness once per state change
 * so evaluating 3,500+ recipes doesn't repeat thousands of redundant blend evaluations.
 */
export function buildPantryContext(
  onHandFridgeItems: string[],
  cabinet: CabinetItem[]
): PrecomputedPantryContext {
  const fridgeTerms = onHandFridgeItems.map((i) => i.trim()).filter(Boolean);

  const activeCabinet = cabinet
    .filter((c) => c.status !== 'out_of_stock')
    .map((c) => ({
      itemName: c.item_name.trim(),
      isFreezerOrFridge:
        c.category === 'Freezer & Deep Freeze' ||
        c.category === 'Refrigerator' ||
        (c.freezer_qty ?? 0) > 0 ||
        (c.fridge_qty ?? 0) > 0,
    }));

  const readyBlends = new Set<string>();
  for (const blend of HELLOFRESH_PROPRIETARY_BLENDS) {
    const evalRes = evaluateBlendStock(blend.name, cabinet);
    if (evalRes && evalRes.overallStatus !== 'missing_items') {
      readyBlends.add(blend.name.toLowerCase());
    }
  }

  return {
    fridgeTerms,
    activeCabinet,
    readyBlends,
  };
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
  isDairyFree: boolean,
  precomputed?: PrecomputedPantryContext
): RecipeMatchResult {
  const ctx = precomputed || buildPantryContext(onHandFridgeItems, cabinet);
  const scaledIngredients = recipe.ingredients_json.map((ing) =>
    transformIngredient(ing, recipe.base_servings || 4, servings, isDairyFree)
  );

  const matchedFridgeItems: string[] = [];
  const matchedCabinetItems: string[] = [];
  const missingItems: RecipeIngredient[] = [];

  for (const ing of scaledIngredients) {
    // 1. Check if matched by user's on-hand Fridge/Freezer items
    const matchedFridge = ctx.fridgeTerms.find(
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
      if (ctx.readyBlends.has(ing.blend_name.toLowerCase())) {
        matchedCabinetItems.push(`${ing.name} (DIY from Cabinet)`);
        continue;
      }
    }

    // 3. Check if directly in stock (or low) in the Kitchen Inventory (Freezer, Fridge, or Spice Cabinet)
    const cabMatch = ctx.activeCabinet.find(
      (c) =>
        ingredientMatchesTerm(ing.name, c.itemName) ||
        (ing.original_dairy_name &&
          ingredientMatchesTerm(ing.original_dairy_name, c.itemName))
    );

    if (cabMatch) {
      if (cabMatch.isFreezerOrFridge) {
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
  const ctx = buildPantryContext(onHandFridgeItems, cabinet);
  return recipes
    .filter((r) => r.is_latest)
    .map((recipe) =>
      evaluateRecipeMatch(
        recipe,
        onHandFridgeItems,
        cabinet,
        servings,
        isDairyFree,
        ctx
      )
    )
    .sort((a, b) => {
      // Prioritize recipes that use at least 1 selected fridge item when fridge items are selected
      if (onHandFridgeItems.length > 0 && a.fridgeHitCount !== b.fridgeHitCount) {
        const scoreA = a.fridgeHitCount * 25 + a.matchPercentage;
        const scoreB = b.fridgeHitCount * 25 + b.matchPercentage;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage;
      }
      return a.missingItems.length - b.missingItems.length;
    });
}
