import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  ChefHat,
  Database,
  Leaf,
  Package,
  RefreshCw,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { BlendRecipeModal } from './components/BlendRecipeModal';
import { CabinetView } from './components/CabinetView';
import { CatalogPlannerView } from './components/CatalogPlannerView';
import { CookingView } from './components/CookingView';
import { GroceryView } from './components/GroceryView';
import { PhotoScannerModal } from './components/PhotoScannerModal';
import {
  checkSupabaseTablesReady,
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
  ServingsSize,
  StockStatus,
  WeeklyPlanItem,
} from './types/freshdiy';
import { forkRecipeFromFeedback } from './utils/aiVersioningEngine';
import { DEFAULT_CABINET_ITEMS } from './utils/blendDecoder';
import { deductCabinetForCompletedMeals } from './utils/groceryEngine';

type ActiveTab = 'catalog' | 'cabinet' | 'grocery' | 'cooking';

const STORAGE_KEYS = {
  recipes: 'freshdiy_recipes_v2',
  cabinet: 'freshdiy_cabinet_v1',
  plan: 'freshdiy_weekly_plan_v2',
  feedback: 'freshdiy_feedback_v1',
  extras: 'freshdiy_extras_v1',
  isDairyFree: 'freshdiy_is_dairy_free_v1',
  defaultServings: 'freshdiy_default_servings_v1',
  valleriaPhone: 'freshdiy_valleria_phone_v1',
  fridgeItems: 'freshdiy_fridge_items_v1',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');

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
    return saved ? JSON.parse(saved) : DEFAULT_CABINET_ITEMS;
  });
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.plan);
    return saved ? JSON.parse(saved) : [];
  });
  const [feedbackList, setFeedbackList] = useState<RecipeFeedback[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.feedback);
    return saved ? JSON.parse(saved) : [];
  });
  const [extras, setExtras] = useState<GroceryExtra[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.extras);
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'extra-1',
            week_start_date: '2026-10-19',
            item_name: 'Kids Organic Apple Sauce Pouches',
            aisle: 'Household & Extras',
            checked: false,
          },
          {
            id: 'extra-2',
            week_start_date: '2026-10-19',
            item_name: 'Barista Oat Milk (for Coffee)',
            aisle: 'Dairy Alternatives',
            checked: false,
          },
        ];
  });

  // Active recipe in Cooking View & Modals
  const [cookingRecipeId, setCookingRecipeId] = useState<string | null>(null);
  const [cookingServings, setCookingServings] = useState<ServingsSize>(4);
  const [activeBlendModal, setActiveBlendModal] = useState<string | null>(null);
  const [photoScannerState, setPhotoScannerState] = useState<{
    open: boolean;
    mode: 'cabinet' | 'fridge';
  }>({ open: false, mode: 'cabinet' });

  // Notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadInitialData() {
      const status = await checkSupabaseTablesReady();
      setSupaStatus(status);

      if (status.tablesReady) {
        const [
          { data: remoteRecipes },
          { data: remoteCabinet },
          { data: remotePlan },
          { data: remoteFeedback },
          { data: remoteExtras },
        ] = await Promise.all([
          supabase
            .from('recipes')
            .select('*')
            .order('version', { ascending: false }),
          supabase
            .from('cabinet')
            .select('*')
            .order('item_name', { ascending: true }),
          supabase.from('weekly_plan').select('*'),
          supabase
            .from('recipe_feedback')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('grocery_extras')
            .select('*')
            .order('created_at', { ascending: true }),
        ]);

        if (remoteCabinet && remoteCabinet.length > 0) {
          setCabinet(remoteCabinet as CabinetItem[]);
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
        if (remoteRecipes && remoteRecipes.length > 0) {
          setRecipes(remoteRecipes as Recipe[]);
          localStorage.setItem(
            STORAGE_KEYS.recipes,
            JSON.stringify(remoteRecipes)
          );
          return;
        }
      }

      const cached = localStorage.getItem(STORAGE_KEYS.recipes);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Recipe[];
          if (parsed.length > 0) {
            setRecipes(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }

      try {
        const res = await fetch('/data/hellofresh_recipes.json');
        const scraped: Recipe[] = await res.json();
        setRecipes(scraped);
        localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(scraped));

        const existingPlan = localStorage.getItem(STORAGE_KEYS.plan);
        if (!existingPlan && scraped.length >= 3) {
          const starterPlan: WeeklyPlanItem[] = [
            {
              id: 'plan-mon',
              week_start_date: '2026-10-19',
              recipe_id: scraped[0].id,
              day_of_week: 'Monday',
              servings: 4,
              status: 'planned',
            },
            {
              id: 'plan-wed',
              week_start_date: '2026-10-19',
              recipe_id: scraped[1].id,
              day_of_week: 'Wednesday',
              servings: 4,
              status: 'planned',
            },
            {
              id: 'plan-fri',
              week_start_date: '2026-10-19',
              recipe_id: scraped[2].id,
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
  }, []);

  useEffect(() => {
    if (recipes.length > 0) {
      localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(recipes));
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
    localStorage.setItem(STORAGE_KEYS.isDairyFree, String(isDairyFree));
  }, [isDairyFree]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.defaultServings, String(defaultServings));
  }, [defaultServings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.valleriaPhone, valleriaPhone);
  }, [valleriaPhone]);

  // Handlers
  const handleAddToPlan = async (
    recipeId: string,
    day: DayOfWeek,
    servings: ServingsSize
  ) => {
    const newItem: WeeklyPlanItem = {
      id: `plan-${day.toLowerCase()}-${Date.now()}`,
      week_start_date: '2026-10-19',
      recipe_id: recipeId,
      day_of_week: day,
      servings,
      status: 'planned',
    };

    setWeeklyPlan((prev) => {
      const filtered = prev.filter((p) => p.day_of_week !== day);
      return [...filtered, newItem];
    });

    if (supaStatus.tablesReady) {
      await supabase.from('weekly_plan').upsert({
        recipe_id: recipeId,
        day_of_week: day,
        servings,
        status: 'planned',
      });
    }
  };

  const handleUpdatePlanServings = (planId: string, servings: ServingsSize) => {
    setWeeklyPlan((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, servings } : p))
    );
  };

  const handleRemoveFromPlan = (planId: string) => {
    setWeeklyPlan((prev) => prev.filter((p) => p.id !== planId));
  };

  const handleCompleteWeeklyPlan = async () => {
    const plannedMeals = weeklyPlan.filter((p) => p.status !== 'completed');
    const mealsToDeduct = plannedMeals.length > 0 ? plannedMeals : weeklyPlan;

    const { updatedCabinet, deductedNames } = deductCabinetForCompletedMeals(
      mealsToDeduct,
      recipes,
      cabinet
    );

    setCabinet(updatedCabinet);
    setWeeklyPlan((prev) =>
      prev.map((p) => ({
        ...p,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }))
    );

    if (supaStatus.tablesReady) {
      for (const cab of updatedCabinet) {
        await supabase
          .from('cabinet')
          .update({ status: cab.status, usage_count: cab.usage_count })
          .eq('item_name', cab.item_name);
      }
    }

    if (deductedNames.length > 0) {
      showToast(
        `🎉 Weekly Plan Completed! Auto-deducted ${deductedNames.length} cabinet items: ${deductedNames.slice(0, 4).join(', ')}${
          deductedNames.length > 4 ? '...' : ''
        }`
      );
    } else {
      showToast('🎉 Weekly Plan marked Completed!');
    }
  };

  const handleUpdateCabinetStatus = async (id: string, status: StockStatus) => {
    const target = cabinet.find((c) => c.id === id);
    setCabinet((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              usage_count: status === 'in_stock' ? 0 : c.usage_count,
            }
          : c
      )
    );
    if (supaStatus.tablesReady && target) {
      await supabase
        .from('cabinet')
        .update({
          status,
          usage_count: status === 'in_stock' ? 0 : target.usage_count,
        })
        .eq('item_name', target.item_name);
    }
  };

  const handleAddCabinetItem = async (
    name: string,
    category: CabinetItem['category'],
    status: StockStatus
  ) => {
    const newItem: CabinetItem = {
      id: `cab-${Date.now()}-${Math.random()}`,
      item_name: name,
      category,
      status,
      usage_count: 0,
    };
    setCabinet((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.item_name.toLowerCase() === name.toLowerCase()
      );
      if (existingIdx !== -1) {
        return prev.map((c, i) =>
          i === existingIdx ? { ...c, status: 'in_stock', usage_count: 0 } : c
        );
      }
      return [newItem, ...prev];
    });
    if (supaStatus.tablesReady) {
      await supabase.from('cabinet').upsert(
        {
          item_name: name,
          category,
          status,
          usage_count: 0,
        },
        { onConflict: 'item_name' }
      );
    }
  };

  const handleRestockAllLowAndOut = async () => {
    setCabinet((prev) =>
      prev.map((c) => ({ ...c, status: 'in_stock', usage_count: 0 }))
    );
    if (supaStatus.tablesReady) {
      await supabase
        .from('cabinet')
        .update({ status: 'in_stock', usage_count: 0 })
        .neq('status', 'in_stock');
    }
    showToast('✅ All Spice & Pantry Cabinet items restocked to In-Stock!');
  };

  const handleSubmitFeedbackAndFork = async (
    baseRecipe: Recipe,
    authorName: string,
    notes: string
  ) => {
    const { newRecipe, changeSummary } = forkRecipeFromFeedback(
      baseRecipe,
      notes,
      authorName
    );

    const feedbackEntry: RecipeFeedback = {
      id: `fb-${Date.now()}`,
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
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800">
                  Family of 4 • Valleria &amp; You
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-1">
                526 HelloFresh Recipes • Dairy-Free • AI Kitchen
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
              Spice Cabinet
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
              Smart Grocery ({weeklyPlan.length})
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
              title="Take a photo of your spice cabinet or fridge to auto-import"
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
            onHandFridgeItems={onHandFridgeItems}
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
            onRemoveFromPlan={handleRemoveFromPlan}
            onCompleteWeeklyPlan={handleCompleteWeeklyPlan}
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
            onAddCabinetItem={handleAddCabinetItem}
            onRestockAllLowAndOut={handleRestockAllLowAndOut}
            onAddExtraToGrocery={async (itemName, aisle) => {
              const newEx: GroceryExtra = {
                id: `extra-${Date.now()}-${Math.random()}`,
                week_start_date: '2026-10-19',
                item_name: itemName,
                aisle,
                checked: false,
              };
              setExtras((prev) => [...prev, newEx]);
              if (supaStatus.tablesReady) {
                await supabase.from('grocery_extras').insert({
                  item_name: itemName,
                  aisle,
                  checked: false,
                });
              }
              showToast(`🛒 Added "${itemName}" to Valleria's Grocery List!`);
            }}
            onOpenPhotoScanner={() =>
              setPhotoScannerState({ open: true, mode: 'cabinet' })
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
            valleriaPhone={valleriaPhone}
            onSetValleriaPhone={setValleriaPhone}
            onAddExtra={async (itemName, aisle) => {
              const newEx: GroceryExtra = {
                id: `extra-${Date.now()}`,
                week_start_date: '2026-10-19',
                item_name: itemName,
                aisle,
                checked: false,
              };
              setExtras((prev) => [...prev, newEx]);
              if (supaStatus.tablesReady) {
                await supabase.from('grocery_extras').insert({
                  item_name: itemName,
                  aisle,
                  checked: false,
                });
              }
            }}
            onToggleExtra={(id) =>
              setExtras((prev) =>
                prev.map((e) =>
                  e.id === id ? { ...e, checked: !e.checked } : e
                )
              )
            }
            onDeleteExtra={(id) =>
              setExtras((prev) => prev.filter((e) => e.id !== id))
            }
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
            feedbackHistory={activeRecipeFeedback}
            onChangeServings={setCookingServings}
            onSelectVersion={(ver) => setCookingRecipeId(ver.id)}
            onSubmitFeedbackAndFork={handleSubmitFeedbackAndFork}
            onAddRecipeToGroceryList={(rec, serv) => {
              const usedDays = new Set(weeklyPlan.map((p) => p.day_of_week));
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
          <span className="text-[10px] mt-0.5">Cabinet</span>
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
          {weeklyPlan.length > 0 && (
            <span className="absolute top-0.5 right-3 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">
              {weeklyPlan.length}
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
        onAddExtraToGrocery={(itemName, aisle) => {
          setExtras((prev) => [
            ...prev,
            {
              id: `extra-${Date.now()}-${Math.random()}`,
              week_start_date: '2026-10-19',
              item_name: itemName,
              aisle,
              checked: false,
            },
          ]);
          showToast(`🛒 Added ${itemName} to your Grocery List!`);
        }}
      />

      {/* AI Camera Photo Scanner Modal (Spice Cabinet + Fridge) */}
      <PhotoScannerModal
        isOpen={photoScannerState.open}
        initialMode={photoScannerState.mode}
        onClose={() =>
          setPhotoScannerState((prev) => ({ ...prev, open: false }))
        }
        onImportToCabinet={(items) => {
          items.forEach((item) =>
            handleAddCabinetItem(item.name, item.category, 'in_stock')
          );
          showToast(
            `📸 Auto-imported ${items.length} spices/sauces into your Cabinet as In-Stock!`
          );
          setActiveTab('cabinet');
        }}
        onImportToFridge={(items) => {
          setOnHandFridgeItems((prev) => {
            const merged = Array.from(new Set([...prev, ...items]));
            localStorage.setItem(
              STORAGE_KEYS.fridgeItems,
              JSON.stringify(merged)
            );
            return merged;
          });
          showToast(
            `📸 Added ${items.length} scanned ingredients to your Fridge Matcher!`
          );
          setActiveTab('catalog');
        }}
      />
    </div>
  );
};
