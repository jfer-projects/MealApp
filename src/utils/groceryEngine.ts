import {
  AggregatedGroceryItem,
  CabinetItem,
  GroceryExtra,
  Recipe,
  StockStatus,
  WeeklyPlanItem,
} from '../types/freshdiy';

export type { AggregatedGroceryItem };
import { evaluateBlendStock, HELLOFRESH_PROPRIETARY_BLENDS } from './blendDecoder';
import { formatAmount, transformIngredient } from './dairyEngine';
import { getItemStoreLocation, StoreLayout } from './storeLayouts';

export interface ItemQuantityBreakdown {
  freezer: number;
  fridge: number;
  pantry: number;
  total: number;
  unit: string;
  hasExplicitCounts: boolean;
}

/**
 * Computes location-specific quantities for a unified CabinetItem card.
 * Gracefully handles legacy items that only had `category` + `status`.
 */
export function getItemQuantities(item: CabinetItem): ItemQuantityBreakdown {
  const hasExplicit =
    item.freezer_qty !== undefined ||
    item.fridge_qty !== undefined ||
    item.pantry_qty !== undefined;

  const defaultUnit =
    item.unit ||
    (item.category === 'Freezer & Deep Freeze'
      ? 'pkg'
      : item.category === 'Refrigerator'
      ? 'item'
      : 'item');

  if (!hasExplicit) {
    const activeCount = item.status === 'out_of_stock' ? 0 : 1;
    if (item.category === 'Freezer & Deep Freeze') {
      return {
        freezer: activeCount,
        fridge: 0,
        pantry: 0,
        total: activeCount,
        unit: defaultUnit,
        hasExplicitCounts: false,
      };
    }
    if (item.category === 'Refrigerator') {
      return {
        freezer: 0,
        fridge: activeCount,
        pantry: 0,
        total: activeCount,
        unit: defaultUnit,
        hasExplicitCounts: false,
      };
    }
    return {
      freezer: 0,
      fridge: 0,
      pantry: activeCount,
      total: activeCount,
      unit: defaultUnit,
      hasExplicitCounts: false,
    };
  }

  const freezer = Math.max(0, Number(item.freezer_qty ?? 0));
  const fridge = Math.max(0, Number(item.fridge_qty ?? 0));
  const pantry = Math.max(0, Number(item.pantry_qty ?? 0));
  const total = freezer + fridge + pantry;

  return {
    freezer,
    fridge,
    pantry,
    total,
    unit: defaultUnit,
    hasExplicitCounts: true,
  };
}

/**
 * Derives StockStatus from location quantities when counts are tracked.
 */
export function deriveStockStatusFromQuantities(
  freezer: number,
  fridge: number,
  pantry: number,
  fallbackStatus: StockStatus = 'in_stock'
): StockStatus {
  const total = freezer + fridge + pantry;
  if (total <= 0) return 'out_of_stock';
  return fallbackStatus === 'out_of_stock' ? 'in_stock' : fallbackStatus;
}

/**
 * Ensures any duplicate items by name are merged into a single unified card
 * combining their Freezer, Fridge, and Pantry counts.
 */
export function mergeDuplicateCabinetItems(items: CabinetItem[]): CabinetItem[] {
  const byName = new Map<string, CabinetItem>();

  for (const item of items) {
    const key = item.item_name.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, item);
    } else {
      const q1 = getItemQuantities(existing);
      const q2 = getItemQuantities(item);
      const freezer = q1.freezer + q2.freezer;
      const fridge = q1.fridge + q2.fridge;
      const pantry = q1.pantry + q2.pantry;
      const status = deriveStockStatusFromQuantities(
        freezer,
        fridge,
        pantry,
        existing.status === 'in_stock' || item.status === 'in_stock'
          ? 'in_stock'
          : existing.status
      );
      byName.set(key, {
        ...existing,
        freezer_qty: freezer,
        fridge_qty: fridge,
        pantry_qty: pantry,
        unit: existing.unit || item.unit || q1.unit,
        status,
      });
    }
  }

  return Array.from(byName.values());
}

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
 * Formats the grocery list for the "Share with Family" feature.
 * When storeLayout is provided (e.g., Stop & Shop American Legion), groups and sequences
 * items along the store's exact walking path with aisle and department tags.
 */
export function formatGroceryListForValleria(
  items: AggregatedGroceryItem[],
  extras: GroceryExtra[],
  isDairyFree: boolean,
  includeCabinetStruck = false,
  storeLayout?: StoreLayout | null
): string {
  const activeItems = items.filter(
    (item) => includeCabinetStruck || !item.isStruckByCabinet
  );
  const uncheckedExtras = extras.filter((e) => !e.checked);

  // If store layout provided, format in exact progressive walking order
  if (storeLayout) {
    interface DepartmentBucket {
      dept: typeof storeLayout.departments[0];
      lines: string[];
    }
    const deptBuckets = new Map<string, DepartmentBucket>();
    for (const d of storeLayout.departments) {
      deptBuckets.set(d.id, { dept: d, lines: [] });
    }

    for (const item of activeItems) {
      const loc = getItemStoreLocation(item.name, storeLayout, item.aisle);
      const bucket = deptBuckets.get(loc.departmentId) || deptBuckets.get('aisle_8_household_paper')!;
      const dairyTag = item.isSubstitutedDairy ? ' 🌱(DF)' : '';
      const blendMissingNote =
        item.blendBreakdown && item.blendBreakdown.missingSpices.length > 0
          ? ` [Need base spices: ${item.blendBreakdown.missingSpices.join(', ')}]`
          : '';
      const lowNote = item.cabinetStatus === 'low' ? ' (Running low in cabinet)' : '';
      const aisleTag = loc.aisleNumber ? `[Aisle ${loc.aisleNumber}] ` : '';
      bucket.lines.push(
        `• ${aisleTag}${formatAmount(item.totalAmount)} ${item.unit} ${item.name}${dairyTag}${blendMissingNote}${lowNote}`
      );
    }

    for (const ex of uncheckedExtras) {
      const loc = getItemStoreLocation(ex.item_name, storeLayout, ex.aisle || 'Household & Extras');
      const bucket = deptBuckets.get(loc.departmentId) || deptBuckets.get('aisle_8_household_paper')!;
      const aisleTag = loc.aisleNumber ? `[Aisle ${loc.aisleNumber}] ` : '';
      bucket.lines.push(`• ${aisleTag}${ex.item_name}${ex.is_recurring ? ' 📌' : ''}`);
    }

    const lines: string[] = [
      `🛒 FreshDIY Family Shopping List`,
      `🏪 ${storeLayout.name}`,
      `📍 ${storeLayout.address}`,
      `🚶‍♂️ Sequential Walking Route (Zero Backtracking)`,
      `👨‍👩‍👧‍👦 Scaled for Family Plan ${isDairyFree ? '• 🌱 Dairy-Free Mode Active' : ''}`,
      `----------------------------------------`,
    ];

    const sortedBuckets = Array.from(deptBuckets.values())
      .filter((b) => b.lines.length > 0)
      .sort((a, b) => a.dept.sortOrder - b.dept.sortOrder);

    for (const b of sortedBuckets) {
      const aislePrefix = b.dept.aisleNumber ? `Aisle ${b.dept.aisleNumber}: ` : '';
      lines.push(`\n📍 STEP ${b.dept.sortOrder}: ${aislePrefix}${b.dept.name.toUpperCase()} (${b.dept.locationLabel})`);
      if (b.dept.description) {
        lines.push(`   (${b.dept.description})`);
      }
      lines.push(...b.lines);
    }

    const struckCount = items.filter((i) => i.isStruckByCabinet).length;
    if (struckCount > 0) {
      lines.push(
        `\n✅ (${struckCount} pantry/cabinet items skipped — already in stock at home!)`
      );
    }

    return lines.join('\n');
  }

  // Fallback: Standard Aisle Grouping
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

  if (uncheckedExtras.length > 0) {
    for (const ex of uncheckedExtras) {
      const targetAisle = ex.aisle || 'Household & Extras';
      const list = byAisle.get(targetAisle) || [];
      list.push(`• ${ex.item_name}${ex.is_recurring ? ' 📌' : ''}`);
      byAisle.set(targetAisle, list);
    }
  }

  const sortedAisles = Array.from(byAisle.keys()).sort(sortAisles);
  const lines: string[] = [
    `🛒 FreshDIY Family Grocery List`,
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
      utilizedNames.add(ing.name.toLowerCase().trim());
      if (ing.blend_name) {
        const blendDef = HELLOFRESH_PROPRIETARY_BLENDS.find(
          (b) => b.name.toLowerCase() === ing.blend_name?.toLowerCase()
        );
        if (blendDef) {
          for (const comp of blendDef.components) {
            utilizedNames.add(comp.spiceName.toLowerCase().trim());
          }
        }
      }
    }
  }

  const utilizedArr = Array.from(utilizedNames);
  const deductedNames: string[] = [];

  const updatedCabinet = currentCabinet.map((cab) => {
    const cabLower = cab.item_name.toLowerCase().trim();
    const isMatched =
      utilizedNames.has(cabLower) ||
      utilizedArr.some(
        (u) =>
          (u.length >= 4 && cabLower.includes(u)) ||
          (cabLower.length >= 4 && u.includes(cabLower))
      );

    if (!isMatched) {
      return cab;
    }

    const qty = getItemQuantities(cab);
    const isCountedZone =
      qty.hasExplicitCounts ||
      cab.category === 'Freezer & Deep Freeze' ||
      cab.category === 'Refrigerator';

    if (isCountedZone && qty.total > 0) {
      let { freezer, fridge, pantry } = qty;
      let locationUsed = 'Pantry';
      // Deduct from Refrigerator first (thawed items first!), then Deep Freezer, then Pantry
      if (fridge > 0) {
        fridge -= 1;
        locationUsed = 'Fridge';
      } else if (freezer > 0) {
        freezer -= 1;
        locationUsed = 'Freezer';
      } else if (pantry > 0) {
        pantry -= 1;
        locationUsed = 'Pantry';
      }

      const newTotal = freezer + fridge + pantry;
      const nextStatus: StockStatus =
        newTotal <= 0 ? 'out_of_stock' : newTotal === 1 && qty.total > 1 ? 'low' : 'in_stock';

      deductedNames.push(
        `${cab.item_name} (-1 from ${locationUsed}, ${newTotal} ${qty.unit} left)`
      );

      return {
        ...cab,
        freezer_qty: freezer,
        fridge_qty: fridge,
        pantry_qty: pantry,
        usage_count: (cab.usage_count || 0) + 1,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
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

export interface ParsedNoteGroceryItem {
  id: string;
  itemName: string;
  aisle: string;
  isRecurring: boolean;
}

/**
 * Automatically classifies a free-text shopping list item into the best store aisle.
 */
export function guessGroceryAisle(rawName: string): string {
  const s = rawName.toLowerCase();

  // Meat & Seafood
  if (
    /\b(chicken|turkey|beef|steak|pork|bacon|sausage|salmon|shrimp|fish|tilapia|cod|lamb|ham|meatball|ground|chop|fillet|tenderloin|brisket|ribs|wings|thighs|breast)\b/.test(
      s
    )
  ) {
    return 'Meat & Seafood';
  }

  // Dairy Alternatives
  if (
    /\b(oat milk|almond milk|soy milk|coconut milk|plant butter|vegan|dairy-free|dairy free|nutritional yeast|violife|miyoko|kite hill|silk|oatly|df )\b/.test(
      s
    )
  ) {
    return 'Dairy Alternatives';
  }

  // Dairy & Eggs
  if (
    /\b(eggs?|egg whites|milk|butter|cheese|cheddar|mozzarella|parmesan|yogurt|sour cream|cream cheese|heavy cream|half and half|creamer|cottage cheese)\b/.test(
      s
    )
  ) {
    return 'Dairy & Eggs';
  }

  // Produce
  if (
    /\b(apples?|bananas?|berries|strawberr|blueberr|raspberr|blackberr|grapes|oranges?|lemons?|limes?|avocados?|tomato|tomatoes|potato|potatoes|onion|scallion|shallot|garlic|ginger|carrot|broccoli|spinach|lettuce|kale|salad|greens|cucumber|zucchini|squash|pepper|jalapeno|cilantro|parsley|basil|mint|dill|rosemary|thyme|celery|mushroom|corn|cabbage|asparagus|green beans|peas| cauliflower|peach|pear|melon|watermelon|mango|pineapple)\b/.test(
      s
    )
  ) {
    return 'Produce';
  }

  // Grains & Bakery
  if (
    /\b(bread|sourdough|bagel|buns?|rolls?|tortilla|wrap|pita|flatbread|naan|croissant|muffin|pasta|spaghetti|penne|macaroni|noodle|ramen|orzo|rice|quinoa|oats|oatmeal|cereal|granola|crackers?|chips|pretzels?|flour|pancake|waffle)\b/.test(
      s
    )
  ) {
    return 'Grains & Bakery';
  }

  // Spices & Pantry
  if (
    /\b(oil|olive oil|vinegar|soy sauce|tamari|hot sauce|sriracha|ketchup|mustard|mayo|mayonnaise|bbq|sauce|salsa|honey|maple syrup|sugar|salt|pepper|paprika|cumin|oregano|cinnamon|chili|garlic powder|onion powder|seasoning|spice|stock|broth|bouillon|beans|black beans|chickpeas|lentils|canned|tuna|peanut butter|almond butter|jam|jelly)\b/.test(
      s
    )
  ) {
    return 'Spices & Pantry';
  }

  return 'Household & Extras';
}

/**
 * Parses a pasted shopping list from Apple Notes, Google Keep, SMS, or plain text.
 * Supports newline-separated or comma-separated lists, stripping bullets, checkboxes, and numbering.
 */
export function parsePastedShoppingList(rawText: string): ParsedNoteGroceryItem[] {
  if (!rawText || !rawText.trim()) return [];

  // Split by newlines first; if only 1 line and it contains commas, split by commas
  let rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 1 && rawLines[0].includes(',')) {
    rawLines = rawLines[0]
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const results: ParsedNoteGroceryItem[] = [];
  const seenLower = new Set<string>();

  for (let i = 0; i < rawLines.length; i++) {
    let cleaned = rawLines[i]
      // Strip leading checkboxes, bullets, dashes, stars, emojis, or numbers like "1.", "2)", "- [ ]"
      .replace(/^(\s*[-*•◦▪▫‣⁃]\s*|\s*\[[ xX✓✔]?\]\s*|\s*[☐☑✓✔]\s*|\s*\d+[.)]\s*)+/, '')
      .trim();

    if (!cleaned) continue;

    // Skip obvious section headers like "Grocery List:", "Produce:", "Store:", "---"
    if (
      /^[-=_*]{2,}$/.test(cleaned) ||
      /^(grocery list|shopping list|groceries|to buy|store|notes?):?$/i.test(cleaned)
    ) {
      continue;
    }

    // If a line ends with a colon like "Produce:", skip it as a header
    if (cleaned.endsWith(':') && cleaned.length < 24) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seenLower.has(key)) continue;
    seenLower.add(key);

    results.push({
      id: `parsed-${i}-${Date.now()}`,
      itemName: cleaned,
      aisle: guessGroceryAisle(cleaned),
      isRecurring: false,
    });
  }

  return results;
}
