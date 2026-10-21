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

/**
 * Official FreshDIY Dairy Substitution Matrix
 */
export const DAIRY_SUBSTITUTION_MATRIX: DairySubstitutionRule[] = [
  {
    pattern: /\bsour cream\b/gi,
    label: 'Sour Cream',
    replacement: 'Dairy-Free Sour Cream',
    secondaryHint: 'or Plain Unsweetened Coconut/Almond Yogurt',
  },
  {
    pattern: /\bcream cheese\b/gi,
    label: 'Cream Cheese',
    replacement: 'Dairy-Free Cream Cheese',
  },
  {
    pattern: /\bparmesan(?: cheese)?\b/gi,
    label: 'Parmesan Cheese',
    replacement: 'Nutritional Yeast',
  },
  {
    pattern: /\b(?:mexican cheese blend|monterey jack(?: cheese)?|cheddar cheese|shredded cheese)\b/gi,
    label: 'Mexican Cheese Blend / Monterey Jack',
    replacement: 'Dairy-Free Shredded Cheese',
  },
  {
    pattern: /\bbutter\b/gi,
    label: 'Butter',
    replacement: 'Plant-Based Butter',
    secondaryHint: 'or Olive Oil if cooking',
  },
  {
    pattern: /\bmilk\b/gi,
    label: 'Milk',
    replacement: 'Unsweetened Oat Milk',
  },
  {
    pattern: /\byogurt\b/gi,
    label: 'Yogurt',
    replacement: 'Dairy-Free Plain Yogurt',
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

  if (!isDairyFree) {
    return {
      ...ing,
      amount: scaledAmount,
    };
  }

  for (const rule of DAIRY_SUBSTITUTION_MATRIX) {
    if (rule.pattern.test(ing.name)) {
      rule.pattern.lastIndex = 0;
      const newName = ing.name.replace(rule.pattern, rule.replacement);
      return {
        ...ing,
        name: newName,
        amount: scaledAmount,
        aisle: 'Dairy Alternatives',
        original_dairy_name: ing.name,
        substitution_note: rule.secondaryHint
          ? `Replaced ${ing.name} (${rule.secondaryHint})`
          : `Replaced ${ing.name}`,
      };
    }
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
    for (const rule of DAIRY_SUBSTITUTION_MATRIX) {
      rule.pattern.lastIndex = 0;
      result = result.replace(rule.pattern, rule.replacement);
    }
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
