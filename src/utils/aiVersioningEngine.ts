import {
  Recipe,
  RecipeIngredient,
  RecipeInstruction,
} from '../types/freshdiy';
import { formatAmount } from './dairyEngine';

export interface ForkedRecipeResult {
  newRecipe: Recipe;
  changeSummary: string[];
}

/**
 * AI Recipe Versioning Engine
 * Reads feedback notes from the user or Valleria (e.g., "Too spicy for kids, cut chili powder by 50%"),
 * automatically forks the recipe JSON, adjusts exact ingredient quantities & step-by-step instruction text,
 * and publishes a new version (v1 -> v2) with is_latest = true.
 */
export function forkRecipeFromFeedback(
  baseRecipe: Recipe,
  notes: string,
  authorName: string
): ForkedRecipeResult {
  const lower = notes.toLowerCase();
  const changes: string[] = [];

  const clonedIngredients: RecipeIngredient[] = baseRecipe.ingredients_json.map(
    (ing) => ({ ...ing })
  );
  const clonedInstructions: RecipeInstruction[] =
    baseRecipe.instructions_json.map((inst) => ({
      ...inst,
      appliance_override: { ...inst.appliance_override },
    }));

  // 1. Detect percentage reductions/increases: e.g. "cut chili powder by 50%" or "reduce spice by 50%"
  const pctMatch = notes.match(
    /(?:cut|reduce|decrease|lower|increase|boost)\s+([a-zA-Z\s-]+?)\s+by\s+(\d+)\s*%/i
  );
  const isIncreasePct = /(?:increase|boost)\s+[a-zA-Z\s-]+?\s+by\s+\d+\s*%/i.test(
    notes
  );

  if (pctMatch) {
    const targetTerm = pctMatch[1].trim().toLowerCase();
    const pct = parseFloat(pctMatch[2]);
    const multiplier = isIncreasePct
      ? 1 + pct / 100
      : Math.max(0.1, 1 - pct / 100);

    let matchedAny = false;
    clonedIngredients.forEach((ing) => {
      if (
        ing.name.toLowerCase().includes(targetTerm) ||
        (targetTerm.includes('chili') &&
          /chili|spice|southwest|fajita|blackening|tuscan|shawarma/i.test(
            ing.name
          )) ||
        (targetTerm.includes('spice') &&
          /spice|seasoning|chili|paste/i.test(ing.name))
      ) {
        const oldAmt = ing.amount;
        ing.amount = Math.round(oldAmt * multiplier * 100) / 100;
        matchedAny = true;
        changes.push(
          `Adjusted ${ing.name}: ${formatAmount(oldAmt)} ${ing.unit} ➔ ${formatAmount(ing.amount)} ${ing.unit} (${isIncreasePct ? '+' : '-'}${pct}%)`
        );

        // Update matching quantities inside instruction text
        const escapedName = ing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const stepRegex = new RegExp(
          `(\\d+(?:\\.\\d+)?)(\\s*${ing.unit}\\s+${escapedName})`,
          'gi'
        );
        clonedInstructions.forEach((inst) => {
          inst.body = inst.body.replace(
            stepRegex,
            `${formatAmount(ing.amount)}$2`
          );
        });
      }
    });

    if (!matchedAny) {
      // If the spice was a sub-component (like Chili Powder inside a blend or general spice)
      clonedIngredients.forEach((ing) => {
        if (/chili|spice|seasoning|paste|glaze/i.test(ing.name)) {
          const oldAmt = ing.amount;
          ing.amount = Math.round(oldAmt * multiplier * 100) / 100;
          changes.push(
            `Adjusted ${ing.name} (for "${targetTerm}"): ${formatAmount(oldAmt)} ${ing.unit} ➔ ${formatAmount(ing.amount)} ${ing.unit}`
          );
        }
      });
    }
  }

  // 2. Detect "too spicy" general heuristic if no explicit percentage was matched
  if (
    changes.length === 0 &&
    /too spicy|less spicy|kid|mild|cut.*chili|half.*spice/i.test(lower)
  ) {
    clonedIngredients.forEach((ing) => {
      if (/chili|spice|blackening|southwest|fajita|shawarma|tex-mex/i.test(ing.name)) {
        const oldAmt = ing.amount;
        ing.amount = Math.round(oldAmt * 0.5 * 100) / 100;
        changes.push(
          `Kid-Friendly Mild Adjustment — reduced ${ing.name} by 50%: ${formatAmount(oldAmt)} ${ing.unit} ➔ ${formatAmount(ing.amount)} ${ing.unit}`
        );
      }
    });
    clonedInstructions.forEach((inst) => {
      if (/chili|spice/i.test(inst.body)) {
        inst.body +=
          ' (AI v' +
          (baseRecipe.version + 1) +
          ' Note: Use half the seasoning packet/blend for a milder kid-friendly heat level.)';
      }
    });
  }

  // 3. Detect "double" or "more" of an ingredient (e.g., "double garlic", "more veggies", "extra cheese")
  const doubleMatch = notes.match(/(?:double|extra|more)\s+(?:the\s+)?([a-zA-Z\s]+)/i);
  if (doubleMatch) {
    const target = doubleMatch[1].trim().toLowerCase();
    clonedIngredients.forEach((ing) => {
      if (
        ing.name.toLowerCase().includes(target) ||
        (target.includes('veggie') && ing.aisle === 'Produce')
      ) {
        const oldAmt = ing.amount;
        const factor = /double/i.test(notes) ? 2 : 1.5;
        ing.amount = Math.round(oldAmt * factor * 100) / 100;
        changes.push(
          `Increased ${ing.name}: ${formatAmount(oldAmt)} ${ing.unit} ➔ ${formatAmount(ing.amount)} ${ing.unit}`
        );
      }
    });
  }

  // 4. Detect cooking time adjustments: e.g., "cook 5 minutes longer" or "reduce cook time by 3 minutes"
  const timeMatch = notes.match(/(\d+)\s*(?:min|minute)s?\s*(longer|more|less|shorter)/i);
  let newPrepTime = baseRecipe.prep_time;
  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10);
    const dir = /longer|more/i.test(timeMatch[2]) ? 1 : -1;
    newPrepTime = Math.max(10, baseRecipe.prep_time + mins * dir);
    clonedInstructions.forEach((inst) => {
      if (inst.timer_seconds) {
        inst.timer_seconds = Math.max(60, inst.timer_seconds + mins * 60 * dir);
      }
    });
    changes.push(
      `Adjusted total cook/prep time: ${baseRecipe.prep_time} mins ➔ ${newPrepTime} mins`
    );
  }

  // 5. Always annotate the final cooking card step if custom chef notes were provided
  if (changes.length === 0) {
    changes.push(`Applied custom family adaptation from ${authorName}: "${notes}"`);
  }

  const lastStep = clonedInstructions[clonedInstructions.length - 1];
  if (lastStep) {
    lastStep.body = `${lastStep.body} [Family v${baseRecipe.version + 1} tweak (${authorName}): ${changes.join('; ')}]`;
  }

  const nextVersion = baseRecipe.version + 1;
  const newId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${baseRecipe.id}-v${nextVersion}-${Date.now()}`;

  const newRecipe: Recipe = {
    ...baseRecipe,
    id: newId,
    version: nextVersion,
    original_id: baseRecipe.original_id || baseRecipe.id,
    prep_time: newPrepTime,
    ingredients_json: clonedIngredients,
    instructions_json: clonedInstructions,
    version_notes: `v${nextVersion} AI Fork (${authorName}): ${changes.join(' | ')}`,
    is_latest: true,
    created_at: new Date().toISOString(),
  };

  return {
    newRecipe,
    changeSummary: changes,
  };
}
