import { createClient } from '@supabase/supabase-js';
import {
  CabinetItem,
  GroceryExtra,
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
 * Subscribes to Supabase Realtime changes across weekly_plan, cabinet, grocery_extras, grocery_checks, household_settings, and recipe_ratings.
 * Calls onPayload whenever another device inserts/updates/deletes a row.
 */
export function subscribeToFamilyRealtime(onPayload: (table: string, payload: any) => void) {
  const channel = supabase
    .channel('family-sync-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'weekly_plan' },
      (payload) => onPayload('weekly_plan', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cabinet' },
      (payload) => onPayload('cabinet', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_extras' },
      (payload) => onPayload('grocery_extras', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'grocery_checks' },
      (payload) => onPayload('grocery_checks', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'household_settings' },
      (payload) => onPayload('household_settings', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recipe_ratings' },
      (payload) => onPayload('recipe_ratings', payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

