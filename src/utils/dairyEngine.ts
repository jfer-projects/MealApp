import {
  RecipeIngredient,
  RecipeInstruction,
  ServingsSize,
} from '../types/freshdiy';

export interface DairySubstitutionRule {
  pattern: RegExp;
  label: string;
  replacement: string;
  secondaryHint?: string;
}

const NON_DAIRY_SAFELIST =
  /\b(?:peanut butter|almond butter|cashew butter|sunflower butter|sunbutter|apple butter|cocoa butter|butternut|butter lettuce|bibb\/butter lettuce|butter beans|coconut milk|oat milk|almond milk|soy milk|cashew milk|coconut cream|cream of tartar|cream sauce spice|dairy-free|plant-based)\b/i;

/**
  * Official FreshDIY Dairy Substitution Matrix
  * Ordered from most specific compound terms to general catch-alls so replacements never collide.
  */
export const DAIRY_SUBSTITUTION_MATRIX: DairySubstitutionRule[] = [
  {
    pattern: /\b(?:cr[eè]me fra[iî]che)\b/gi,
    label: 'Crème Fraîche',
    replacement: 'Dairy-Free Crème Fraîche',
    secondaryHint: 'or Dairy-Free Sour Cream',
  },
  {
    pattern: /\bsour cream\b/gi,
    label: 'Sour Cream',
    replacement: 'Dairy-Free Sour Cream',
    secondaryHint: 'or Plain Unsweetened Coconut Yogurt',
  },
  {
    pattern: /\bcream cheese\b/gi,
    label: 'Cream Cheese',
    replacement: 'Dairy-Free Cream Cheese',
  },
  {
    pattern: /\b(?:ricotta(?: cheese)?)\b/gi,
    label: 'Ricotta Cheese',
    replacement: 'Dairy-Free Ricotta',
  },
  {
    pattern: /\b(?:mascarpone(?: cheese)?)\b/gi,
    label: 'Mascarpone',
    replacement: 'Dairy-Free Cream Cheese',
  },
  {
    pattern: /\b(?:goat cheese|ch[eè]vre)\b/gi,
    label: 'Goat Cheese',
    replacement: 'Dairy-Free Goat Cheese',
  },
  {
    pattern: /\b(?:parmesan(?: cheese)?(?: block)?|parmigiano(?:-reggiano)?|pecorino(?: romano)?|asiago(?: cheese)?|romano cheese)\b/gi,
    label: 'Parmesan Cheese',
    replacement: 'Dairy-Free Parmesan',
    secondaryHint: 'or Nutritional Yeast',
  },
  {
    pattern: /\b(?:fresh )?mozzarella(?: cheese| pearls| ciliegine)?\b/gi,
    label: 'Mozzarella Cheese',
    replacement: 'Dairy-Free Mozzarella',
  },
  {
    pattern: /\b(?:sargento®\s+)?(?:sliced\s+|shredded\s+)?(?:white\s+|sharp\s+|mild\s+|aged\s+)?cheddar(?: cheese)?\b/gi,
    label: 'Cheddar Cheese',
    replacement: 'Dairy-Free Cheddar',
  },
  {
    pattern: /\b(?:monterey jack|pepper jack|colby jack|jack)(?: cheese)?\b/gi,
    label: 'Monterey / Pepper Jack Cheese',
    replacement: 'Dairy-Free Monterey Jack',
  },
  {
    pattern: /\b(?:feta(?: cheese)?|cotija(?: cheese)?|queso fresco|queso blanco)\b/gi,
    label: 'Feta / Cotija / Queso',
    replacement: 'Dairy-Free Feta',
  },
  {
    pattern: /\b(?:smoked\s+)?(?:gouda|swiss|gruy[eè]re|provolone|fontina|blue|gorgonzola|brie|american|halloumi|paneer|grilling|string|grand cru|midnight moon)(?: cheese)?\b/gi,
    label: 'Specialty Cheese',
    replacement: 'Dairy-Free Shredded Cheese',
  },
  {
    pattern: /\b(?:mexican|italian|four|4|three|3)[- ]cheese(?: blend)?\b/gi,
    label: 'Cheese Blend',
    replacement: 'Dairy-Free Shredded Cheese',
  },
  {
    pattern: /\b(?<!dairy-free\s)(?:shredded |sliced |grated |crumbled |melted |cottage )?cheese(?:s| blend| sauce| curds| roux(?: concentrate)?)?\b/gi,
    label: 'Cheese',
    replacement: 'Dairy-Free Cheese',
  },
  {
    pattern: /\bbuttermilk(?:\s+ranch\s+dressing)?\b/gi,
    label: 'Buttermilk',
    replacement: 'Dairy-Free Buttermilk',
    secondaryHint: 'Oat Milk + 1 tsp Lemon Juice',
  },
  {
    pattern: /\b(?:heavy whipping cream|heavy cream|whipping cream|cooking cream|half-and-half|half and half|light cream|sour cream sauce|cream sauce base|cream of chicken concentrate)\b/gi,
    label: 'Heavy / Cooking Cream',
    replacement: 'Dairy-Free Cooking Cream',
    secondaryHint: 'or Unsweetened Oat/Coconut Cream',
  },
  {
    pattern: /\b(?<!dairy-free\s|coconut\s|oat\s|sour\s|ice\s|whipped\s)cream(?!\s+(?:cheese|of tartar|sauce spice|style))\b/gi,
    label: 'Cream',
    replacement: 'Dairy-Free Cooking Cream',
  },
  {
    pattern: /\b(?<!dairy-free\s|coconut\s|almond\s|plain\s)(?:greek\s+|plain\s+)?yogurt\b/gi,
    label: 'Yogurt',
    replacement: 'Dairy-Free Plain Yogurt',
  },
  {
    pattern: /\bghee\b/gi,
    label: 'Ghee',
    replacement: 'Plant-Based Ghee',
    secondaryHint: 'or Plant-Based Butter',
  },
  {
    pattern: /\b(?<!plant-based\s|dairy-free\s|peanut\s|almond\s|cashew\s|sunflower\s|apple\s|cocoa\s)(?:unsalted\s+|salted\s+|melted\s+|softened\s+|garlic\s+herb\s+|garlic\s+|herb\s+|truffle\s+|black\s+truffle\s+|chili\s+lime\s+|honey\s+)?butter(?!\s*(?:lettuce|beans|nut|milk))\b/gi,
    label: 'Butter',
    replacement: 'Plant-Based Butter',
    secondaryHint: 'or Olive Oil if cooking',
  },
  {
    pattern: /\b(?<!oat\s|almond\s|coconut\s|soy\s|cashew\s|plant-based\s|dairy-free\s)(?:whole\s+|skim\s+|2%\s+|reduced-fat\s+|evaporated\s+|condensed\s+)?milk\b/gi,
    label: 'Milk',
    replacement: 'Unsweetened Oat Milk',
  },
];

export function formatAmount(val: number): string {
  if (!val || val <= 0) return '';
  const rounded = Math.round(val * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  const prefix = whole > 0 ? String(whole) : '';
  if (Math.abs(frac - 0.125) < 0.03) return prefix ? `${prefix}⅛` : '⅛';
  if (Math.abs(frac - 0.25) < 0.04) return prefix ? `${prefix}¼` : '¼';
  if (Math.abs(frac - 0.33) < 0.05) return prefix ? `${prefix}⅓` : '⅓';
  if (Math.abs(frac - 0.375) < 0.03) return prefix ? `${prefix}⅜` : '⅜';
  if (Math.abs(frac - 0.5) < 0.04) return prefix ? `${prefix}½` : '½';
  if (Math.abs(frac - 0.625) < 0.03) return prefix ? `${prefix}⅝` : '⅝';
  if (Math.abs(frac - 0.66) < 0.05) return prefix ? `${prefix}⅔` : '⅔';
  if (Math.abs(frac - 0.75) < 0.04) return prefix ? `${prefix}¾` : '¾';
  if (Math.abs(frac - 0.875) < 0.03) return prefix ? `${prefix}⅞` : '⅞';
  return String(Math.round(val * 10) / 10);
}

function pluralizeCountableIngredientName(name: string, amount: number): string {
  if (amount <= 1 || !name) return name;
  return name
    .replace(/\b(Potato)$/i, '$1es')
    .replace(/\b(Tomato)$/i, '$1es')
    .replace(/\b(Radish)$/i, '$1es')
    .replace(
      /\b(Carrot|Onion|Scallion|Shallot|Lemon|Lime|Apple|Cucumber|Zucchini|Egg|Avocado|Mushroom|Pepper|Jalape[ñn]o|Tortilla|Bun|Flatbread|Baguette|Roll|Clove|Brioche Bun|Potato Bun|Pita)$/i,
      (m) => (/s$/i.test(m) ? m : `${m}s`)
    );
}

export function formatIngredientMeasurement(amount: number, unit: string): string {
  const u = (unit || '').trim();
  if (u === 'to taste' || u === 'as needed') {
    return u;
  }
  const amtStr = formatAmount(amount);
  if (!u) return amtStr;
  return [amtStr, u].filter(Boolean).join(' ');
}

export function formatIngredientDisplay(amount: number, unit: string, name: string): string {
  const u = (unit || '').trim();
  if (u === 'to taste' || u === 'as needed') {
    return `${name} (${u})`;
  }

  // Countable / produce scaling polish (e.g. 1.5 limes -> 1–2 Limes, 0.75 yellow onion -> 1 Yellow Onion)
  const isCountable = !u || u === 'unit' || u === 'units' || u === 'item' || u === 'items' || u === 'piece' || u === 'pieces';
  const isIndivisible = /\b(lime|lemon|egg|avocado|onion|shallot|bell pepper|poblano|jalape[ñn]o|cucumber|apple|banana|potato|bun|tortilla|flatbread|pita)\b/i.test(name);

  if (isCountable && isIndivisible && !Number.isInteger(amount) && amount > 0) {
    const floorVal = Math.floor(amount);
    const ceilVal = Math.ceil(amount);
    const amtStr = floorVal === 0 ? '1' : `${floorVal}–${ceilVal}`;
    const cleanName = pluralizeCountableIngredientName(name, ceilVal);
    return `${amtStr} ${cleanName}`.trim();
  }

  const cleanName = (isCountable && isIndivisible && amount > 1)
    ? pluralizeCountableIngredientName(name, amount)
    : name;

  const amtStr = formatAmount(amount);
  if (!u) {
    return [amtStr, cleanName].filter(Boolean).join(' ');
  }
  return [amtStr, u, cleanName].filter(Boolean).join(' ');
}

export function normalizeUnitAndAmount(
  amount: number,
  rawUnit: string,
  name: string
): { amount: number; unit: string; name: string } {
  let cleanName = (name || '').trim();
  let u = (rawUnit || '').trim().toLowerCase();
  let amt = amount;

  // Salt & Pepper
  if (/^(?:kosher\s+|sea\s+|flaky\s+)?salt$|^(?:black\s+|white\s+)?pepper$|^salt\s*(?:&|and)\s*pepper$/i.test(cleanName)) {
    return { amount: 0, unit: 'to taste', name: cleanName };
  }

  // Cooking Oil
  if ((u === 'unit' || u === '') && /\b(?:cooking|olive|vegetable|canola|sesame|avocado|peanut)\s+oil\b|^oil$/i.test(cleanName)) {
    return { amount: 0, unit: 'as needed', name: cleanName };
  }

  // Ginger 'thumb' -> tablespoon / tsp
  if (u === 'thumb' || (/\bginger\b/i.test(cleanName) && (u === 'unit' || u === ''))) {
    if (amt <= 0.5) return { amount: 1.5, unit: 'tsp minced', name: cleanName };
    if (amt <= 1) return { amount: 1, unit: 'tbsp minced (1" piece)', name: cleanName };
    return { amount: Math.round(amt), unit: `tbsp minced (${Math.round(amt)}" piece)`, name: cleanName };
  }

  // Milliliters -> tsp / tbsp / cups
  if (u === 'milliliters' || u === 'ml') {
    if (amt <= 6) return { amount: 1, unit: 'tsp', name: cleanName };
    if (amt <= 11) return { amount: 2, unit: 'tsp', name: cleanName };
    if (amt <= 13) return { amount: 2.5, unit: 'tsp (approx. ½ tbsp)', name: cleanName };
    if (amt <= 16) return { amount: 1, unit: 'tbsp', name: cleanName };
    if (amt <= 25) return { amount: 1.5, unit: 'tbsp', name: cleanName };
    if (amt <= 32) return { amount: 2, unit: 'tbsp', name: cleanName };
    if (amt <= 65) return { amount: 0.25, unit: 'cup', name: cleanName };
    if (amt <= 130) return { amount: 0.5, unit: 'cup', name: cleanName };
    return { amount: Math.round((amt / 240) * 4) / 4, unit: 'cup', name: cleanName };
  }

  // Grams -> tsp / tbsp / cups
  if (u === 'g' || u === 'grams') {
    if (/tempura|batter|flour|panko|mix/i.test(cleanName)) {
      if (amt >= 140 && amt <= 180) return { amount: 1.25, unit: 'cup', name: cleanName };
      return { amount: Math.round((amt / 125) * 4) / 4, unit: 'cup', name: cleanName };
    }
    // Spices & seasonings
    if (amt <= 5) return { amount: 1, unit: 'tsp', name: cleanName };
    if (amt <= 8) return { amount: 1.5, unit: 'tsp', name: cleanName };
    if (amt <= 16) return { amount: 1, unit: 'tbsp', name: cleanName };
    if (amt <= 23) return { amount: 1.5, unit: 'tbsp', name: cleanName };
    return { amount: Math.round((amt / 14.4) * 2) / 2, unit: 'tbsp', name: cleanName };
  }

  // Tomato Paste in ounces or units
  if (/tomato paste/i.test(cleanName)) {
    if (u === 'ounce' || u === 'oz') {
      return { amount: amt * 2, unit: 'tbsp', name: cleanName };
    }
    if (u === 'unit' || u === '') {
      return { amount: amt, unit: amt === 1 ? 'pouch (2 tbsp)' : 'pouches (2 tbsp each)', name: cleanName };
    }
  }

  // Fresh Herbs in ounces
  if ((u === 'ounce' || u === 'oz') && /\b(?:rosemary|thyme|sage|oregano)\b/i.test(cleanName)) {
    if (amt <= 0.25) return { amount: 1, unit: 'tbsp chopped (2–3 sprigs)', name: cleanName };
    return { amount: Math.round(amt * 4), unit: 'tbsp chopped', name: cleanName };
  }
  if ((u === 'ounce' || u === 'oz') && /\b(?:cilantro|parsley|dill|chives|basil|mint)\b/i.test(cleanName)) {
    if (amt <= 0.25) return { amount: 2, unit: 'tbsp chopped', name: cleanName };
    if (amt <= 0.5) return { amount: 0.25, unit: 'cup chopped', name: cleanName };
    return { amount: 0.5, unit: 'cup chopped', name: cleanName };
  }

  // Butter in ounces
  if ((u === 'ounce' || u === 'oz') && /\bbutter\b/i.test(cleanName) && !/peanut|almond|cashew/i.test(cleanName)) {
    const tbsp = amt * 2;
    if (tbsp >= 4 && tbsp % 4 === 0) {
      return { amount: tbsp / 16, unit: 'cup', name: cleanName };
    }
    return { amount: tbsp, unit: 'tbsp', name: cleanName };
  }

  // Dairy & creamy sauces in ounces (milk, cream sauce base, sour cream, mayo)
  if (u === 'ounce' || u === 'oz') {
    if (/milk|cream sauce|creamy/i.test(cleanName)) {
      if (Math.abs(amt - 6.75) < 0.5) return { amount: 0.75, unit: 'cup', name: cleanName };
      if (amt >= 2) return { amount: Math.round((amt / 8) * 4) / 4, unit: 'cup', name: cleanName };
      return { amount: amt * 2, unit: 'tbsp', name: cleanName };
    }
    if (/sour cream|greek yogurt|mayo|mayonnaise|cream cheese/i.test(cleanName)) {
      if (amt >= 4) return { amount: Math.round((amt / 8) * 4) / 4, unit: 'cup', name: cleanName };
      if (amt === 2) return { amount: 0.25, unit: 'cup (4 tbsp)', name: cleanName };
      return { amount: amt * 2, unit: 'tbsp', name: cleanName };
    }
    if (/sweet thai chili|marinara|soy glaze|bbq|sauce|dressing|honey|syrup|vinegar|ketchup|mustard|paste/i.test(cleanName)) {
      if (amt === 5) return { amount: 0.66, unit: 'cup', name: cleanName };
      if (amt >= 4) return { amount: Math.round((amt / 8) * 4) / 4, unit: 'cup', name: cleanName };
      if (amt === 2) return { amount: 0.25, unit: 'cup (4 tbsp)', name: cleanName };
      return { amount: amt * 2, unit: 'tbsp', name: cleanName };
    }
    if (/cheese|parmesan|cheddar|mozzarella/i.test(cleanName)) {
      return { amount: Math.round((amt / 4) * 4) / 4, unit: 'cup shredded', name: cleanName };
    }
  }

  // Stock concentrates
  if (/stock concentrate|broth concentrate/i.test(cleanName) && (u === 'unit' || u === '')) {
    return { amount: amt, unit: amt === 1 ? 'packet' : 'packets', name: cleanName };
  }

  // Clean raw unit labels
  u = u.replace(/\s*\(tsp\)/gi, '').replace(/\s*\(tbsp\)/gi, '').trim();
  if (u === 'teaspoon') u = 'tsp';
  if (u === 'tablespoon') u = 'tbsp';

  // Upgrade teaspoons to tablespoons
  if (u === 'tsp') {
    if (amt >= 3 && amt % 3 === 0) {
      amt = amt / 3;
      u = 'tbsp';
    } else if (amt === 4.5) {
      amt = 1.5;
      u = 'tbsp';
    }
  }

  // Upgrade tablespoons to cups
  if (u === 'tbsp') {
    if (amt === 4) { amt = 0.25; u = 'cup'; }
    else if (amt === 8) { amt = 0.5; u = 'cup'; }
    else if (amt === 12) { amt = 0.75; u = 'cup'; }
    else if (amt === 16) { amt = 1; u = 'cup'; }
  }

  // Unit = unit normalization
  if (u === 'unit' || u === 'units' || u === 'item' || u === 'items' || u === '') {
    if (/scallions?|green onions?/i.test(cleanName)) {
      return { amount: amt, unit: amt === 1 ? 'bunch' : 'bunches', name: cleanName };
    }
    if (/black beans|chickpeas|crushed tomatoes|diced tomatoes|coconut milk/i.test(cleanName)) {
      return { amount: amt, unit: amt === 1 ? 'can' : 'cans', name: cleanName };
    }
    if (/tortillas?/i.test(cleanName)) {
      return { amount: amt, unit: '', name: pluralizeCountableIngredientName(cleanName, amt) };
    }
    if (/buns?/i.test(cleanName)) {
      return { amount: amt, unit: '', name: pluralizeCountableIngredientName(cleanName, amt) };
    }
    if (/pitas?/i.test(cleanName)) {
      return { amount: amt, unit: '', name: pluralizeCountableIngredientName(cleanName, amt) };
    }
    return { amount: amt, unit: '', name: pluralizeCountableIngredientName(cleanName, amt) };
  }

  return {
    amount: amt,
    unit: u,
    name: cleanName,
  };
}

function applyDairySubstitutionsToText(input: string): {
  text: string;
  matchedRule: DairySubstitutionRule | null;
} {
  let working = input;
  const tokens: string[] = [];
  let firstMatchedRule: DairySubstitutionRule | null = null;

  // Protect safe non-dairy phrases first so they are never modified
  working = working.replace(
    /\b(?:peanut butter|almond butter|cashew butter|sunflower butter|sunbutter|apple butter|cocoa butter|butternut squash|butternut|butter lettuce|bibb\/butter lettuce|butter beans|coconut milk|oat milk|almond milk|soy milk|cashew milk|coconut cream|cream of tartar|cream sauce spice(?: blend)?|dairy-free\s+[a-z-]+(?:\s+[a-z-]+)?|plant-based\s+[a-z-]+)\b/gi,
    (match) => {
      const idx = tokens.length;
      tokens.push(match);
      return `\x00SAFE_${idx}\x00`;
    }
  );

  for (const rule of DAIRY_SUBSTITUTION_MATRIX) {
    rule.pattern.lastIndex = 0;
    working = working.replace(rule.pattern, () => {
      if (!firstMatchedRule) firstMatchedRule = rule;
      const idx = tokens.length;
      tokens.push(rule.replacement);
      return `\x00SAFE_${idx}\x00`;
    });
  }

  const restored = working.replace(/\x00SAFE_(\d+)\x00/g, (_m, idxStr) => {
    return tokens[Number(idxStr)] ?? _m;
  });

  return { text: restored, matchedRule: firstMatchedRule };
}

/**
 * Scales an ingredient quantity from baseServings (default 4) to targetServings (2, 4, or 6)
 * and applies the Dynamic Dairy Substitution Engine if isDairyFree is active.
 */
export function transformIngredient(
  ing: RecipeIngredient,
  baseServings: ServingsSize,
  targetServings: ServingsSize,
  isDairyFree: boolean
): RecipeIngredient {
  const ratio = targetServings / (baseServings || 4);
  const rawScaledAmount = Math.round(ing.amount * ratio * 100) / 100;
  const norm = normalizeUnitAndAmount(rawScaledAmount, ing.unit, ing.name);

  if (!isDairyFree || NON_DAIRY_SAFELIST.test(norm.name)) {
    return {
      ...ing,
      name: norm.name,
      amount: norm.amount,
      unit: norm.unit,
    };
  }

  const { text: newName, matchedRule } = applyDairySubstitutionsToText(norm.name);
  if (matchedRule && newName !== norm.name) {
    return {
      ...ing,
      name: newName,
      amount: norm.amount,
      unit: norm.unit,
      aisle: 'Dairy Alternatives',
      original_dairy_name: ing.name,
      substitution_note: matchedRule.secondaryHint
        ? `Replaced ${ing.name} (${matchedRule.secondaryHint})`
        : `Replaced ${ing.name}`,
    };
  }

  return {
    ...ing,
    name: norm.name,
    amount: norm.amount,
    unit: norm.unit,
  };
}

const UNICODE_FRACTION_MAP: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 0.333,
  '⅔': 0.667,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

function parseQuantityValue(str: string): number {
  const trimmed = (str || '').trim();
  if (!trimmed) return 0;

  // Check for mixed unicode: "1½" or "1 ½"
  const mixedUnicode = /^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(trimmed);
  if (mixedUnicode) {
    const whole = parseInt(mixedUnicode[1], 10);
    const frac = UNICODE_FRACTION_MAP[mixedUnicode[2]] || 0;
    return whole + frac;
  }

  // Pure unicode fraction: "¼"
  if (UNICODE_FRACTION_MAP[trimmed]) {
    return UNICODE_FRACTION_MAP[trimmed];
  }

  // Ascii slash fraction: "1/2" or "1 1/2"
  const mixedAscii = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed);
  if (mixedAscii) {
    return parseInt(mixedAscii[1], 10) + parseInt(mixedAscii[2], 10) / parseInt(mixedAscii[3], 10);
  }
  const pureSlash = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (pureSlash) {
    return parseInt(pureSlash[1], 10) / parseInt(pureSlash[2], 10);
  }

  const num = parseFloat(trimmed);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Resolves dual parenthetical measurements in HelloFresh instructions, such as:
 * "1 TBSP butter (2 TBSP for 4 servings)" -> "2 tbsp butter" (for 4 servings) or "1 tbsp butter" (for 2 servings)
 * "¼ cup water (⅓ cup for 4 servings)" -> "⅓ cup water" (for 4 servings)
 */
function resolveDualServingParentheticals(text: string, targetServings: ServingsSize): string {
  // Pattern matching: [amount unit [noun]] ([amount unit [noun]] for 4 [servings])
  const pattern = /((?:half\s+(?:the\s+)?[\w\s]+?|[¼½¾⅓⅔⅛⅜⅝⅞\d\/\.]+\s*(?:tbsp|tsp|cups?|oz|tablespoons?|teaspoons?|buns?|pieces?|tortillas?)?(?:\s+[\w\s]+?)?))\s*\(\s*(?:use\s+)?((?:all\s+(?:the\s+)?[\w\s]+?|[¼½¾⅓⅔⅛⅜⅝⅞\d\/\.]+\s*(?:tbsp|tsp|cups?|oz|tablespoons?|teaspoons?|buns?|pieces?|tortillas?)?(?:\s+[\w\s]+?)?))\s+for\s+4(?:\s+servings)?\s*\)/gi;

  let out = text.replace(pattern, (_match, for2Raw, for4Raw) => {
    let for2 = (for2Raw || '').trim();
    let for4 = (for4Raw || '').trim();

    const unitOrNumRegex = /^(?:[¼½¾⅓⅔⅛⅜⅝⅞\d\/\.]+\s*(?:tbsp|tsp|cups?|oz|tablespoons?|teaspoons?|buns?|pieces?|tortillas?)?|half|all)\s*/i;
    const noun2 = for2.replace(unitOrNumRegex, '').trim();
    const noun4 = for4.replace(unitOrNumRegex, '').trim();

    if (noun2 && !noun4) {
      for4 = `${for4} ${noun2}`;
    }

    if (targetServings === 4) return for4;
    if (targetServings === 2) return for2;
    if (targetServings === 6) {
      // Scale 4-serving measurement by 1.5 for 6 servings
      const matchFor4 = /^([¼½¾⅓⅔⅛⅜⅝⅞\d\/\.]+)\s*(\w+)?(?:\s+(.*))?$/i.exec(for4);
      if (matchFor4) {
        const val = parseQuantityValue(matchFor4[1]);
        if (val > 0) {
          const scaledVal = val * 1.5;
          const unitPart = matchFor4[2] ? ` ${matchFor4[2]}` : '';
          const restPart = matchFor4[3] ? ` ${matchFor4[3]}` : '';
          return `${formatAmount(scaledVal)}${unitPart}${restPart}`;
        }
      }
      return for4;
    }
    return _match;
  });

  // Clean standalone notes
  if (targetServings === 2) {
    out = out.replace(/\(For 4 servings, [^)]*\)/gi, '');
  }

  return out;
}

/**
 * Transforms an instruction string by:
 * 1. Resolving dual HelloFresh serving notes (e.g. "1 TBSP butter (2 TBSP for 4 servings)")
 *    cleanly for the selected family serving size.
 * 2. Scaling embedded numeric and unicode fractional measurement quantities
 *    (tbsp, tsp, cup, cups, oz, etc.) according to targetServings / baseServings.
 * 3. Standardizing all measurements into clear, friendly culinary units (tbsp, tsp, cups).
 * 4. Applying the Dynamic Dairy Substitution Matrix when isDairyFree is true.
 */
export function transformInstructionText(
  text: string,
  baseServings: ServingsSize,
  targetServings: ServingsSize,
  isDairyFree: boolean
): string {
  if (!text) return text;

  // 1. First resolve dual serving parentheticals
  let result = resolveDualServingParentheticals(text, targetServings);

  // 2. Standardize all unit casing and abbreviations
  result = result
    .replace(/\bTBSP\b/g, 'tbsp')
    .replace(/\bTSP\b/g, 'tsp')
    .replace(/\bCUPS?\b/g, (m) => m.toLowerCase())
    .replace(/\btablespoons?\b/gi, 'tbsp')
    .replace(/\bteaspoons?\b/gi, 'tsp');

  // 3. Scale quantities when targetServings differs from baseServings (e.g. 6 servings or 2 vs 4)
  const ratio = targetServings / (baseServings || 4);
  if (Math.abs(ratio - 1) > 0.05) {
    result = result.replace(
      /\b([¼½¾⅓⅔⅛⅜⅝⅞\d\/\.]+)\s*(oz|tbsp|tsp|cups?|buns?|pieces?|flatbreads?|tortillas?|packets?|cloves?)\b/gi,
      (match, numStr, unit) => {
        const val = parseQuantityValue(numStr);
        if (val <= 0) return match;
        const scaled = val * ratio;
        return `${formatAmount(scaled)} ${unit.toLowerCase()}`;
      }
    );
  }

  // 4. Strip leftover raw "unit/units"
  result = result.replace(/\b(\d+(?:\.\d+)?)\s+units?\b/gi, '$1');

  // 5. Apply dairy substitutions if active
  if (isDairyFree) {
    result = applyDairySubstitutionsToText(result).text;
  }

  return result.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Transforms all instructions for a recipe, including Air Fryer and Rice Cooker overrides.
 */
export function transformInstructions(
  instructions: RecipeInstruction[],
  baseServings: ServingsSize,
  targetServings: ServingsSize,
  isDairyFree: boolean
): RecipeInstruction[] {
  return instructions.map((step) => ({
    ...step,
    title: step.title
      ? transformInstructionText(step.title, baseServings, targetServings, isDairyFree)
      : step.title,
    body: transformInstructionText(step.body, baseServings, targetServings, isDairyFree),
    appliance_override: {
      air_fryer: step.appliance_override?.air_fryer
        ? transformInstructionText(
            step.appliance_override.air_fryer,
            baseServings,
            targetServings,
            isDairyFree
          )
        : null,
      rice_cooker: step.appliance_override?.rice_cooker
        ? transformInstructionText(
            step.appliance_override.rice_cooker,
            baseServings,
            targetServings,
            isDairyFree
          )
        : null,
    },
  }));
}
