import { CabinetItem, Recipe } from '../types/freshdiy';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash'];

/**
 * Converts a browser File to base64 for Gemini API payload
 */
export async function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({
        mimeType: file.type || 'image/jpeg',
        data: base64Data,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
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

  let prompt = '';
  if (mode === 'cabinet') {
    prompt = `Analyze this photo of a kitchen pantry or spice cabinet. Identify all visible spices, herbs, broth concentrates, sauces, oils, vinegars, and pantry staples.
Return ONLY a valid JSON array of objects with keys: "name" (clean English name, e.g. "Garlic Powder", "Smoked Paprika") and "category" (strictly one of: "Spices", "Sauces", "Broth Concentrates", "Oils & Vinegars", "Pantry").
Do not include markdown code block quotes, just the raw JSON array.`;
  } else if (mode === 'freezer') {
    prompt = `Analyze this photo of a kitchen freezer or deep freezer chest. Identify all visible frozen proteins, meats (chicken breasts, ground beef, pork chops, bacon, steaks), frozen seafood, frozen vegetables, and batch-cooked staples.
Return ONLY a valid JSON array of objects with keys: "name" (clean ingredient name, e.g. "Chicken Breasts", "Ground Beef", "Frozen Broccoli") and "category" ("Freezer & Deep Freeze").
Do not include markdown code block quotes, just the raw JSON array.`;
  } else {
    prompt = `Analyze this photo of a refrigerator or fresh produce drawer. Identify all visible fresh ingredients, proteins, produce, dairy, and opened food items.
Return ONLY a valid JSON array of objects with keys: "name" (clean ingredient name, e.g. "Chicken Breast", "Broccoli Florets", "Sour Cream") and "category" ("Refrigerator").
Do not include markdown code block quotes, just the raw JSON array.`;
  }

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorBody}`);
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          name: String(item.name || '').trim(),
          category: normalizeCategory(item.category),
        })).filter((item: any) => item.name.length > 0);
      }
    } catch (err) {
      lastError = err;
      // Try next model fallback
    }
  }

  throw lastError || new Error('Failed to analyze photo with Gemini');
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
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey.trim()
      )}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Gemini LLM error: ${res.statusText}`);
      }

      const json = await res.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
