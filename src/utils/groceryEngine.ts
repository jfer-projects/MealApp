import {
  AggregatedGroceryItem,
  CabinetItem,
  GroceryExtra,
  Recipe,
  StockStatus,
  WeeklyPlanItem,
} from '../types/freshdiy';
import { evaluateBlendStock, HELLOFRESH_PROPRIETARY_BLENDS } from './blendDecoder';
import { formatAmount, transformIngredient } from './dairyEngine';

const AISLE_ORDER = [
  'Produce',
  'Meat & Seafood',
  'Dairy Alternatives',
  'Dairy & Eggs',
  'Grains & Bakery',
  'Pantry & Canned',
  'Spices & Pantry',
  'Household & Extras',
];

export function sortAisles(a: string, b: string): number {
  const idxA = AISLE_ORDER.indexOf(a);
  const idxB = AISLE_ORDER.indexOf(b);
  if (idxA === -1 && idxB === -1) return a.localeCompare(b);
  if (idxA === -1) return 1;
  if (idxB === -1) return -1;
  return idxA - idxB;
}

export function buildAggregatedGroceryList(
  weeklyPlan: WeeklyPlanItem[],
  recipes: Recipe[],
  cabinet: CabinetItem[],
  isDairyFree: boolean
): AggregatedGroceryItem[] {
  const map = new Map<string, AggregatedGroceryItem>();

  for (const planItem of weeklyPlan) {
    if (planItem.status === 'skipped') continue;
    const recipe = recipes.find((r) => r.id === planItem.recipe_id);
    if (!recipe) continue;

    for (const rawIng of recipe.ingredients_json) {
      const transformed = transformIngredient(
        rawIng,
        recipe.base_servings || 4,
        planItem.servings || 4,
        isDairyFree
      );

      const normalizedKey = `${transformed.name.toLowerCase().trim()}__${transformed.unit.toLowerCase().trim()}`;

      // Check cabinet directly
      const directCabinetMatch = cabinet.find(
        (c) =>
          c.item_name.toLowerCase() === transformed.name.toLowerCase() ||
          c.item_name.toLowerCase() === (rawIng.name || '').toLowerCase()
      );

      // Check if it's a HelloFresh proprietary blend
      let blendBreakdown: AggregatedGroceryItem['blendBreakdown'] | undefined;
      let cabinetStatus: StockStatus | null = directCabinetMatch
        ? directCabinetMatch.status
        : null;
      let isStruckByCabinet = cabinetStatus === 'in_stock';

      if (transformed.blend_name) {
        const evalResult = evaluateBlendStock(transformed.blend_name, cabinet);
        if (evalResult) {
          const canMake = evalResult.overallStatus !== 'missing_items';
          blendBreakdown = {
            blendName: transformed.blend_name,
            canMakeFromCabinet: canMake,
            missingSpices: evalResult.missingSpices,
          };
          if (evalResult.overallStatus === 'ready') {
            cabinetStatus = 'in_stock';
            isStruckByCabinet = true;
          } else if (evalResult.overallStatus === 'low_stock') {
            cabinetStatus = 'low';
            isStruckByCabinet = true;
          } else {
            cabinetStatus = 'out_of_stock';
            isStruckByCabinet = false;
          }
        }
      }

      const existing = map.get(normalizedKey);
      if (existing) {
        existing.totalAmount =
          Math.round((existing.totalAmount + transformed.amount) * 100) / 100;
        if (!existing.fromRecipes.includes(recipe.title)) {
          existing.fromRecipes.push(recipe.title);
        }
        if (
          transformed.original_dairy_name &&
          !existing.originalNames.includes(transformed.original_dairy_name)
        ) {
          existing.originalNames.push(transformed.original_dairy_name);
        }
      } else {
        map.set(normalizedKey, {
          key: normalizedKey,
          name: transformed.name,
          originalNames: transformed.original_dairy_name
            ? [transformed.original_dairy_name]
            : [],
          totalAmount: transformed.amount,
          unit: transformed.unit,
          aisle: transformed.aisle,
          isSubstitutedDairy: Boolean(transformed.original_dairy_name),
          substitutionNote: transformed.substitution_note,
          cabinetStatus,
          isStruckByCabinet,
          fromRecipes: [recipe.title],
          blendBreakdown,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aisleCmp = sortAisles(a.aisle, b.aisle);
    if (aisleCmp !== 0) return aisleCmp;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Formats the aisle-sorted, deduplicated grocery list for the "Send to Valleria" feature.
 */
export function formatGroceryListForValleria(
  items: AggregatedGroceryItem[],
  extras: GroceryExtra[],
  isDairyFree: boolean,
  includeCabinetStruck = false
): string {
  const activeItems = items.filter(
    (item) => includeCabinetStruck || !item.isStruckByCabinet
  );

  const byAisle = new Map<string, string[]>();

  for (const item of activeItems) {
    const list = byAisle.get(item.aisle) || [];
    const dairyTag = item.isSubstitutedDairy ? ' 🌱(DF)' : '';
    const blendMissingNote =
      item.blendBreakdown && item.blendBreakdown.missingSpices.length > 0
        ? ` [Need base spices: ${item.blendBreakdown.missingSpices.join(', ')}]`
        : '';
    const lowNote = item.cabinetStatus === 'low' ? ' (Running low in cabinet)' : '';
    list.push(
      `• ${formatAmount(item.totalAmount)} ${item.unit} ${item.name}${dairyTag}${blendMissingNote}${lowNote}`
    );
    byAisle.set(item.aisle, list);
  }

  const uncheckedExtras = extras.filter((e) => !e.checked);
  if (uncheckedExtras.length > 0) {
    const extraAisle = 'Household & Extras';
    const list = byAisle.get(extraAisle) || [];
    for (const ex of uncheckedExtras) {
      list.push(`• ${ex.item_name}`);
    }
    byAisle.set(extraAisle, list);
  }

  const sortedAisles = Array.from(byAisle.keys()).sort(sortAisles);
  const lines: string[] = [
    `🛒 FreshDIY Family Grocery List for Valleria`,
    `👨‍👩‍👧‍👦 Scaled for Family Plan ${isDairyFree ? '• 🌱 Dairy-Free Mode Active' : ''}`,
    `----------------------------------------`,
  ];

  for (const aisle of sortedAisles) {
    lines.push(`\n📍 ${aisle.toUpperCase()}`);
    lines.push(...(byAisle.get(aisle) || []));
  }

  const struckCount = items.filter((i) => i.isStruckByCabinet).length;
  if (struckCount > 0) {
    lines.push(
      `\n✅ (${struckCount} spices/pantry items skipped — already in stock in our Cabinet!)`
    );
  }

  return lines.join('\n');
}

/**
 * Phase 4 Workflow Optimization: Auto-Deduction
 * When a weekly plan is marked "Completed", deducts utilized quantities of spices/sauces
 * from the cabinet by incrementing usage_count and transitioning stock status.
 */
export function deductCabinetForCompletedMeals(
  completedMeals: WeeklyPlanItem[],
  recipes: Recipe[],
  currentCabinet: CabinetItem[]
): {
  updatedCabinet: CabinetItem[];
  deductedNames: string[];
} {
  const utilizedNames = new Set<string>();

  for (const planItem of completedMeals) {
    const recipe = recipes.find((r) => r.id === planItem.recipe_id);
    if (!recipe) continue;

    for (const ing of recipe.ingredients_json) {
      utilizedNames.add(ing.name.toLowerCase());
      if (ing.blend_name) {
        const blendDef = HELLOFRESH_PROPRIETARY_BLENDS.find(
          (b) => b.name.toLowerCase() === ing.blend_name?.toLowerCase()
        );
        if (blendDef) {
          for (const comp of blendDef.components) {
            utilizedNames.add(comp.spiceName.toLowerCase());
          }
        }
      }
    }
  }

  const deductedNames: string[] = [];
  const updatedCabinet = currentCabinet.map((cab) => {
    if (!utilizedNames.has(cab.item_name.toLowerCase())) {
      return cab;
    }

    const nextUsage = (cab.usage_count || 0) + 1;
    let nextStatus: StockStatus = cab.status;

    if (cab.status === 'in_stock' && nextUsage >= 2) {
      nextStatus = 'low';
    } else if (cab.status === 'low') {
      nextStatus = 'out_of_stock';
    }

    deductedNames.push(
      `${cab.item_name} (${cab.status.replace('_', ' ')} ➔ ${nextStatus.replace('_', ' ')})`
    );

    return {
      ...cab,
      usage_count: nextUsage,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
  });

  return {
    updatedCabinet,
    deductedNames,
  };
}
