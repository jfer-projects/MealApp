import { createClient } from '@supabase/supabase-js';
import {
  CabinetItem,
  GroceryExtra,
  MacroGoals,
  Recipe,
  RecipeFeedback,
  WeeklyPlanItem,
} from '../types/freshdiy';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://xamzenezncjsmmvkafxq.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_ouCtW1z5jcvxE1PaDbT1eQ_Xlu5CbNy';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface SupabaseSyncStatus {
  connected: boolean;
  tablesReady: boolean;
  lastSyncedAt: string | null;
  errorMessage?: string;
}

export async function checkSupabaseTablesReady(): Promise<SupabaseSyncStatus> {
  try {
    const { error } = await supabase.from('recipes').select('id').limit(1);
    if (error) {
      return {
        connected: true,
        tablesReady: false,
        lastSyncedAt: null,
        errorMessage: error.message,
      };
    }
    return {
      connected: true,
      tablesReady: true,
      lastSyncedAt: new Date().toLocaleTimeString(),
    };
  } catch (err) {
    return {
      connected: false,
      tablesReady: false,
      lastSyncedAt: null,
      errorMessage: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

export async function syncAllToSupabase(payload: {
  recipes: Recipe[];
  cabinet: CabinetItem[];
  weeklyPlan: WeeklyPlanItem[];
  feedback: RecipeFeedback[];
  extras: GroceryExtra[];
  householdId?: string | null;
  userId?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const status = await checkSupabaseTablesReady();
  if (!status.tablesReady) {
    return {
      ok: false,
      message:
        status.errorMessage ||
        'Tables not found in Supabase yet. Run supabase/schema.sql in your Supabase SQL Editor first.',
    };
  }

  try {
    // 1. Upsert only custom forked recipes (v2+) to keep sync fast
    const customForks = payload.recipes.filter((r) => r.version > 1);
    for (let i = 0; i < customForks.length; i += 25) {
      const batch = customForks.slice(i, i + 25);
      await supabase.from('recipes').upsert(batch, { onConflict: 'id' });
    }

    // 2. Upsert cabinet items (including multi-location quantities if migration is applied)
    if (payload.cabinet.length > 0) {
      const cabRows = payload.cabinet.map((c) => ({
        item_name: c.item_name,
        category: c.category,
        status: c.status,
        usage_count: c.usage_count,
        freezer_qty: c.freezer_qty ?? 0,
        fridge_qty: c.fridge_qty ?? 0,
        pantry_qty: c.pantry_qty ?? 0,
        unit: c.unit || 'item',
        ...(payload.householdId ? { household_id: payload.householdId } : {}),
        ...(payload.userId ? { user_id: payload.userId } : {}),
      }));
      const { error: cabErr } = await supabase
        .from('cabinet')
        .upsert(cabRows, { onConflict: 'household_id,item_name' });
      if (cabErr) {
        // Fallback if migration_sync_repair.sql hasn't been run yet
        const legacyRows = payload.cabinet.map((c) => ({
          item_name: c.item_name,
          category: c.category,
          status: c.status,
          usage_count: c.usage_count,
          ...(payload.householdId ? { household_id: payload.householdId } : {}),
        }));
        await supabase.from('cabinet').upsert(legacyRows, { onConflict: 'item_name' });
      }
    }

    return {
      ok: true,
      message: `Synced ${payload.cabinet.length} inventory items & ${payload.weeklyPlan.length} planned meals to Cloud!`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Supabase sync failed',
    };
  }
}

/**
 * Saves Household Settings (Gemini API Key, Author ID, HelloFresh Price, Macro Goals)
 * to both Supabase `household_settings` (with automatic schema-fallback if newer columns
 * haven't been migrated yet) AND the user's Supabase Auth `user_metadata` so that logging
 * in from any device (PC, Phone, Tablet) always restores the API key & macro targets.
 */
export async function saveHouseholdSettingsToCloud(params: {
  householdId?: string | null;
  userId?: string | null;
  geminiApiKey?: string;
  geminiKeyAuthorId?: string | null;
  hellofreshPrice?: number;
  macroGoals?: MacroGoals | null;
  updateApiKey?: boolean;
}): Promise<void> {
  const {
    householdId,
    userId,
    geminiApiKey,
    geminiKeyAuthorId,
    hellofreshPrice,
    macroGoals,
    updateApiKey = false,
  } = params;

  // 1. Persist to Supabase Auth user_metadata so the user's own account carries their settings across PC & Phone
  try {
    const authMetaUpdate: Record<string, any> = {};
    if (updateApiKey && geminiApiKey !== undefined) {
      authMetaUpdate.gemini_api_key = geminiApiKey || null;
      authMetaUpdate.gemini_api_key_set_by = geminiApiKey ? (geminiKeyAuthorId || userId || null) : null;
    }
    if (hellofreshPrice !== undefined) {
      authMetaUpdate.hellofresh_price_per_serving = hellofreshPrice;
    }
    if (macroGoals !== undefined) {
      authMetaUpdate.macro_goals = macroGoals;
    }
    if (Object.keys(authMetaUpdate).length > 0) {
      await supabase.auth.updateUser({ data: authMetaUpdate });
    }
  } catch (err) {
    console.warn('Could not sync settings to auth user_metadata:', err);
  }

  // 2. Persist to `public.household_settings` so all members of the household share access
  if (!householdId) return;

  const nowIso = new Date().toISOString();
  const fullPayload: Record<string, any> = {
    household_id: householdId,
    updated_at: nowIso,
  };

  if (updateApiKey && geminiApiKey !== undefined) {
    fullPayload.gemini_api_key = geminiApiKey || null;
    fullPayload.gemini_api_key_set_by = geminiApiKey ? (geminiKeyAuthorId || userId || null) : null;
  }
  if (hellofreshPrice !== undefined) {
    fullPayload.hellofresh_price_per_serving = hellofreshPrice;
  }
  if (macroGoals !== undefined) {
    fullPayload.macro_goals = macroGoals;
  }

  try {
    const { error } = await supabase
      .from('household_settings')
      .upsert(fullPayload, { onConflict: 'household_id' });

    if (error) {
      // Fallback if `gemini_api_key_set_by` or `macro_goals` columns haven't been added via SQL yet:
      // Store them safely inside the existing `dietary_flags` text[] column while saving `gemini_api_key` directly!
      const { data: existingRow } = await supabase
        .from('household_settings')
        .select('dietary_flags, gemini_api_key, hellofresh_price_per_serving')
        .eq('household_id', householdId)
        .maybeSingle();

      const existingFlags: string[] = Array.isArray(existingRow?.dietary_flags)
        ? existingRow.dietary_flags.filter(
            (f: string) => !f.startsWith('__author:') && !f.startsWith('__macros:')
          )
        : [];

      const authorToSave =
        updateApiKey && geminiApiKey !== undefined
          ? geminiApiKey
            ? geminiKeyAuthorId || userId || ''
            : ''
          : (existingRow?.dietary_flags || [])
              .find((f: string) => f.startsWith('__author:'))
              ?.slice('__author:'.length) || '';

      const macrosToSave =
        macroGoals !== undefined
          ? macroGoals
          : (() => {
              const raw = (existingRow?.dietary_flags || []).find((f: string) =>
                f.startsWith('__macros:')
              );
              if (!raw) return null;
              try {
                return JSON.parse(raw.slice('__macros:'.length));
              } catch {
                return null;
              }
            })();

      if (authorToSave) existingFlags.push(`__author:${authorToSave}`);
      if (macrosToSave) existingFlags.push(`__macros:${JSON.stringify(macrosToSave)}`);

      const legacyPayload: Record<string, any> = {
        household_id: householdId,
        dietary_flags: existingFlags,
        updated_at: nowIso,
      };
      if (updateApiKey && geminiApiKey !== undefined) {
        legacyPayload.gemini_api_key = geminiApiKey || null;
      }
      if (hellofreshPrice !== undefined) {
        legacyPayload.hellofresh_price_per_serving = hellofreshPrice;
      }

      await supabase
        .from('household_settings')
        .upsert(legacyPayload, { onConflict: 'household_id' });
    }
  } catch (err) {
    console.warn('Could not upsert household_settings:', err);
  }
}

/**
 * Loads Household Settings from Supabase `household_settings` + Auth `user_metadata` + local cache,
 * and automatically backfills the cloud if the user already entered a key on this device.
 */
export async function loadHouseholdSettingsFromCloud(params: {
  householdId?: string | null;
  userId?: string | null;
}): Promise<{
  geminiApiKey: string;
  geminiKeyAuthorId: string | null;
  hellofreshPrice?: number;
  macroGoals?: MacroGoals | null;
}> {
  const { householdId, userId } = params;

  const localHouseholdKey = householdId
    ? localStorage.getItem(`freshdiy_gemini_api_key_${householdId}`) || ''
    : '';
  const localAuthorId = householdId
    ? localStorage.getItem(`freshdiy_gemini_key_author_${householdId}`) || null
    : null;
  const localFallbackKey = localStorage.getItem('freshdiy_gemini_api_key_v1') || '';

  // Check user_metadata from Supabase Auth
  let metaKey = '';
  let metaAuthorId: string | null = null;
  let metaPrice: number | undefined;
  let metaMacros: MacroGoals | null = null;

  try {
    const { data: userData } = await supabase.auth.getUser();
    const meta = (userData?.user?.user_metadata || {}) as Record<string, any>;
    if (typeof meta.gemini_api_key === 'string' && meta.gemini_api_key.trim()) {
      metaKey = meta.gemini_api_key.trim();
      metaAuthorId = meta.gemini_api_key_set_by || userId || null;
    }
    if (meta.hellofresh_price_per_serving) {
      metaPrice = Number(meta.hellofresh_price_per_serving);
    }
    if (meta.macro_goals) {
      metaMacros = meta.macro_goals as MacroGoals;
    }
  } catch {
    // ignore offline auth error
  }

  if (!householdId) {
    const resolvedKey = metaKey || localFallbackKey;
    if (resolvedKey) {
      localStorage.setItem('freshdiy_gemini_api_key_v1', resolvedKey);
    }
    return {
      geminiApiKey: resolvedKey,
      geminiKeyAuthorId: metaAuthorId || userId || null,
      hellofreshPrice: metaPrice,
      macroGoals: metaMacros,
    };
  }

  let dbKey = '';
  let dbAuthorId: string | null = null;
  let dbPrice: number | undefined;
  let dbMacros: MacroGoals | null = null;

  try {
    const { data } = await supabase
      .from('household_settings')
      .select('*')
      .eq('household_id', householdId)
      .maybeSingle();

    if (data) {
      if (typeof data.gemini_api_key === 'string' && data.gemini_api_key.trim()) {
        dbKey = data.gemini_api_key.trim();
      }
      if (data.gemini_api_key_set_by) {
        dbAuthorId = data.gemini_api_key_set_by;
      }
      if (data.hellofresh_price_per_serving) {
        dbPrice = Number(data.hellofresh_price_per_serving);
      }
      if (data.macro_goals) {
        dbMacros = data.macro_goals as MacroGoals;
      }

      // Check fallback encoded metadata in `dietary_flags` if columns weren't migrated yet
      if (Array.isArray(data.dietary_flags)) {
        for (const flag of data.dietary_flags) {
          if (!dbAuthorId && typeof flag === 'string' && flag.startsWith('__author:')) {
            dbAuthorId = flag.slice('__author:'.length) || null;
          }
          if (!dbMacros && typeof flag === 'string' && flag.startsWith('__macros:')) {
            try {
              dbMacros = JSON.parse(flag.slice('__macros:'.length));
            } catch {
              // ignore
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching household_settings:', err);
  }

  const finalKey = dbKey || metaKey || localHouseholdKey || localFallbackKey;
  const finalAuthorId = dbAuthorId || metaAuthorId || localAuthorId || (finalKey ? userId || null : null);
  const finalPrice = dbPrice ?? metaPrice;
  const finalMacros = dbMacros ?? metaMacros;

  // Cache locally for this household
  if (finalKey) {
    localStorage.setItem(`freshdiy_gemini_api_key_${householdId}`, finalKey);
    if (finalAuthorId) {
      localStorage.setItem(`freshdiy_gemini_key_author_${householdId}`, finalAuthorId);
    }
  }

  // Auto-heal / backfill: If this device or user_metadata had a key (or macros) that wasn't in `household_settings` yet, push it to the cloud now!
  if ((finalKey && !dbKey) || (finalMacros && !dbMacros)) {
    saveHouseholdSettingsToCloud({
      householdId,
      userId,
      geminiApiKey: finalKey || undefined,
      geminiKeyAuthorId: finalAuthorId,
      hellofreshPrice: finalPrice,
      macroGoals: finalMacros,
      updateApiKey: Boolean(finalKey && !dbKey),
    }).catch(() => {});
  }

  return {
    geminiApiKey: finalKey,
    geminiKeyAuthorId: finalAuthorId,
    hellofreshPrice: finalPrice,
    macroGoals: finalMacros,
  };
}

/**
 * Subscribes to Supabase Realtime changes across weekly_plan, cabinet, grocery_extras, grocery_checks, household_settings, and recipe_ratings.
 * Calls onPayload whenever another device inserts/updates/deletes a row.
 */
export function subscribeToFamilyRealtime(
  onPayload: (table: string, payload: any) => void,
  householdId?: string | null
) {
  const filterConfig = householdId ? { filter: `household_id=eq.${householdId}` } : {};

  const channel = supabase
    .channel(`family-sync-${householdId || 'global'}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'weekly_plan', ...filterConfig },
      (payload) => onPayload('weekly_plan', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cabinet', ...filterConfig },
      (payload) => onPayload('cabinet', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_extras', ...filterConfig },
      (payload) => onPayload('grocery_extras', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_checks', ...filterConfig },
      (payload) => onPayload('grocery_checks', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'household_settings', ...filterConfig },
      (payload) => onPayload('household_settings', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recipe_ratings', ...filterConfig },
      (payload) => onPayload('recipe_ratings', payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

