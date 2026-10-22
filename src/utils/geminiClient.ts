import { supabase } from '../lib/supabase';
import { CabinetItem, MacroGoals, MacroMealSuggestion, Recipe } from '../types/freshdiy';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.0-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
];

function sendScanDebug(payload: Record<string, any>) {
  try {
    fetch('/__scan_debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // ignore in production
  }
}

/**
 * Extracts the non-thought text response from a Gemini generateContent payload.
 */
function extractModelText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return '';
  const outputParts = parts.filter((p: any) => typeof p?.text === 'string' && !p?.thought);
  if (outputParts.length > 0) {
    return outputParts.map((p: any) => p.text).join('\n').trim();
  }
  return parts.map((p: any) => p?.text || '').join('\n').trim();
}

/**
 * Resiliently parses a JSON array from model text, handling wrapped objects, string arrays,
 * and salvaging complete objects if truncated.
 */
function parseJsonArrayFromText(rawText: string): any[] {
  const stripped = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!stripped) return [];

  // 1. Try parsing the raw stripped text directly first (handles both `[...]` and `{ "items": [...] }`)
  try {
    const direct = JSON.parse(stripped);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === 'object') {
      const nestedArr = Object.values(direct).find((v) => Array.isArray(v)) as any[] | undefined;
      if (nestedArr) return nestedArr;
    }
  } catch {
    // continue to bracket extraction
  }

  // 2. Extract between first `[` and last `]`
  const firstBracket = stripped.indexOf('[');
  const lastBracket = stripped.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const parsed = JSON.parse(stripped.slice(firstBracket, lastBracket + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // continue to object salvage
    }
  }

  // 3. If truncated mid-stream, salvage all complete JSON objects `{ ... }`
  const matches = stripped.match(/\{[^{}]*\}/g);
  if (matches && matches.length > 0) {
    const salvaged: any[] = [];
    for (const m of matches) {
      try {
        salvaged.push(JSON.parse(m));
      } catch {
        // skip malformed fragment
      }
    }
    if (salvaged.length > 0) return salvaged;
  }

  return [];
}

/**
 * Calls Google Gemini either via the server proxy `/api/gemini` (when using a masked
 * household token or server proxy) or directly against the Google Generative Language API.
 */
async function callGeminiModel(params: {
  model: string;
  apiKey: string;
  contents: any[];
  generationConfig: Record<string, any>;
}): Promise<any> {
  const { model, apiKey, contents, generationConfig } = params;
  const cleanKey = apiKey.trim();

  // If the key is a masked household reference (or proxy is preferred), try `/api/gemini` first
  if (cleanKey.startsWith('HOUSEHOLD_SHARED:')) {
    const householdId = cleanKey.slice('HOUSEHOLD_SHARED:'.length);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const proxyRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model,
        householdId,
        contents,
        generationConfig,
      }),
    });

    if (proxyRes.ok) {
      return proxyRes.json();
    }
    const errText = await proxyRes.text();
    throw new Error(`Gemini Proxy error (${proxyRes.status}): ${errText}`);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    cleanKey
  )}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        responseMimeType: 'application/json',
        ...generationConfig,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
  }

  return res.json();
}

/**
 * Converts a browser File to base64 for Gemini Vision API.
 * Uses direct FileReader for normal photos (< 4MB) and safe canvas downscaling only for huge raw images.
 */
export async function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  const rawFallback = (): Promise<{ mimeType: string; data: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          mimeType: file.type || 'image/jpeg',
          data: result.split(',')[1] || '',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // For standard photos under 4MB (or HEIC/HEIF), send the original file directly
  const lowerType = (file.type || '').toLowerCase();
  if (file.size <= 4 * 1024 * 1024 || lowerType.includes('heic') || lowerType.includes('heif')) {
    return rawFallback();
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => {});
        }
        const natWidth = img.naturalWidth || img.width;
        const natHeight = img.naturalHeight || img.height;
        if (!natWidth || !natHeight) {
          URL.revokeObjectURL(objectUrl);
          resolve(await rawFallback());
          return;
        }
        const MAX_DIM = 1600;
        let width = natWidth;
        let height = natHeight;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(await rawFallback());
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Verify canvas actually rendered non-blank pixels
        const sample = ctx.getImageData(
          Math.floor(width / 2),
          Math.floor(height / 2),
          1,
          1
        ).data;
        const cornerSample = ctx.getImageData(
          Math.floor(width / 4),
          Math.floor(height / 4),
          1,
          1
        ).data;
        const isAllZero =
          sample[0] === 0 &&
          sample[1] === 0 &&
          sample[2] === 0 &&
          cornerSample[0] === 0 &&
          cornerSample[1] === 0 &&
          cornerSample[2] === 0;

        if (isAllZero) {
          URL.revokeObjectURL(objectUrl);
          resolve(await rawFallback());
          return;
        }

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = compressedDataUrl.split(',')[1] || '';
        URL.revokeObjectURL(objectUrl);
        if (base64.length < 4000) {
          resolve(await rawFallback());
          return;
        }
        resolve({
          mimeType: 'image/jpeg',
          data: base64,
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(await rawFallback());
      }
    };
    img.onerror = async () => {
      URL.revokeObjectURL(objectUrl);
      resolve(await rawFallback());
    };
    img.src = objectUrl;
  });
}

/**
 * Analyzes a photo using Gemini Vision to detect spice bottles or fridge ingredients.
 */
export async function analyzePhotoWithGemini(
  file: File,
  mode: 'cabinet' | 'fridge' | 'freezer',
  apiKey: string
): Promise<{ name: string; category: CabinetItem['category'] }[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('No Gemini API Key provided. Please configure your key in Family Settings.');
  }

  const { mimeType, data: base64Data } = await fileToBase64(file);
  sendScanDebug({
    step: 'image_prepared',
    mode,
    originalName: file.name,
    originalSize: file.size,
    originalType: file.type,
    mimeType,
    base64Length: base64Data.length,
  });

  const prompt = `Analyze this kitchen photo (such as a spice drawer, spice rack, pantry shelf, refrigerator, or freezer).
Carefully identify EVERY visible spice jar, herb, seasoning blend, bottle, sauce, oil, vinegar, pantry staple, produce item, or protein.
- Even if a jar is lying flat in a drawer, angled, or only shows a partial label (e.g. "GARL...", "PAPRIKA", "CUMIN", "OREG...", "CINN...") or visual contents through glass (e.g. red pepper flakes, black peppercorns, bay leaves, sesame seeds, dried herbs, garlic powder), include your best identification of the ingredient.
- For each detected item, provide:
  "name": clean common kitchen name (e.g. "Garlic Powder", "Smoked Paprika", "Ground Cumin", "Italian Seasoning", "Kosher Salt")
  "category": one of "Spices", "Sauces", "Broth Concentrates", "Oils & Vinegars", "Pantry", "Refrigerator", or "Freezer & Deep Freeze" (default to "${
    mode === 'cabinet' ? 'Spices' : mode === 'freezer' ? 'Freezer & Deep Freeze' : 'Refrigerator'
  }" when unsure).

Return ONLY a JSON array of objects, for example:
[{"name": "Garlic Powder", "category": "Spices"}, {"name": "Smoked Paprika", "category": "Spices"}]`;

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const json = await callGeminiModel({
        model,
        apiKey,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      });
      const rawText = extractModelText(json);
      sendScanDebug({
        step: 'model_response',
        model,
        finishReason: json?.candidates?.[0]?.finishReason,
        rawTextPreview: rawText.slice(0, 600),
      });
      const parsed = parseJsonArrayFromText(rawText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const mapped = parsed
          .map((item: any) => {
            if (typeof item === 'string') {
              return {
                name: item.trim(),
                category:
                  mode === 'cabinet'
                    ? ('Spices' as CabinetItem['category'])
                    : mode === 'freezer'
                    ? ('Freezer & Deep Freeze' as CabinetItem['category'])
                    : ('Refrigerator' as CabinetItem['category']),
              };
            }
            const rawName =
              item?.name ||
              item?.ingredient ||
              item?.item ||
              item?.spice ||
              item?.title ||
              item?.label ||
              '';
            return {
              name: String(rawName).trim(),
              category: normalizeCategory(
                item?.category ||
                  (mode === 'cabinet'
                    ? 'Spices'
                    : mode === 'freezer'
                    ? 'Freezer & Deep Freeze'
                    : 'Refrigerator')
              ),
            };
          })
          .filter((item: any) => item.name.length > 0);

        if (mapped.length > 0) {
          sendScanDebug({ step: 'mapped_success', model, count: mapped.length });
          return mapped;
        }
      }
    } catch (err: any) {
      lastError = err;
      sendScanDebug({
        step: 'model_error',
        model,
        error: err?.message || String(err),
      });
      // Try next model fallback
    }
  }

  if (lastError) {
    throw lastError;
  }
  return [];
}

/**
 * Intelligent AI Recipe Forking using Gemini LLM
 * Modifies ingredients, quantities, and cooking instructions based on family feedback.
 */
export async function forkRecipeWithGemini(
  baseRecipe: Recipe,
  feedbackNotes: string,
  authorName: string,
  apiKey: string
): Promise<{
  newRecipe: Recipe;
  changeSummary: string[];
}> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API Key required to run AI Recipe Forking.');
  }

  const prompt = `You are an expert culinary assistant modifying a recipe for a family.
Base Recipe Title: "${baseRecipe.title}" (${baseRecipe.subtitle || ''})
Ingredients: ${JSON.stringify(baseRecipe.ingredients_json)}
Cooking Instructions: ${JSON.stringify(baseRecipe.instructions_json)}

Family Feedback / Requested Changes: "${feedbackNotes}"

Your task:
1. Update the ingredients (adjust quantities, swap ingredients, or add seasonings as requested).
2. Update the cooking instructions text so the steps reflect the adjustments.
3. Provide a brief list of 1-3 concise bullet points summarizing what was changed.

Return ONLY a valid JSON object with the format:
{
  "title": "${baseRecipe.title} (Family Custom v${baseRecipe.version + 1})",
  "ingredients_json": [...same structure with name, amount, unit, aisle...],
  "instructions_json": [...same structure with step, title, body, timer_seconds, appliance_override...],
  "change_summary": ["bullet point 1", "bullet point 2"]
}
Do not wrap in markdown quotes. Just return the JSON.`;

  for (const model of GEMINI_MODELS) {
    try {
      const json = await callGeminiModel({
        model,
        apiKey,
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      });
      const rawText = extractModelText(json);
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJson);

      const newId = crypto.randomUUID();
      const newRecipe: Recipe = {
        ...baseRecipe,
        id: newId,
        version: baseRecipe.version + 1,
        original_id: baseRecipe.original_id || baseRecipe.id,
        title: result.title || `${baseRecipe.title} (v${baseRecipe.version + 1})`,
        ingredients_json: result.ingredients_json || baseRecipe.ingredients_json,
        instructions_json: result.instructions_json || baseRecipe.instructions_json,
        version_notes: `${authorName}: ${feedbackNotes}`,
        is_latest: true,
        created_at: new Date().toISOString(),
      };

      return {
        newRecipe,
        changeSummary: result.change_summary || ['Custom family adjustments applied'],
      };
    } catch {
      // Fallback to next model
    }
  }

  throw new Error('Gemini could not process recipe customization. Please try again.');
}

function normalizeCategory(cat: string): CabinetItem['category'] {
  const c = String(cat || '').toLowerCase();
  if (c.includes('freez') || c.includes('deep')) return 'Freezer & Deep Freeze';
  if (c.includes('fridge') || c.includes('refrigerat') || c.includes('dairy') || c.includes('produce')) return 'Refrigerator';
  if (c.includes('sauce')) return 'Sauces';
  if (c.includes('broth') || c.includes('concentrate') || c.includes('stock')) return 'Broth Concentrates';
  if (c.includes('oil') || c.includes('vinegar')) return 'Oils & Vinegars';
  if (c.includes('spice') || c.includes('season') || c.includes('herb')) return 'Spices';
  return 'Pantry';
}

/**
 * Suggests tailored meals matching a user's exact macro goals (Calories, Protein, Carbs, Fat)
 * while heavily prioritizing ingredients already present in their Freezer, Fridge, and Pantry.
 */
export async function suggestMacroMealsWithGemini(params: {
  macroGoals: MacroGoals;
  onHandItems: {
    freezer: string[];
    fridge: string[];
    pantry: string[];
  };
  isDairyFree: boolean;
  apiKey: string;
  catalogRecipes?: Recipe[];
}): Promise<MacroMealSuggestion[]> {
  const { macroGoals, onHandItems, isDairyFree, apiKey, catalogRecipes = [] } = params;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API key is required to run AI Macro Meal Generation.');
  }

  const catalogContext = catalogRecipes.slice(0, 25).map((r) => ({
    id: r.id,
    title: r.title,
    prep: r.prep_time,
  }));

  const prompt = `You are an elite sports nutritionist and Michelin-trained meal-prep chef.
A user has specific nutritional macro targets and wants 3 distinct, delicious dinner ideas that MAXIMIZE the use of ingredients already in their house to eliminate extra grocery cost and waste.

TARGET MACROS (per meal or daily meal-prep plan):
- Target Calories: ~${macroGoals.calories} kcal
- Target Protein: >= ${macroGoals.proteinGrams}g
- Target Net Carbs: ~${macroGoals.carbsGrams}g
- Target Fats: ~${macroGoals.fatGrams}g
- Diet Style / Focus: ${macroGoals.dietStyle || macroGoals.dietType || 'balanced'}
- User Notes / Cravings: ${macroGoals.notes || 'None'}
- Allergen Rule: ${
    isDairyFree
      ? 'DAIRY-FREE ACTIVE (Do not use cow milk, butter, or standard dairy cheese - use plant butter, oat milk, or olive oil)'
      : 'None'
  }

NOTE ON HIGH ATHLETE / BULKING TARGETS:
If the user specified high athlete, mass-builder, or strongman targets (e.g. 2,000–6,000+ calories, 150–350+g protein, 400–800+g carbs), generate high-yield, high-density power meals or meal-prep batches with hearty portions of protein and clean carbohydrates that directly satisfy these ambitious goals. Provide realistic nutrition calculations matching the target!

INGREDIENTS CURRENTLY AVAILABLE AT HOME:
- Deep Freezer / Freezer: ${onHandItems.freezer.length > 0 ? onHandItems.freezer.join(', ') : 'None specified'}
- Refrigerator: ${onHandItems.fridge.length > 0 ? onHandItems.fridge.join(', ') : 'None specified'}
- Pantry & Spices in Stock: ${onHandItems.pantry.length > 0 ? onHandItems.pantry.join(', ') : 'None specified'}

AVAILABLE CATALOG RECIPES (you can match or adapt one of these if fitting, or generate a tailored custom meal):
${JSON.stringify(catalogContext)}

YOUR TASK:
Provide exactly 3 distinct, high-protein or macro-aligned dinner suggestions.
For each meal:
1. Hit the target macros as closely as possible (accurately calculate calories, proteinGrams, carbsGrams, fatGrams, fiberGrams per serving).
2. Prioritize the on-hand ingredients in their Freezer, Fridge, and Pantry.
3. List which ingredients come from home ("ingredientsFromHome") and which minimal extra items they'd need to buy from the store ("ingredientsToBuy").
4. Provide 2-3 concise "macroHighlights" (e.g. "48g High Protein", "Hits 620 kcal target", "Low Net Carbs").
5. Provide a 2-sentence cookingSummary on how to prepare it.
6. Provide a macroMatchScore (integer 85-99%) based on how well it satisfies their targets.
7. If this adapts a known catalog recipe, include its "matchedRecipeId", otherwise omit or set null.

Return ONLY a valid JSON array of 3 objects with this exact structure:
[
  {
    "id": "macro-1",
    "title": "Lemon Garlic Herbed Chicken Breast & Crispy Potatoes",
    "subtitle": "High-protein skillet with pan sauce",
    "matchedRecipeId": null,
    "prepTimeMinutes": 25,
    "nutrition": {
      "calories": 620,
      "proteinGrams": 46,
      "carbsGrams": 42,
      "fatGrams": 18,
      "fiberGrams": 6
    },
    "macroMatchScore": 96,
    "macroHighlights": ["46g Protein", "Hits 620 kcal target", "Low Saturated Fat"],
    "ingredientsFromHome": ["Chicken Breast (Freezer)", "Garlic Powder (Pantry)", "Olive Oil (Pantry)"],
    "ingredientsToBuy": ["Fresh Lemons", "Yukon Gold Potatoes"],
    "cookingSummary": "Pan-sear seasoned chicken breasts in olive oil until golden. Toss cubed potatoes with rosemary and garlic, roasting until crisp."
  }
]
Do not wrap in markdown quotes. Just return the raw JSON array.`;

  for (const model of GEMINI_MODELS) {
    try {
      const json = await callGeminiModel({
        model,
        apiKey,
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      });
      const rawText = extractModelText(json);
      const parsed = parseJsonArrayFromText(rawText);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => ({
          id: item.id || `macro-sugg-${idx}-${Date.now()}`,
          title: String(item.title || 'High-Protein Skillet'),
          subtitle: String(item.subtitle || 'Custom macro-balanced dinner'),
          matchedRecipeId: item.matchedRecipeId || undefined,
          prepTimeMinutes: Number(item.prepTimeMinutes) || 30,
          nutrition: {
            calories: Number(item.nutrition?.calories) || macroGoals.calories,
            proteinGrams: Number(item.nutrition?.proteinGrams) || macroGoals.proteinGrams,
            carbsGrams: Number(item.nutrition?.carbsGrams) || macroGoals.carbsGrams,
            fatGrams: Number(item.nutrition?.fatGrams) || macroGoals.fatGrams,
            fiberGrams: Number(item.nutrition?.fiberGrams) || 5,
          },
          macroMatchScore: Math.min(100, Math.max(70, Number(item.macroMatchScore) || 92)),
          macroHighlights: Array.isArray(item.macroHighlights)
            ? item.macroHighlights
            : [`${item.nutrition?.proteinGrams || macroGoals.proteinGrams}g Protein`],
          ingredientsFromHome: Array.isArray(item.ingredientsFromHome)
            ? item.ingredientsFromHome
            : [],
          ingredientsToBuy: Array.isArray(item.ingredientsToBuy)
            ? item.ingredientsToBuy
            : [],
          cookingSummary: String(item.cookingSummary || 'Cook according to instructions.'),
        }));
      }
    } catch {
      // Fallback to next model
    }
  }

  throw new Error('Gemini could not generate macro meal suggestions. Please try again.');
}
