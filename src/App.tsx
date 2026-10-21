import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  ChefHat,
  Database,
  Home,
  Leaf,
  Package,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { BlendRecipeModal } from './components/BlendRecipeModal';
import { CabinetView } from './components/CabinetView';
import { CatalogPlannerView } from './components/CatalogPlannerView';
import { CookingView } from './components/CookingView';
import { FamilySettingsModal } from './components/FamilySettingsModal';
import { GroceryView } from './components/GroceryView';
import { PhotoScannerModal } from './components/PhotoScannerModal';
import { fetchUserProfile } from './lib/authService';
import {
  checkSupabaseTablesReady,
  subscribeToFamilyRealtime,
  supabase,
  SupabaseSyncStatus,
  syncAllToSupabase,
} from './lib/supabase';
import {
  CabinetItem,
  DayOfWeek,
  DAYS_OF_WEEK,
  GroceryExtra,
  Recipe,
  RecipeFeedback,
  RecipeRating,
  ServingsSize,
  StockStatus,
  UserProfile,
  WeeklyPlanItem,
} from './types/freshdiy';
import { forkRecipeFromFeedback } from './utils/aiVersioningEngine';
import { DEFAULT_CABINET_ITEMS } from './utils/blendDecoder';
import { getAdjacentWeek, getMondayOfWeek } from './utils/dateUtils';
import { forkRecipeWithGemini } from './utils/geminiClient';
import {
  deductCabinetForCompletedMeals,
  deriveStockStatusFromQuantities,
  getItemQuantities,
  mergeDuplicateCabinetItems,
} from './utils/groceryEngine';
import { rankRecipesByOnHandIngredients } from './utils/pantryMatcher';

type ActiveTab = 'catalog' | 'cabinet' | 'grocery' | 'cooking';

const STORAGE_KEYS = {
  recipes: 'freshdiy_recipes_v2',
  cabinet: 'freshdiy_cabinet_v1',
  plan: 'freshdiy_weekly_plan_v2',
  feedback: 'freshdiy_feedback_v1',
  extras: 'freshdiy_extras_v1',
  ratings: 'freshdiy_ratings_v1',
  isDairyFree: 'freshdiy_is_dairy_free_v1',
  defaultServings: 'freshdiy_default_servings_v1',
  valleriaPhone: 'freshdiy_valleria_phone_v1',
  valleriaEmail: 'freshdiy_valleria_email_v1',
  familyMember: 'freshdiy_family_member_v1',
  activeWeek: 'freshdiy_active_week_v1',
  checkedGroceryKeys: 'freshdiy_checked_grocery_keys_v1',
  fridgeItems: 'freshdiy_fridge_items_v1',
};

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');

  // Dated weekly navigation: Monday-based YYYY-MM-DD
  const [activeWeekStartDate, setActiveWeekStartDate] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.activeWeek) || getMondayOfWeek();
  });

  // Family profile toggle: 'Parent' vs 'Valleria'
  const [activeFamilyMember, setActiveFamilyMember] = useState<'Parent' | 'Valleria'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.familyMember);
    return saved === 'Valleria' ? 'Valleria' : 'Parent';
  });

  const [valleriaEmail, setValleriaEmail] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.valleriaEmail) || '';
  });

  const [checkedGroceryKeys, setCheckedGroceryKeys] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.checkedGroceryKeys);
    return saved ? JSON.parse(saved) : {};
  });

  const [onHandFridgeItems, setOnHandFridgeItems] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.fridgeItems);
    return saved
      ? JSON.parse(saved)
      : ['Chicken Breast', 'Potatoes', 'Broccoli', 'Dairy-Free Sour Cream'];
  });

  // Core Spec Defaults: 4 Servings & Dairy-Free Mode = TRUE
  const [defaultServings, setDefaultServings] = useState<ServingsSize>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.defaultServings);
    return saved === '2' || saved === '4' || saved === '6'
      ? (Number(saved) as ServingsSize)
      : 4;
  });

  const [isDairyFree, setIsDairyFree] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.isDairyFree);
    return saved !== null ? saved === 'true' : true;
  });

  const [valleriaPhone, setValleriaPhone] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.valleriaPhone) || '';
  });

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cabinet, setCabinet] = useState<CabinetItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.cabinet);
    const parsed: CabinetItem[] = saved ? JSON.parse(saved) : DEFAULT_CABINET_ITEMS;
    return mergeDuplicateCabinetItems(parsed);
  });
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.plan);
    return saved ? JSON.parse(saved) : [];
  });
  const [feedbackList, setFeedbackList] = useState<RecipeFeedback[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.feedback);
    return saved ? JSON.parse(saved) : [];
  });
  const [ratingsMap, setRatingsMap] = useState<Record<string, RecipeRating>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ratings);
    return saved ? JSON.parse(saved) : {};
  });
  const [extras, setExtras] = useState<GroceryExtra[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.extras);
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: generateUuid(),
            week_start_date: getMondayOfWeek(),
            item_name: 'Kids Organic Apple Sauce Pouches',
            aisle: 'Household & Extras',
            checked: false,
            is_recurring: true,
          },
          {
            id: generateUuid(),
            week_start_date: getMondayOfWeek(),
            item_name: 'Barista Oat Milk (for Coffee)',
            aisle: 'Dairy Alternatives',
            checked: false,
            is_recurring: true,
          },
        ];
  });

  // Active recipe in Cooking View & Modals
  const [cookingRecipeId, setCookingRecipeId] = useState<string | null>(null);
  const [cookingServings, setCookingServings] = useState<ServingsSize>(4);
  const [activeBlendModal, setActiveBlendModal] = useState<string | null>(null);
  const [photoScannerState, setPhotoScannerState] = useState<{
    open: boolean;
    mode: 'cabinet' | 'fridge' | 'freezer';
  }>({ open: false, mode: 'cabinet' });

  // Notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Authentication & Household State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState<boolean>(false);

  // Household Settings (Gemini Key & Cost Benchmarks)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('freshdiy_gemini_api_key_v1') || '';
  });
  const [hellofreshPrice, setHellofreshPrice] = useState<number>(() => {
    const saved = localStorage.getItem('freshdiy_hf_price_v1');
    return saved ? parseFloat(saved) : 11.49;
  });

  // Supabase Status
  const [supaStatus, setSupaStatus] = useState<SupabaseSyncStatus>({
    connected: false,
    tablesReady: false,
    lastSyncedAt: null,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Supabase Auth Session & Lifecycle Listener
  useEffect(() => {
    let isMounted = true;

    const safetyTimer = setTimeout(() => {
      if (isMounted) setAuthChecking(false);
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          fetchUserProfile(session.user.id, session.user.email || '')
            .then((prof) => {
              if (isMounted) {
                setCurrentUser(prof);
                setAuthChecking(false);
                clearTimeout(safetyTimer);
              }
            })
            .catch((err) => {
              console.error('Failed to fetch user profile:', err);
              if (isMounted) {
                setAuthChecking(false);
                clearTimeout(safetyTimer);
              }
            });
        } else {
          if (isMounted) {
            setAuthChecking(false);
            clearTimeout(safetyTimer);
          }
        }
      })
      .catch((err) => {
        console.error('Session check error:', err);
        if (isMounted) {
          setAuthChecking(false);
          clearTimeout(safetyTimer);
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const prof = await fetchUserProfile(session.user.id, session.user.email || '');
          if (isMounted) setCurrentUser(prof);
        } catch (err) {
          console.error('Auth state change error:', err);
        }
      } else {
        if (isMounted) setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Sync Household Settings & Ratings from Supabase
  useEffect(() => {
    if (!currentUser?.household?.id || !supaStatus.tablesReady) return;
    const hId = currentUser.household.id;

    supabase
      .from('household_settings')
      .select('*')
      .eq('household_id', hId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.gemini_api_key) {
            setGeminiApiKey(data.gemini_api_key);
            localStorage.setItem('freshdiy_gemini_api_key_v1', data.gemini_api_key);
          }
          if (data.hellofresh_price_per_serving) {
            setHellofreshPrice(Number(data.hellofresh_price_per_serving));
            localStorage.setItem('freshdiy_hf_price_v1', String(data.hellofresh_price_per_serving));
          }
        }
      });

    supabase
      .from('recipe_ratings')
      .select('*')
      .eq('household_id', hId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const nextMap: Record<string, RecipeRating> = {};
          for (const row of data) {
            nextMap[row.recipe_id] = row as RecipeRating;
          }
          setRatingsMap((prev) => ({ ...prev, ...nextMap }));
        }
      });
  }, [currentUser?.household?.id, supaStatus.tablesReady]);

  // Sync Shared In-Store Grocery Checkmarks from Supabase
  useEffect(() => {
    if (!currentUser?.household?.id || !supaStatus.tablesReady) return;
    supabase
      .from('grocery_checks')
      .select('item_key, checked')
      .eq('household_id', currentUser.household.id)
      .eq('week_start_date', activeWeekStartDate)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCheckedGroceryKeys((prev) => {
            const next = { ...prev };
            for (const row of data) {
              next[row.item_key] = row.checked;
            }
            return next;
          });
        }
      });
  }, [currentUser?.household?.id, activeWeekStartDate, supaStatus.tablesReady]);

  useEffect(() => {
    async function loadInitialData() {
      const status = await checkSupabaseTablesReady();
      setSupaStatus(status);

      try {
        const res = await fetch('/data/hellofresh_recipes.json');
        const baseCatalog: Recipe[] = await res.json();

        let forkedRecipes: Recipe[] = [];
        const savedForks = localStorage.getItem('freshdiy_forked_recipes_v1');
        if (savedForks) {
          try {
            forkedRecipes = JSON.parse(savedForks);
          } catch {
            // ignore
          }
        }

        if (status.tablesReady) {
          const householdId = currentUser?.household?.id;
          let cabQuery = supabase.from('cabinet').select('*').order('item_name', { ascending: true });
          let planQuery = supabase.from('weekly_plan').select('*');
          let extraQuery = supabase.from('grocery_extras').select('*').order('created_at', { ascending: true });

          if (householdId) {
            cabQuery = cabQuery.or(`household_id.eq.${householdId},user_id.eq.${currentUser?.id},household_id.is.null`);
            planQuery = planQuery.or(`household_id.eq.${householdId},user_id.eq.${currentUser?.id},household_id.is.null`);
            extraQuery = extraQuery.or(`household_id.eq.${householdId},user_id.eq.${currentUser?.id},household_id.is.null`);
          }

          const [
            { data: remoteForks },
            { data: remoteCabinet },
            { data: remotePlan },
            { data: remoteFeedback },
            { data: remoteExtras },
          ] = await Promise.all([
            supabase
              .from('recipes')
              .select('*')
              .gt('version', 1)
              .order('version', { ascending: false }),
            cabQuery,
            planQuery,
            supabase
              .from('recipe_feedback')
              .select('*')
              .order('created_at', { ascending: false }),
            extraQuery,
          ]);

          if (remoteCabinet && remoteCabinet.length > 0) {
            setCabinet(mergeDuplicateCabinetItems(remoteCabinet as CabinetItem[]));
          }
          if (remotePlan && remotePlan.length > 0) {
            setWeeklyPlan(remotePlan as WeeklyPlanItem[]);
          }
          if (remoteFeedback && remoteFeedback.length > 0) {
            setFeedbackList(remoteFeedback as RecipeFeedback[]);
          }
          if (remoteExtras && remoteExtras.length > 0) {
            setExtras(remoteExtras as GroceryExtra[]);
          }
          if (remoteForks && remoteForks.length > 0) {
            forkedRecipes = remoteForks as Recipe[];
          }
        }

        const forkedOriginalIds = new Set(
          forkedRecipes.map((f) => f.original_id || f.id)
        );
        const mergedCatalog = [
          ...forkedRecipes,
          ...baseCatalog.map((r) =>
            forkedOriginalIds.has(r.original_id || r.id)
              ? { ...r, is_latest: false }
              : r
          ),
        ];

        setRecipes(mergedCatalog);

        const existingPlan = localStorage.getItem(STORAGE_KEYS.plan);
        const currentMonday = getMondayOfWeek();
        if (!existingPlan && mergedCatalog.length >= 3) {
          const starterPlan: WeeklyPlanItem[] = [
            {
              id: generateUuid(),
              week_start_date: currentMonday,
              recipe_id: mergedCatalog[0].id,
              day_of_week: 'Monday',
              servings: 4,
              status: 'planned',
            },
            {
              id: generateUuid(),
              week_start_date: currentMonday,
              recipe_id: mergedCatalog[1].id,
              day_of_week: 'Wednesday',
              servings: 4,
              status: 'planned',
            },
            {
              id: generateUuid(),
              week_start_date: currentMonday,
              recipe_id: mergedCatalog[2].id,
              day_of_week: 'Friday',
              servings: 4,
              status: 'planned',
            },
          ];
          setWeeklyPlan(starterPlan);
          localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(starterPlan));
        }
      } catch (err) {
        console.error('Failed to load scraped recipes:', err);
      }
    }
    loadInitialData();
  }, [currentUser?.id, currentUser?.household?.id]);

  // Multi-device Realtime Sync for Household Members (no paid SMS)
  useEffect(() => {
    if (!supaStatus.tablesReady) return;

    const unsubscribe = subscribeToFamilyRealtime(async (table) => {
      try {
        const hId = currentUser?.household?.id;
        if (table === 'weekly_plan') {
          let query = supabase.from('weekly_plan').select('*');
          if (hId) query = query.or(`household_id.eq.${hId},user_id.eq.${currentUser?.id},household_id.is.null`);
          const { data } = await query;
          if (data) setWeeklyPlan(data as WeeklyPlanItem[]);
        } else if (table === 'cabinet') {
          let query = supabase.from('cabinet').select('*').order('item_name', { ascending: true });
          if (hId) query = query.or(`household_id.eq.${hId},user_id.eq.${currentUser?.id},household_id.is.null`);
          const { data } = await query;
          if (data) setCabinet(mergeDuplicateCabinetItems(data as CabinetItem[]));
        } else if (table === 'grocery_extras') {
          let query = supabase.from('grocery_extras').select('*').order('created_at', { ascending: true });
          if (hId) query = query.or(`household_id.eq.${hId},user_id.eq.${currentUser?.id},household_id.is.null`);
          const { data } = await query;
          if (data) setExtras(data as GroceryExtra[]);
        } else if (table === 'grocery_checks') {
          if (hId) {
            const { data } = await supabase
              .from('grocery_checks')
              .select('item_key, checked')
              .eq('household_id', hId)
              .eq('week_start_date', activeWeekStartDate);
            if (data) {
              setCheckedGroceryKeys((prev) => {
                const next = { ...prev };
                for (const row of data) {
                  next[row.item_key] = row.checked;
                }
                return next;
              });
            }
          }
        } else if (table === 'household_settings') {
          if (hId) {
            const { data } = await supabase
              .from('household_settings')
              .select('*')
              .eq('household_id', hId)
              .maybeSingle();
            if (data) {
              if (data.gemini_api_key) setGeminiApiKey(data.gemini_api_key);
              if (data.hellofresh_price_per_serving) setHellofreshPrice(Number(data.hellofresh_price_per_serving));
            }
          }
        } else if (table === 'recipe_ratings') {
          if (hId) {
            const { data } = await supabase
              .from('recipe_ratings')
              .select('*')
              .eq('household_id', hId);
            if (data) {
              const nextMap: Record<string, RecipeRating> = {};
              for (const row of data) {
                nextMap[row.recipe_id] = row as RecipeRating;
              }
              setRatingsMap((prev) => ({ ...prev, ...nextMap }));
            }
          }
        }
      } catch (err) {
        console.error('Realtime update refresh error:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [supaStatus.tablesReady, currentUser?.id, currentUser?.household?.id, activeWeekStartDate]);

  useEffect(() => {
    const forksOnly = recipes.filter((r) => r.version > 1);
    if (forksOnly.length > 0) {
      localStorage.setItem(
        'freshdiy_forked_recipes_v1',
        JSON.stringify(forksOnly)
      );
    }
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cabinet, JSON.stringify(cabinet));
  }, [cabinet]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(weeklyPlan));
  }, [weeklyPlan]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.feedback, JSON.stringify(feedbackList));
  }, [feedbackList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.extras, JSON.stringify(extras));
  }, [extras]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(ratingsMap));
  }, [ratingsMap]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.isDairyFree, String(isDairyFree));
  }, [isDairyFree]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.defaultServings, String(defaultServings));
  }, [defaultServings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.valleriaPhone, valleriaPhone);
  }, [valleriaPhone]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.valleriaEmail, valleriaEmail);
  }, [valleriaEmail]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.familyMember, activeFamilyMember);
  }, [activeFamilyMember]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeWeek, activeWeekStartDate);
  }, [activeWeekStartDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.checkedGroceryKeys, JSON.stringify(checkedGroceryKeys));
  }, [checkedGroceryKeys]);

  // Helper to persist a CabinetItem to Supabase with graceful fallback if new columns aren't migrated yet
  const persistCabinetItemToSupabase = async (item: CabinetItem) => {
    if (!supaStatus.tablesReady) return;
    const fullPayload: any = {
      item_name: item.item_name,
      category: item.category,
      status: item.status,
      usage_count: item.usage_count || 0,
      freezer_qty: item.freezer_qty ?? 0,
      fridge_qty: item.fridge_qty ?? 0,
      pantry_qty: item.pantry_qty ?? 0,
      unit: item.unit || 'item',
    };
    if (currentUser?.household?.id) fullPayload.household_id = currentUser.household.id;
    if (currentUser?.id) fullPayload.user_id = currentUser.id;

    try {
      const { error } = await supabase
        .from('cabinet')
        .upsert(fullPayload, { onConflict: 'household_id,item_name' });
      if (error) {
        // Fallback if migration_sync_repair.sql hasn't been executed yet
        const legacyPayload: any = {
          item_name: item.item_name,
          category: item.category,
          status: item.status,
          usage_count: item.usage_count || 0,
        };
        if (currentUser?.household?.id) legacyPayload.household_id = currentUser.household.id;
        await supabase.from('cabinet').upsert(legacyPayload, { onConflict: 'item_name' });
      }
    } catch (err) {
      console.warn('Persist cabinet item error:', err);
    }
  };

  // Handlers
  const handleNavigateWeek = (offset: number) => {
    setActiveWeekStartDate((prev) => getAdjacentWeek(prev, offset));
  };

  const handleToggleGroceryKey = async (key: string) => {
    const nextVal = !checkedGroceryKeys[key];
    setCheckedGroceryKeys((prev) => ({
      ...prev,
      [key]: nextVal,
    }));

    if (supaStatus.tablesReady && currentUser?.household?.id) {
      try {
        await supabase.from('grocery_checks').upsert({
          household_id: currentUser.household.id,
          week_start_date: activeWeekStartDate,
          item_key: key,
          checked: nextVal,
          checked_by_name: currentUser.display_name,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Could not sync grocery checkmark:', err);
      }
    }
  };

  const handleAddToPlan = async (
    recipeId: string,
    day: DayOfWeek,
    servings: ServingsSize
  ) => {
    const newItem: WeeklyPlanItem = {
      id: generateUuid(),
      week_start_date: activeWeekStartDate,
      recipe_id: recipeId,
      day_of_week: day,
      servings,
      status: 'planned',
    };

    setWeeklyPlan((prev) => {
      const filtered = prev.filter(
        (p) => !(p.day_of_week === day && (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate)
      );
      return [...filtered, newItem];
    });

    if (supaStatus.tablesReady) {
      const payload: any = {
        id: newItem.id,
        week_start_date: activeWeekStartDate,
        recipe_id: recipeId,
        day_of_week: day,
        servings,
        status: 'planned',
      };
      if (currentUser?.household?.id) payload.household_id = currentUser.household.id;
      if (currentUser?.id) payload.user_id = currentUser.id;

      try {
        const { error } = await supabase.from('weekly_plan').upsert(payload);
        if (error && error.message.includes('household_id')) {
          delete payload.household_id;
          await supabase.from('weekly_plan').upsert(payload);
        }
      } catch (err) {
        console.warn('Upsert plan error:', err);
      }
    }
  };

  const handleMovePlanDay = async (planId: string, newDay: DayOfWeek) => {
    const targetPlan = weeklyPlan.find((p) => p.id === planId);
    if (!targetPlan || targetPlan.day_of_week === newDay) return;

    setWeeklyPlan((prev) => {
      const existingOnTargetDay = prev.find(
        (p) =>
          p.id !== planId &&
          p.day_of_week === newDay &&
          (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate
      );
      return prev.map((p) => {
        if (p.id === planId) {
          return { ...p, day_of_week: newDay };
        }
        if (existingOnTargetDay && p.id === existingOnTargetDay.id) {
          return { ...p, day_of_week: targetPlan.day_of_week };
        }
        return p;
      });
    });

    if (supaStatus.tablesReady) {
      await supabase
        .from('weekly_plan')
        .update({ day_of_week: newDay })
        .eq('id', planId);
    }
    showToast(`📅 Moved dinner to ${newDay}!`);
  };

  const handleFillMyWeek = async () => {
    const currentWeekMeals = weeklyPlan.filter(
      (p) => (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate
    );
    const usedDays = new Set(currentWeekMeals.map((p) => p.day_of_week));
    const usedRecipeIds = new Set(currentWeekMeals.map((p) => p.recipe_id));

    const preferredDays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const openDays = preferredDays.filter((d) => !usedDays.has(d)).slice(0, Math.max(0, 4 - currentWeekMeals.length) || 3);

    if (openDays.length === 0) {
      showToast('Your week is already full!');
      return;
    }

    const ranked = rankRecipesByOnHandIngredients(
      recipes,
      onHandFridgeItems,
      cabinet,
      defaultServings,
      isDairyFree
    ).filter((r) => {
      if (usedRecipeIds.has(r.recipe.id)) return false;
      const ratingEntry = ratingsMap[r.recipe.original_id || r.recipe.id] || ratingsMap[r.recipe.id];
      return ratingEntry?.rating !== -1;
    });

    const chosen: Recipe[] = [];
    for (const candidate of ranked) {
      if (chosen.length >= openDays.length) break;
      chosen.push(candidate.recipe);
    }

    for (let i = 0; i < chosen.length; i++) {
      await handleAddToPlan(chosen[i].id, openDays[i], defaultServings);
    }

    showToast(
      `✨ Added ${chosen.length} high-match dinners to your week (${openDays.slice(0, chosen.length).map((d) => d.slice(0, 3)).join(', ')})!`
    );
  };

  const handleUpdatePlanServings = async (planId: string, servings: ServingsSize) => {
    setWeeklyPlan((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, servings } : p))
    );
    if (supaStatus.tablesReady) {
      await supabase.from('weekly_plan').update({ servings }).eq('id', planId);
    }
  };

  const handleRemoveFromPlan = async (planId: string) => {
    setWeeklyPlan((prev) => prev.filter((p) => p.id !== planId));
    if (supaStatus.tablesReady) {
      await supabase.from('weekly_plan').delete().eq('id', planId);
    }
  };

  const handleCompleteWeeklyPlan = async () => {
    const currentWeekMeals = weeklyPlan.filter(
      (p) => (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate
    );
    const plannedMeals = currentWeekMeals.filter((p) => p.status !== 'completed');
    const mealsToDeduct = plannedMeals.length > 0 ? plannedMeals : currentWeekMeals;

    const { updatedCabinet, deductedNames } = deductCabinetForCompletedMeals(
      mealsToDeduct,
      recipes,
      cabinet
    );

    setCabinet(updatedCabinet);
    setWeeklyPlan((prev) =>
      prev.map((p) =>
        (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate
          ? {
              ...p,
              status: 'completed',
              completed_at: new Date().toISOString(),
            }
          : p
      )
    );

    if (supaStatus.tablesReady) {
      for (const cab of updatedCabinet) {
        await persistCabinetItemToSupabase(cab);
      }
    }

    if (deductedNames.length > 0) {
      showToast(
        `🎉 Weekly Plan Completed! Auto-deducted ${deductedNames.length} inventory items: ${deductedNames.slice(0, 3).join(', ')}${
          deductedNames.length > 3 ? '...' : ''
        }`
      );
    } else {
      showToast('🎉 Weekly Plan marked Completed!');
    }
  };

  const handleUpdateCabinetStatus = async (id: string, status: StockStatus) => {
    const target = cabinet.find((c) => c.id === id);
    if (!target) return;
    const qty = getItemQuantities(target);
    let nextFreezer = qty.freezer;
    let nextFridge = qty.fridge;
    let nextPantry = qty.pantry;

    if (status === 'out_of_stock') {
      nextFreezer = 0;
      nextFridge = 0;
      nextPantry = 0;
    } else if (status === 'in_stock' && qty.total === 0) {
      if (target.category === 'Freezer & Deep Freeze') nextFreezer = 1;
      else if (target.category === 'Refrigerator') nextFridge = 1;
      else nextPantry = 1;
    }

    const updatedItem: CabinetItem = {
      ...target,
      status,
      freezer_qty: nextFreezer,
      fridge_qty: nextFridge,
      pantry_qty: nextPantry,
      usage_count: status === 'in_stock' ? 0 : target.usage_count,
      updated_at: new Date().toISOString(),
    };

    setCabinet((prev) => prev.map((c) => (c.id === id ? updatedItem : c)));
    await persistCabinetItemToSupabase(updatedItem);
  };

  const handleUpdateCabinetItem = async (updatedItem: CabinetItem) => {
    setCabinet((prev) => prev.map((c) => (c.id === updatedItem.id ? updatedItem : c)));
    await persistCabinetItemToSupabase(updatedItem);
  };

  // 1-Tap "Move 1 to Fridge (Thaw)" on the unified inventory card
  const handleThawToFridge = async (id: string) => {
    const target = cabinet.find((c) => c.id === id);
    if (!target) return;

    const current = getItemQuantities(target);
    if (current.freezer <= 0) {
      showToast(`No ${target.item_name} packages left in Deep Freezer to thaw.`);
      return;
    }

    const nextFreezer = current.freezer - 1;
    const nextFridge = current.fridge + 1;
    const nextPantry = current.pantry;
    const nextStatus = deriveStockStatusFromQuantities(
      nextFreezer,
      nextFridge,
      nextPantry,
      target.status
    );

    const updatedItem: CabinetItem = {
      ...target,
      freezer_qty: nextFreezer,
      fridge_qty: nextFridge,
      pantry_qty: nextPantry,
      unit: current.unit,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    setCabinet((prev) => prev.map((c) => (c.id === id ? updatedItem : c)));
    await persistCabinetItemToSupabase(updatedItem);

    showToast(
      `❄️➔🥛 Moved 1 ${current.unit} of "${target.item_name}" to Refrigerator! (${nextFreezer} in Freezer, ${nextFridge} in Fridge)`
    );
  };

  const handleAddCabinetItem = async (
    name: string,
    category: CabinetItem['category'],
    status: StockStatus,
    quantities?: {
      freezer_qty?: number;
      fridge_qty?: number;
      pantry_qty?: number;
      unit?: string;
    }
  ) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const addFreezer =
      quantities?.freezer_qty !== undefined
        ? quantities.freezer_qty
        : category === 'Freezer & Deep Freeze' && status !== 'out_of_stock'
        ? 1
        : 0;
    const addFridge =
      quantities?.fridge_qty !== undefined
        ? quantities.fridge_qty
        : category === 'Refrigerator' && status !== 'out_of_stock'
        ? 1
        : 0;
    const addPantry =
      quantities?.pantry_qty !== undefined
        ? quantities.pantry_qty
        : category !== 'Freezer & Deep Freeze' &&
          category !== 'Refrigerator' &&
          status !== 'out_of_stock'
        ? 1
        : 0;
    const unit =
      quantities?.unit ||
      (category === 'Freezer & Deep Freeze' ? 'pkg' : 'item');

    let finalItemToPersist: CabinetItem | null = null;

    setCabinet((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.item_name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (existingIdx !== -1) {
        const existing = prev[existingIdx];
        const curQty = getItemQuantities(existing);
        const mergedFreezer = curQty.freezer + addFreezer;
        const mergedFridge = curQty.fridge + addFridge;
        const mergedPantry = curQty.pantry + addPantry;
        const mergedStatus = deriveStockStatusFromQuantities(
          mergedFreezer,
          mergedFridge,
          mergedPantry,
          'in_stock'
        );

        const mergedItem: CabinetItem = {
          ...existing,
          freezer_qty: mergedFreezer,
          fridge_qty: mergedFridge,
          pantry_qty: mergedPantry,
          unit: quantities?.unit || existing.unit || curQty.unit,
          status: mergedStatus,
          usage_count: 0,
          updated_at: new Date().toISOString(),
        };
        finalItemToPersist = mergedItem;
        return prev.map((c, i) => (i === existingIdx ? mergedItem : c));
      }

      const newItem: CabinetItem = {
        id: generateUuid(),
        item_name: cleanName,
        category,
        status,
        usage_count: 0,
        freezer_qty: addFreezer,
        fridge_qty: addFridge,
        pantry_qty: addPantry,
        unit,
        updated_at: new Date().toISOString(),
      };
      finalItemToPersist = newItem;
      return [newItem, ...prev];
    });

    if (finalItemToPersist) {
      await persistCabinetItemToSupabase(finalItemToPersist);
    }
  };

  const handleRestockAllLowAndOut = async () => {
    setCabinet((prev) =>
      prev.map((c) => {
        const q = getItemQuantities(c);
        if (q.total === 0) {
          return {
            ...c,
            status: 'in_stock',
            usage_count: 0,
            freezer_qty: c.category === 'Freezer & Deep Freeze' ? 1 : 0,
            fridge_qty: c.category === 'Refrigerator' ? 1 : 0,
            pantry_qty:
              c.category !== 'Freezer & Deep Freeze' &&
              c.category !== 'Refrigerator'
                ? 1
                : 0,
          };
        }
        return { ...c, status: 'in_stock', usage_count: 0 };
      })
    );
    if (supaStatus.tablesReady) {
      await supabase
        .from('cabinet')
        .update({ status: 'in_stock', usage_count: 0 })
        .neq('status', 'in_stock');
    }
    showToast('✅ All inventory items restocked to In-Stock!');
  };

  const handleDeleteCabinetItem = async (id: string) => {
    const itemToDelete = cabinet.find((c) => c.id === id);
    setCabinet((prev) => prev.filter((c) => c.id !== id));
    if (supaStatus.tablesReady && itemToDelete) {
      try {
        await supabase.from('cabinet').delete().eq('id', id);
        await supabase.from('cabinet').delete().eq('item_name', itemToDelete.item_name);
      } catch (err) {
        console.warn('Delete cabinet item error:', err);
      }
    }
    showToast(`Removed "${itemToDelete?.item_name || 'Item'}" from inventory`);
  };

  const handleClearAllCabinetItems = async () => {
    setCabinet([]);
    if (supaStatus.tablesReady && currentUser?.household?.id) {
      try {
        await supabase.from('cabinet').delete().eq('household_id', currentUser.household.id);
      } catch (err) {
        console.warn('Clear cabinet error:', err);
      }
    }
    showToast('Cleared inventory! You now have a clean slate for your kitchen.');
  };

  // Favorites & Ratings Handlers
  const handleToggleFavorite = async (recipeKey: string) => {
    const existing = ratingsMap[recipeKey];
    const nextFav = !existing?.is_favorite;
    const updated: RecipeRating = {
      id: existing?.id || generateUuid(),
      household_id: currentUser?.household?.id || 'local',
      recipe_id: recipeKey,
      rating: existing?.rating || 0,
      is_favorite: nextFav,
      times_cooked: existing?.times_cooked || 0,
      last_cooked_at: existing?.last_cooked_at || null,
    };

    setRatingsMap((prev) => ({ ...prev, [recipeKey]: updated }));

    if (supaStatus.tablesReady && currentUser?.household?.id) {
      try {
        await supabase.from('recipe_ratings').upsert(
          {
            household_id: currentUser.household.id,
            recipe_id: recipeKey,
            rating: updated.rating,
            is_favorite: updated.is_favorite,
            times_cooked: updated.times_cooked,
            last_cooked_at: updated.last_cooked_at,
          },
          { onConflict: 'household_id,recipe_id' }
        );
      } catch (err) {
        console.warn('Could not sync favorite:', err);
      }
    }

    showToast(nextFav ? '❤️ Added to Family Favorites!' : 'Removed from Favorites');
  };

  const handleMarkRecipeCooked = async (recipe: Recipe, rating: -1 | 0 | 1 = 1) => {
    const recipeKey = recipe.original_id || recipe.id;
    const existing = ratingsMap[recipeKey];
    const updatedRating: RecipeRating = {
      id: existing?.id || generateUuid(),
      household_id: currentUser?.household?.id || 'local',
      recipe_id: recipeKey,
      rating: rating !== 0 ? rating : existing?.rating || 0,
      is_favorite: rating === 1 ? true : existing?.is_favorite || false,
      times_cooked: (existing?.times_cooked || 0) + 1,
      last_cooked_at: new Date().toISOString(),
    };

    setRatingsMap((prev) => ({ ...prev, [recipeKey]: updatedRating }));

    // Deduct used ingredients from Fridge -> Deep Freezer -> Pantry
    const syntheticPlanItem: WeeklyPlanItem = {
      id: generateUuid(),
      week_start_date: activeWeekStartDate,
      recipe_id: recipe.id,
      day_of_week: 'Monday',
      servings: cookingServings,
      status: 'completed',
    };

    const { updatedCabinet, deductedNames } = deductCabinetForCompletedMeals(
      [syntheticPlanItem],
      recipes,
      cabinet
    );
    setCabinet(updatedCabinet);

    // Mark matching planned meal in active week as completed
    setWeeklyPlan((prev) =>
      prev.map((p) =>
        p.recipe_id === recipe.id &&
        (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate
          ? { ...p, status: 'completed', completed_at: new Date().toISOString() }
          : p
      )
    );

    if (supaStatus.tablesReady) {
      for (const cab of updatedCabinet) {
        await persistCabinetItemToSupabase(cab);
      }
      if (currentUser?.household?.id) {
        await supabase.from('recipe_ratings').upsert(
          {
            household_id: currentUser.household.id,
            recipe_id: recipeKey,
            rating: updatedRating.rating,
            is_favorite: updatedRating.is_favorite,
            times_cooked: updatedRating.times_cooked,
            last_cooked_at: updatedRating.last_cooked_at,
          },
          { onConflict: 'household_id,recipe_id' }
        );
      }
    }

    if (deductedNames.length > 0) {
      showToast(
        `🍽️ Marked "${recipe.title}" cooked! Deducted: ${deductedNames.slice(0, 3).join(', ')}`
      );
    } else {
      showToast(`🍽️ Marked "${recipe.title}" cooked!`);
    }
  };

  const handleSubmitFeedbackAndFork = async (
    baseRecipe: Recipe,
    authorName: string,
    notes: string,
    overrideApiKey?: string
  ) => {
    let forkedResult: { newRecipe: Recipe; changeSummary: string[] };
    const keyToUse = overrideApiKey || geminiApiKey;

    if (keyToUse && keyToUse.trim()) {
      try {
        forkedResult = await forkRecipeWithGemini(baseRecipe, notes, authorName, keyToUse);
      } catch (err) {
        console.warn('Gemini LLM fork failed, falling back to rule engine:', err);
        forkedResult = forkRecipeFromFeedback(baseRecipe, notes, authorName);
      }
    } else {
      forkedResult = forkRecipeFromFeedback(baseRecipe, notes, authorName);
    }

    const { newRecipe, changeSummary } = forkedResult;

    const feedbackEntry: RecipeFeedback = {
      id: generateUuid(),
      recipe_id: baseRecipe.id,
      author_name: authorName,
      notes,
      status: 'applied',
      forked_recipe_id: newRecipe.id,
      created_at: new Date().toISOString(),
    };

    const rootOriginalId = baseRecipe.original_id || baseRecipe.id;

    setRecipes((prev) => {
      const updated = prev.map((r) =>
        (r.original_id || r.id) === rootOriginalId
          ? { ...r, is_latest: false }
          : r
      );
      return [newRecipe, ...updated];
    });

    setWeeklyPlan((prev) =>
      prev.map((p) =>
        p.recipe_id === baseRecipe.id ? { ...p, recipe_id: newRecipe.id } : p
      )
    );

    setFeedbackList((prev) => [feedbackEntry, ...prev]);
    setCookingRecipeId(newRecipe.id);

    if (supaStatus.tablesReady) {
      await supabase.from('recipes').insert(newRecipe);
      await supabase.from('recipe_feedback').insert({
        id: feedbackEntry.id,
        recipe_id: baseRecipe.id,
        author_name: authorName,
        notes,
        status: 'applied',
        forked_recipe_id: newRecipe.id,
      });
    }

    showToast(
      `✨ Published ${newRecipe.title} (v${newRecipe.version}): ${changeSummary.join(
        ', '
      )}`
    );
  };

  const handleSyncSupabase = async () => {
    setIsSyncing(true);
    const res = await syncAllToSupabase({
      recipes,
      cabinet,
      weeklyPlan,
      feedback: feedbackList,
      extras,
      householdId: currentUser?.household?.id || null,
      userId: currentUser?.id || null,
    });
    const status = await checkSupabaseTablesReady();
    setSupaStatus(status);
    setIsSyncing(false);
    showToast(res.message);
  };

  const activeCookingRecipe = useMemo(() => {
    if (cookingRecipeId) {
      const found = recipes.find((r) => r.id === cookingRecipeId);
      if (found) return found;
    }
    return recipes.find((r) => r.is_latest) || recipes[0] || null;
  }, [recipes, cookingRecipeId]);

  const activeCookingRecipeVersions = useMemo(() => {
    if (!activeCookingRecipe) return [];
    const origId = activeCookingRecipe.original_id || activeCookingRecipe.id;
    return recipes
      .filter((r) => (r.original_id || r.id) === origId)
      .sort((a, b) => b.version - a.version);
  }, [recipes, activeCookingRecipe]);

  const activeRecipeFeedback = useMemo(() => {
    if (!activeCookingRecipe) return [];
    const versionIds = new Set(activeCookingRecipeVersions.map((v) => v.id));
    return feedbackList.filter((f) => versionIds.has(f.recipe_id));
  }, [feedbackList, activeCookingRecipe, activeCookingRecipeVersions]);

  const outOrLowCabinetCount = useMemo(
    () => cabinet.filter((c) => c.status !== 'in_stock').length,
    [cabinet]
  );

  // Merge user's manual Fridge checklist items with any in-stock Freezer or Fridge items from Kitchen Inventory
  const effectiveOnHandFridgeItems = useMemo(() => {
    const freezerAndFridgeFromInventory = cabinet
      .filter((c) => {
        if (c.status === 'out_of_stock') return false;
        const q = getItemQuantities(c);
        return (
          q.freezer > 0 ||
          q.fridge > 0 ||
          c.category === 'Freezer & Deep Freeze' ||
          c.category === 'Refrigerator'
        );
      })
      .map((c) => c.item_name);

    return Array.from(
      new Set([...onHandFridgeItems, ...freezerAndFridgeFromInventory])
    );
  }, [onHandFridgeItems, cabinet]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-950/60 mb-3 animate-pulse border border-emerald-400/30">
          <ChefHat className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white tracking-tight">
          Fresh<span className="text-emerald-400">DIY</span>
        </h2>
        <p className="text-xs font-semibold text-slate-400 mt-1">Verifying Family Kitchen Session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        onAuthenticated={(profile) => {
          setCurrentUser(profile);
          showToast(`👋 Welcome, ${profile.display_name}!`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-20 md:pb-0">
      {/* Top Global Header (Compact on Mobile, Full on Desktop) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveTab('catalog')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                  Fresh<span className="text-emerald-600">DIY</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFamilyModalOpen(true);
                  }}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition cursor-pointer"
                  title="Manage Family Kitchen & Household Invite Code"
                >
                  <Home className="w-3 h-3 text-emerald-600" />
                  <span>{currentUser.household?.name || 'Our Family Kitchen'}</span>
                  <span>•</span>
                  <span>{currentUser.display_name}</span>
                </button>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-1">
                {recipes.filter((r) => r.is_latest).length.toLocaleString()} HelloFresh Recipes • Dairy-Free • AI Kitchen
              </p>
            </div>
          </div>

          {/* Desktop Primary Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Planner ({recipes.filter((r) => r.is_latest).length})
            </button>

            <button
              onClick={() => setActiveTab('cabinet')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'cabinet'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              Kitchen Inventory
              {outOrLowCabinetCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                  {outOrLowCabinetCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('grocery')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'grocery'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Smart Grocery ({weeklyPlan.filter((p) => p.week_start_date === activeWeekStartDate).length})
            </button>

            <button
              onClick={() => setActiveTab('cooking')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'cooking'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Cook &amp; AI Fork
            </button>
          </nav>

          {/* Right Quick Actions (Mobile + Desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() =>
                setPhotoScannerState({
                  open: true,
                  mode: activeTab === 'cabinet' ? 'cabinet' : 'fridge',
                })
              }
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              title="Take a photo of your spice cabinet, fridge, or deep freezer to auto-import"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scan</span>
            </button>

            <button
              onClick={() => setIsDairyFree(!isDairyFree)}
              className={`inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                isDairyFree
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
              title="Toggles Dynamic Dairy Substitution Engine"
            >
              <Leaf className="w-3.5 h-3.5" />
              <span>DF: {isDairyFree ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={handleSyncSupabase}
              disabled={isSyncing}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                supaStatus.tablesReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5" />
              )}
              {supaStatus.tablesReady ? 'Cloud Live' : 'Sync'}
            </button>

            {/* Family & Account Settings Button */}
            <button
              onClick={() => setIsFamilyModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 transition cursor-pointer"
              title="Family Settings & Share Invite Link"
            >
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Family</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 pt-3 w-full">
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-bold flex items-center justify-between shadow-lg">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6">
        {activeTab === 'catalog' && (
          <CatalogPlannerView
            recipes={recipes}
            cabinet={cabinet}
            weeklyPlan={weeklyPlan}
            defaultServings={defaultServings}
            isDairyFree={isDairyFree}
            activeWeekStartDate={activeWeekStartDate}
            onNavigateWeek={handleNavigateWeek}
            onHandFridgeItems={effectiveOnHandFridgeItems}
            onToggleFridgeItem={(item) => {
              setOnHandFridgeItems((prev) => {
                const exists = prev.some(
                  (i) => i.toLowerCase() === item.toLowerCase()
                );
                const next = exists
                  ? prev.filter((i) => i.toLowerCase() !== item.toLowerCase())
                  : [...prev, item];
                localStorage.setItem(
                  STORAGE_KEYS.fridgeItems,
                  JSON.stringify(next)
                );
                return next;
              });
            }}
            onClearFridgeItems={() => {
              setOnHandFridgeItems([]);
              localStorage.setItem(
                STORAGE_KEYS.fridgeItems,
                JSON.stringify([])
              );
            }}
            onSetDefaultServings={(s) => {
              setDefaultServings(s);
              setWeeklyPlan((prev) => prev.map((p) => ({ ...p, servings: s })));
            }}
            onAddToPlan={handleAddToPlan}
            onUpdatePlanServings={handleUpdatePlanServings}
            onMovePlanDay={handleMovePlanDay}
            onRemoveFromPlan={handleRemoveFromPlan}
            onFillMyWeek={handleFillMyWeek}
            onCompleteWeeklyPlan={handleCompleteWeeklyPlan}
            ratingsMap={ratingsMap}
            onToggleFavorite={handleToggleFavorite}
            onOpenCookingView={(recipe, serv) => {
              setCookingRecipeId(recipe.id);
              setCookingServings(serv);
              setActiveTab('cooking');
            }}
            onOpenBlendModal={(blendName) => setActiveBlendModal(blendName)}
            onOpenPhotoScanner={(mode) =>
              setPhotoScannerState({ open: true, mode })
            }
          />
        )}

        {activeTab === 'cabinet' && (
          <CabinetView
            cabinet={cabinet}
            onUpdateStatus={handleUpdateCabinetStatus}
            onUpdateItem={handleUpdateCabinetItem}
            onThawToFridge={handleThawToFridge}
            onDeleteItem={handleDeleteCabinetItem}
            onClearAllItems={handleClearAllCabinetItems}
            onAddCabinetItem={handleAddCabinetItem}
            onRestockAllLowAndOut={handleRestockAllLowAndOut}
            onAddExtraToGrocery={async (itemName, aisle) => {
              const newEx: GroceryExtra = {
                id: generateUuid(),
                week_start_date: activeWeekStartDate,
                item_name: itemName,
                aisle,
                checked: false,
              };
              setExtras((prev) => [...prev, newEx]);
              if (supaStatus.tablesReady) {
                const payload: any = {
                  id: newEx.id,
                  week_start_date: activeWeekStartDate,
                  item_name: itemName,
                  aisle,
                  checked: false,
                };
                if (currentUser?.household?.id) payload.household_id = currentUser.household.id;
                if (currentUser?.id) payload.user_id = currentUser.id;
                await supabase.from('grocery_extras').insert(payload);
              }
              showToast(`🛒 Added "${itemName}" to Grocery List!`);
            }}
            onOpenPhotoScanner={(mode) =>
              setPhotoScannerState({ open: true, mode: mode || 'cabinet' })
            }
            onOpenBlendModal={(blendName) => setActiveBlendModal(blendName)}
          />
        )}

        {activeTab === 'grocery' && (
          <GroceryView
            weeklyPlan={weeklyPlan}
            recipes={recipes}
            cabinet={cabinet}
            extras={extras}
            isDairyFree={isDairyFree}
            defaultServings={defaultServings}
            activeWeekStartDate={activeWeekStartDate}
            onNavigateWeek={handleNavigateWeek}
            activeFamilyMember={activeFamilyMember}
            onChangeFamilyMember={setActiveFamilyMember}
            valleriaEmail={valleriaEmail}
            onSetValleriaEmail={setValleriaEmail}
            valleriaPhone={valleriaPhone}
            onSetValleriaPhone={setValleriaPhone}
            checkedGroceryKeys={checkedGroceryKeys}
            onToggleGroceryKey={handleToggleGroceryKey}
            hellofreshPrice={hellofreshPrice}
            onAddExtra={async (itemName, aisle, isRecurring = false) => {
              const newEx: GroceryExtra = {
                id: generateUuid(),
                week_start_date: activeWeekStartDate,
                item_name: itemName,
                aisle,
                checked: false,
                is_recurring: isRecurring,
              };
              setExtras((prev) => [...prev, newEx]);
              if (supaStatus.tablesReady) {
                const payload: any = {
                  id: newEx.id,
                  week_start_date: activeWeekStartDate,
                  item_name: itemName,
                  aisle,
                  checked: false,
                  is_recurring: isRecurring,
                };
                if (currentUser?.household?.id) payload.household_id = currentUser.household.id;
                if (currentUser?.id) payload.user_id = currentUser.id;
                const { error } = await supabase.from('grocery_extras').insert(payload);
                if (error) {
                  delete payload.is_recurring;
                  await supabase.from('grocery_extras').insert(payload);
                }
              }
            }}
            onToggleExtra={async (id) => {
              const target = extras.find((e) => e.id === id);
              if (!target) return;
              const nextChecked = !target.checked;
              setExtras((prev) =>
                prev.map((e) =>
                  e.id === id ? { ...e, checked: nextChecked } : e
                )
              );
              if (supaStatus.tablesReady) {
                await supabase
                  .from('grocery_extras')
                  .update({ checked: nextChecked })
                  .eq('id', id);
              }
            }}
            onToggleExtraRecurring={async (id) => {
              const target = extras.find((e) => e.id === id);
              if (!target) return;
              const nextRec = !target.is_recurring;
              setExtras((prev) =>
                prev.map((e) =>
                  e.id === id ? { ...e, is_recurring: nextRec } : e
                )
              );
              if (supaStatus.tablesReady) {
                await supabase
                  .from('grocery_extras')
                  .update({ is_recurring: nextRec })
                  .eq('id', id);
              }
              showToast(
                nextRec
                  ? `📌 Pinned "${target.item_name}" as a recurring weekly staple!`
                  : `Unpinned "${target.item_name}" from weekly staples.`
              );
            }}
            onDeleteExtra={async (id) => {
              setExtras((prev) => prev.filter((e) => e.id !== id));
              if (supaStatus.tablesReady) {
                await supabase.from('grocery_extras').delete().eq('id', id);
              }
            }}
            onMarkItemInInventory={async (itemName, aisle, qty, unit) => {
              const cat: CabinetItem['category'] =
                aisle === 'Meat & Seafood'
                  ? 'Freezer & Deep Freeze'
                  : aisle === 'Produce' ||
                    aisle === 'Dairy Alternatives' ||
                    aisle === 'Dairy & Eggs'
                  ? 'Refrigerator'
                  : 'Spices';
              await handleAddCabinetItem(itemName, cat, 'in_stock', {
                freezer_qty: cat === 'Freezer & Deep Freeze' ? (qty ?? 1) : 0,
                fridge_qty: cat === 'Refrigerator' ? (qty ?? 1) : 0,
                pantry_qty: cat !== 'Freezer & Deep Freeze' && cat !== 'Refrigerator' ? (qty ?? 1) : 0,
                unit: unit || (cat === 'Freezer & Deep Freeze' ? 'pkg' : 'item'),
              });
              showToast(
                `✅ Added "${itemName}" to Kitchen Inventory (${cat})!`
              );
            }}
            onAddToPlan={handleAddToPlan}
            onRemoveFromPlan={handleRemoveFromPlan}
            onUpdatePlanServings={handleUpdatePlanServings}
            onOpenBlendModal={(blendName) => setActiveBlendModal(blendName)}
          />
        )}

        {activeTab === 'cooking' && activeCookingRecipe && (
          <CookingView
            recipe={activeCookingRecipe}
            allVersions={activeCookingRecipeVersions}
            servings={cookingServings}
            isDairyFree={isDairyFree}
            geminiApiKey={geminiApiKey}
            feedbackHistory={activeRecipeFeedback}
            recipeRating={
              ratingsMap[activeCookingRecipe.original_id || activeCookingRecipe.id] ||
              ratingsMap[activeCookingRecipe.id]
            }
            onToggleFavorite={handleToggleFavorite}
            onMarkRecipeCooked={handleMarkRecipeCooked}
            onChangeServings={setCookingServings}
            onSelectVersion={(ver) => setCookingRecipeId(ver.id)}
            onSubmitFeedbackAndFork={handleSubmitFeedbackAndFork}
            onAddRecipeToGroceryList={(rec, serv) => {
              const weekMeals = weeklyPlan.filter(
                (p) => (p.week_start_date || getMondayOfWeek()) === activeWeekStartDate
              );
              const usedDays = new Set(weekMeals.map((p) => p.day_of_week));
              const availableDay =
                DAYS_OF_WEEK.find((d) => !usedDays.has(d)) || 'Sunday';
              handleAddToPlan(rec.id, availableDay, serv);
              showToast(
                `🛒 Added ${rec.title} (${serv} servings) to your Grocery List (${availableDay})!`
              );
            }}
            onOpenBlendModal={(blendName) => setActiveBlendModal(blendName)}
            onBackToCatalog={() => setActiveTab('catalog')}
          />
        )}
      </main>

      {/* NATIVE-STYLE MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 grid grid-cols-5 items-center shadow-2xl">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'catalog'
              ? 'text-emerald-600 font-black'
              : 'text-slate-500 font-semibold'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Planner</span>
        </button>

        <button
          onClick={() => setActiveTab('cabinet')}
          className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'cabinet'
              ? 'text-emerald-600 font-black'
              : 'text-slate-500 font-semibold'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Inventory</span>
          {outOrLowCabinetCount > 0 && (
            <span className="absolute top-0.5 right-3 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
              {outOrLowCabinetCount}
            </span>
          )}
        </button>

        {/* Center Camera Scan Floating Action Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={() =>
              setPhotoScannerState({
                open: true,
                mode: activeTab === 'cabinet' ? 'cabinet' : 'fridge',
              })
            }
            className="w-12 h-12 -mt-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex flex-col items-center justify-center cursor-pointer active:scale-95"
          >
            <Camera className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase">Scan</span>
          </button>
        </div>

        <button
          onClick={() => setActiveTab('grocery')}
          className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'grocery'
              ? 'text-emerald-600 font-black'
              : 'text-slate-500 font-semibold'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Grocery</span>
          {weeklyPlan.filter((p) => p.week_start_date === activeWeekStartDate).length > 0 && (
            <span className="absolute top-0.5 right-3 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
              {weeklyPlan.filter((p) => p.week_start_date === activeWeekStartDate).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cooking')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
            activeTab === 'cooking'
              ? 'text-emerald-600 font-black'
              : 'text-slate-500 font-semibold'
          }`}
        >
          <ChefHat className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Cook</span>
        </button>
      </nav>

      {/* Clickable DIY Blend & Sauce Modal */}
      <BlendRecipeModal
        blendName={activeBlendModal}
        cabinet={cabinet}
        onClose={() => setActiveBlendModal(null)}
        onAddExtraToGrocery={async (itemName, aisle) => {
          const newEx: GroceryExtra = {
            id: generateUuid(),
            week_start_date: activeWeekStartDate,
            item_name: itemName,
            aisle,
            checked: false,
          };
          setExtras((prev) => [...prev, newEx]);
          if (supaStatus.tablesReady) {
            const payload: any = {
              id: newEx.id,
              week_start_date: activeWeekStartDate,
              item_name: itemName,
              aisle,
              checked: false,
            };
            if (currentUser?.household?.id) payload.household_id = currentUser.household.id;
            if (currentUser?.id) payload.user_id = currentUser.id;
            await supabase.from('grocery_extras').insert(payload);
          }
          showToast(`🛒 Added ${itemName} to your Grocery List!`);
        }}
      />

      {/* AI Camera Photo Scanner Modal (Spice Cabinet + Fridge + Deep Freezer) */}
      <PhotoScannerModal
        isOpen={photoScannerState.open}
        initialMode={photoScannerState.mode}
        geminiApiKey={geminiApiKey}
        onOpenFamilySettings={() => setIsFamilyModalOpen(true)}
        onClose={() =>
          setPhotoScannerState((prev) => ({ ...prev, open: false }))
        }
        onImportToCabinet={(items) => {
          items.forEach((item) =>
            handleAddCabinetItem(item.name, item.category, 'in_stock')
          );
          showToast(
            `📸 Auto-imported ${items.length} items into your Household Inventory!`
          );
          setActiveTab('cabinet');
        }}
        onImportToFridge={(items) => {
          items.forEach((name) =>
            handleAddCabinetItem(name, 'Refrigerator', 'in_stock', {
              fridge_qty: 1,
              freezer_qty: 0,
              pantry_qty: 0,
              unit: 'item',
            })
          );
          setOnHandFridgeItems((prev) => {
            const merged = Array.from(new Set([...prev, ...items]));
            localStorage.setItem(
              STORAGE_KEYS.fridgeItems,
              JSON.stringify(merged)
            );
            return merged;
          });
          showToast(
            `📸 Added ${items.length} scanned Fridge items to your Inventory & Recipe Matcher!`
          );
          setActiveTab('catalog');
        }}
      />

      {/* Family Settings & Account Modal */}
      <FamilySettingsModal
        isOpen={isFamilyModalOpen}
        onClose={() => setIsFamilyModalOpen(false)}
        currentUser={currentUser}
        geminiApiKey={geminiApiKey}
        onUpdateGeminiApiKey={(k) => {
          setGeminiApiKey(k);
          localStorage.setItem('freshdiy_gemini_api_key_v1', k);
        }}
        hellofreshPrice={hellofreshPrice}
        onUpdateHellofreshPrice={(p) => {
          setHellofreshPrice(p);
          localStorage.setItem('freshdiy_hf_price_v1', String(p));
        }}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
        onSignOut={() => {
          setCurrentUser(null);
          showToast('Signed out of FreshDIY.');
        }}
      />
    </div>
  );
};
