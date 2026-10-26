import { Recipe } from '../types/freshdiy';

const DB_NAME = 'freshdiy_catalog_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_store';
const CACHE_KEY = 'hellofresh_recipes_v4';

/**
 * Strips leading HelloFresh upsell bracket text such as
 * "[UPGRADE CHICKEN CUTLETS TO DOUBLE ORGANIC CHICKEN CUTLETS] Sheet Pan..."
 */
export function cleanRecipeTitle(title: string): string {
  if (!title) return title;
  return title
    .replace(/^\s*(?:\[[^\]]*\]\s*)+/g, '')
    .replace(/\s*\[(?:upgrade|swap|add|double)[^\]]*\]/gi, '')
    .trim();
}

/**
 * Computes accurate tags strictly supported by the recipe's own data
 * (prep_time, title/subtitle, ingredients, and instruction overrides).
 */
export function computeAccurateRecipeTags(recipe: Recipe): string[] {
  const tags: string[] = [];
  const titleSub = `${recipe.title || ''} ${recipe.subtitle || ''}`;
  const ingText = (recipe.ingredients_json || []).map((i) => i.name).join(' ');
  const stepsText = (recipe.instructions_json || []).map((s) => s.body).join(' ');

  // 1. Under 30 Mins: strictly under 30 minutes (e.g. 10, 15, 20, 25 mins)
  if (typeof recipe.prep_time === 'number' && recipe.prep_time > 0 && recipe.prep_time < 30) {
    tags.push('Under 30 Mins');
  }

  // 2. Sheet Pan: explicitly a sheet-pan bake or roasted entirely on a baking sheet without pots/skillets
  const isSheetPan =
    /\bsheet[- ]pan\b/i.test(titleSub) ||
    (/\bbaking sheet\b/i.test(stepsText) && !/\b(?:skillet|pot|saucepan|frying pan)\b/i.test(stepsText));
  if (isSheetPan) {
    tags.push('Sheet Pan');
  }

  // 3. Air Fryer: has air fryer step adaptation AND features crispy/roasted items suited to air frying
  const hasAirFryerStep = (recipe.instructions_json || []).some((s) =>
    Boolean(s.appliance_override?.air_fryer)
  );
  if (
    hasAirFryerStep &&
    /\b(?:crispy|wedge|fries|cutlet|tender|nugget|taquito|flauta|tostada|panko|breaded)\b/i.test(
      `${titleSub} ${ingText}`
    )
  ) {
    tags.push('Air Fryer');
  }

  // 4. Rice Cooker: has rice cooker adaptation AND actual rice grain ingredient
  const hasRiceCookerStep = (recipe.instructions_json || []).some((s) =>
    Boolean(s.appliance_override?.rice_cooker)
  );
  const hasRiceGrain = (recipe.ingredients_json || []).some(
    (i) => /\brice\b/i.test(i.name) && !/\b(?:vinegar|wine|noodle|paper)\b/i.test(i.name)
  );
  if (hasRiceCookerStep && hasRiceGrain) {
    tags.push('Rice Cooker');
  }

  // 5. Kid-Friendly: classic kid-loved format AND free of spicy peppers/sauces
  const isKidFormat =
    /\b(?:burger|mac\s*(?:and|&|'n'|’n’)\s*cheese|quesadilla|flatbread|meatball|meatloaf|tender|nugget|spaghetti|penne|casserole|melt|pizza|slider|grilled cheese|taquito)\b/i.test(
      recipe.title
    );
  const hasSpicyHeat =
    /\b(?:jalape[ñn]o|poblano|sriracha|harissa|chipotle|chili flakes|red pepper flakes|thai chili|spicy|firecracker|buffalo|gochujang|habanero|cayenne|blackening)\b/i.test(
      `${titleSub} ${ingText}`
    );
  if (isKidFormat && !hasSpicyHeat) {
    tags.push('Kid-Friendly');
  }

  return tags;
}

export function normalizeCatalogRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.map((r) => {
    const cleanedTitle = cleanRecipeTitle(r.title);
    const cleaned = {
      ...r,
      title: cleanedTitle,
    };
    return {
      ...cleaned,
      tags: computeAccurateRecipeTags(cleaned),
    };
  });
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedRecipes(): Promise<Recipe[] | null> {
  try {
    const db = await openCacheDb();
    return await new Promise<Recipe[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (Array.isArray(val) && val.length > 0) {
          resolve(val as Recipe[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setCachedRecipes(recipes: Recipe[]): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(recipes, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

/**
 * Loads the base HelloFresh catalog from IndexedDB in <50ms if cached,
 * or fetches `/data/hellofresh_recipes.json` and populates IndexedDB in the background.
 */
export async function loadBaseCatalogFast(): Promise<Recipe[]> {
  const cached = await getCachedRecipes();
  if (cached && cached.length > 0) {
    // Return cached items directly without re-computing tags on every startup
    return cached;
  }

  const res = await fetch('/data/hellofresh_recipes.json');
  const fresh: Recipe[] = await res.json();
  const normalized = Array.isArray(fresh) ? normalizeCatalogRecipes(fresh) : [];
  if (normalized.length > 0) {
    setCachedRecipes(normalized).catch(() => {});
  }
  return normalized;
}
