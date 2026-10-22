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
  const rounded = Math.round(val * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  const prefix = whole > 0 ? `${whole} ` : '';
  if (Math.abs(frac - 0.25) < 0.04) return `${prefix}¼`;
  if (Math.abs(frac - 0.33) < 0.05) return `${prefix}⅓`;
  if (Math.abs(frac - 0.5) < 0.04) return `${prefix}½`;
  if (Math.abs(frac - 0.66) < 0.05) return `${prefix}⅔`;
  if (Math.abs(frac - 0.75) < 0.04) return `${prefix}¾`;
  return String(Math.round(val * 10) / 10);
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
  const scaledAmount = Math.round(ing.amount * ratio * 100) / 100;

  if (!isDairyFree || NON_DAIRY_SAFELIST.test(ing.name)) {
    return {
      ...ing,
      amount: scaledAmount,
    };
  }

  const { text: newName, matchedRule } = applyDairySubstitutionsToText(ing.name);
  if (matchedRule && newName !== ing.name) {
    return {
      ...ing,
      name: newName,
      amount: scaledAmount,
      aisle: 'Dairy Alternatives',
      original_dairy_name: ing.name,
      substitution_note: matchedRule.secondaryHint
        ? `Replaced ${ing.name} (${matchedRule.secondaryHint})`
        : `Replaced ${ing.name}`,
    };
  }

  return {
    ...ing,
    amount: scaledAmount,
  };
}

/**
 * Transforms an instruction string by:
 * 1. Scaling embedded numeric measurement quantities (oz, tbsp, tsp, cup, cups, g, cloves, buns, tortillas)
 *    according to targetServings / baseServings.
 * 2. Applying the Dynamic Dairy Substitution Matrix when isDairyFree is true.
 */
export function transformInstructionText(
  text: string,
  baseServings: ServingsSize,
  targetServings: ServingsSize,
  isDairyFree: boolean
): string {
  if (!text) return text;
  const ratio = targetServings / (baseServings || 4);

  // Scale inline quantities followed by culinary units
  let result = text.replace(
    /\b(\d+(?:\.\d+)?)\s*(oz|tbsp|tsp|cups?|g|grams?|buns?|pieces?|flatbreads?)\b/gi,
    (_match, numStr, unit) => {
      const val = parseFloat(numStr);
      if (Number.isNaN(val)) return _match;
      const scaled = val * ratio;
      return `${formatAmount(scaled)} ${unit}`;
    }
  );

  if (isDairyFree) {
    result = applyDairySubstitutionsToText(result).text;
  }

  return result;
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
