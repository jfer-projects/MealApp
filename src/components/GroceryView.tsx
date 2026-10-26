import React, { useMemo, useState } from 'react';
import {
  Beaker,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  DollarSign,
  Footprints,
  Heart,
  Mail,
  MapPin,
  Package,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  User,
  Utensils,
  X,
} from 'lucide-react';
import {
  CabinetItem,
  DayOfWeek,
  DAYS_OF_WEEK,
  GroceryExtra,
  Recipe,
  ServingsSize,
  WeeklyPlanItem,
} from '../types/freshdiy';
import { findBlendDefinition } from '../utils/blendDecoder';
import { formatAmount, formatIngredientDisplay } from '../utils/dairyEngine';
import { formatWeekRange } from '../utils/dateUtils';
import {
  AggregatedGroceryItem,
  buildAggregatedGroceryList,
  formatGroceryListForValleria,
  ParsedNoteGroceryItem,
  parsePastedShoppingList,
  sortAisles,
} from '../utils/groceryEngine';
import {
  computeWeeklySavings,
  estimateRecipeNutrition,
} from '../utils/nutritionCostEngine';
import {
  getItemStoreLocation,
  STOP_AND_SHOP_AMERICAN_LEGION,
  StoreLayout,
  SUPPORTED_STORES,
} from '../utils/storeLayouts';

const AISLE_OPTIONS = [
  'Produce',
  'Meat & Seafood',
  'Dairy Alternatives',
  'Dairy & Eggs',
  'Grains & Bakery',
  'Spices & Pantry',
  'Household & Extras',
];

interface GroceryViewProps {
  weeklyPlan: WeeklyPlanItem[];
  recipes: Recipe[];
  cabinet: CabinetItem[];
  extras: GroceryExtra[];
  isDairyFree: boolean;
  defaultServings: ServingsSize;
  activeWeekStartDate: string;
  onNavigateWeek: (offset: number) => void;
  activeFamilyMember: string;
  onChangeFamilyMember: (member: string) => void;
  currentUserDisplayName?: string;
  householdMembers?: string[];
  valleriaEmail: string;
  onSetValleriaEmail: (email: string) => void;
  valleriaPhone: string;
  onSetValleriaPhone: (phone: string) => void;
  checkedGroceryKeys: Record<string, boolean>;
  onToggleGroceryKey: (key: string) => void;
  hellofreshPrice?: number;
  onAddExtra: (itemName: string, aisle: string, isRecurring?: boolean) => void;
  onToggleExtra: (id: string) => void;
  onToggleExtraRecurring?: (id: string) => void;
  onDeleteExtra: (id: string) => void;
  onMarkItemInInventory?: (itemName: string, aisle: string, qty?: number, unit?: string) => void;
  onAddToPlan: (recipeId: string, day: DayOfWeek, servings: ServingsSize) => void;
  onRemoveFromPlan: (planId: string) => void;
  onUpdatePlanServings: (planId: string, servings: ServingsSize) => void;
  onOpenBlendModal: (blendName: string) => void;
}

const QUICK_FAMILY_STAPLES: { name: string; aisle: string }[] = [
  { name: 'Unsweetened Oat Milk (1 Carton)', aisle: 'Dairy Alternatives' },
  { name: 'Pasture-Raised Eggs (1 Dozen)', aisle: 'Dairy & Eggs' },
  { name: 'Sourdough Bread Loaf', aisle: 'Grains & Bakery' },
  { name: 'Bananas (1 Bunch)', aisle: 'Produce' },
  { name: 'Honeycrisp Apples (6 ct)', aisle: 'Produce' },
  { name: 'Fresh Strawberries & Blueberries', aisle: 'Produce' },
  { name: 'Avocados (4 ct)', aisle: 'Produce' },
  { name: 'Kids Apple Sauce Pouches', aisle: 'Household & Extras' },
  { name: 'Kids School Lunch Snacks', aisle: 'Household & Extras' },
  { name: 'Extra Virgin Olive Oil', aisle: 'Spices & Pantry' },
  { name: 'Coffee Beans / Cold Brew', aisle: 'Household & Extras' },
  { name: 'Paper Towels & Dish Soap', aisle: 'Household & Extras' },
];

export const GroceryView: React.FC<GroceryViewProps> = ({
  weeklyPlan,
  recipes,
  cabinet,
  extras,
  isDairyFree,
  defaultServings,
  activeWeekStartDate,
  onNavigateWeek,
  activeFamilyMember,
  onChangeFamilyMember,
  currentUserDisplayName = 'Me',
  householdMembers = [],
  valleriaEmail,
  onSetValleriaEmail,
  valleriaPhone,
  onSetValleriaPhone,
  checkedGroceryKeys,
  onToggleGroceryKey,
  hellofreshPrice = 11.49,
  onAddExtra,
  onToggleExtra,
  onToggleExtraRecurring,
  onDeleteExtra,
  onMarkItemInInventory,
  onAddToPlan,
  onRemoveFromPlan,
  onUpdatePlanServings,
  onOpenBlendModal,
}) => {
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraQty, setNewExtraQty] = useState('');
  const [newExtraAisle, setNewExtraAisle] = useState('Household & Extras');
  const [newExtraRecurring, setNewExtraRecurring] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showSmsPreview, setShowSmsPreview] = useState(false);

  // Paste Shopping List from Shared Note Modal State
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isGrocerySettingsOpen, setIsGrocerySettingsOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [parsedNoteItems, setParsedNoteItems] = useState<ParsedNoteGroceryItem[]>([]);

  const handlePasteTextChange = (text: string) => {
    setPastedText(text);
    setParsedNoteItems(parsePastedShoppingList(text));
  };

  const handleReadFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        handlePasteTextChange(clipText);
      }
    } catch {
      // User can still Ctrl+V / long-press Paste inside the textarea
    }
  };

  const handleImportParsedToGrocery = () => {
    if (parsedNoteItems.length === 0) return;
    for (const item of parsedNoteItems) {
      onAddExtra(item.itemName, item.aisle, item.isRecurring);
    }
    setShareFeedback(
      `📋 Imported ${parsedNoteItems.length} item${
        parsedNoteItems.length === 1 ? '' : 's'
      } from your note into this week's Grocery List!`
    );
    setTimeout(() => setShareFeedback(null), 4000);
    setPastedText('');
    setParsedNoteItems([]);
    setIsPasteModalOpen(false);
  };

  const handleImportParsedToInventory = () => {
    if (parsedNoteItems.length === 0 || !onMarkItemInInventory) return;
    for (const item of parsedNoteItems) {
      onMarkItemInInventory(item.itemName, item.aisle);
    }
    setShareFeedback(
      `📋 Added ${parsedNoteItems.length} item${
        parsedNoteItems.length === 1 ? '' : 's'
      } from your note directly into Kitchen Inventory!`
    );
    setTimeout(() => setShareFeedback(null), 4000);
    setPastedText('');
    setParsedNoteItems([]);
    setIsPasteModalOpen(false);
  };

  // Preference for moving checked-off items to Kitchen Inventory: 'ask' | 'always' | 'never'
  const [checkoffMovePref, setCheckoffMovePref] = useState<'ask' | 'always' | 'never'>(() => {
    const saved = localStorage.getItem('freshdiy_checkoff_move_pref_v1');
    return saved === 'always' || saved === 'never' ? saved : 'ask';
  });

  // Store Layout & Path Optimization State (Stop & Shop Roslindale / American Legion Hwy)
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    return (
      localStorage.getItem('freshdiy_selected_store_id_v1') ||
      STOP_AND_SHOP_AMERICAN_LEGION.id
    );
  });
  const [viewMode, setViewMode] = useState<'walking_path' | 'standard_aisles'>(() => {
    const saved = localStorage.getItem('freshdiy_grocery_view_mode_v1');
    return saved === 'standard_aisles' ? 'standard_aisles' : 'walking_path';
  });

  const selectedStore = useMemo(() => {
    return (
      SUPPORTED_STORES.find((s) => s.id === selectedStoreId) ||
      STOP_AND_SHOP_AMERICAN_LEGION
    );
  }, [selectedStoreId]);

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    localStorage.setItem('freshdiy_selected_store_id_v1', storeId);
  };

  const handleSelectViewMode = (mode: 'walking_path' | 'standard_aisles') => {
    setViewMode(mode);
    localStorage.setItem('freshdiy_grocery_view_mode_v1', mode);
  };

  const [promptItem, setPromptItem] = useState<{
    name: string;
    aisle: string;
    qty?: number;
    unit?: string;
  } | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleCheckRecipeItem = (item: {
    key: string;
    name: string;
    aisle: string;
    totalAmount: number;
    unit: string;
  }) => {
    const isCurrentlyChecked = Boolean(checkedGroceryKeys[item.key]);
    onToggleGroceryKey(item.key);

    // If item was unchecked and is now being checked off in the store:
    if (!isCurrentlyChecked && onMarkItemInInventory) {
      const qty = Math.ceil(item.totalAmount) || 1;
      if (checkoffMovePref === 'always') {
        onMarkItemInInventory(item.name, item.aisle, qty, item.unit);
      } else if (checkoffMovePref === 'ask') {
        setPromptItem({
          name: item.name,
          aisle: item.aisle,
          qty,
          unit: item.unit,
        });
        setRememberChoice(false);
      }
    }
  };

  const handleCheckExtraItem = (ex: GroceryExtra) => {
    const isCurrentlyChecked = ex.checked;
    onToggleExtra(ex.id);

    // If item was unchecked and is now being checked off in the store:
    if (!isCurrentlyChecked && onMarkItemInInventory) {
      if (checkoffMovePref === 'always') {
        onMarkItemInInventory(ex.item_name, ex.aisle || 'Household & Extras', 1, 'item');
      } else if (checkoffMovePref === 'ask') {
        setPromptItem({
          name: ex.item_name,
          aisle: ex.aisle || 'Household & Extras',
          qty: 1,
          unit: 'item',
        });
        setRememberChoice(false);
      }
    }
  };

  const handleConfirmMovePrompt = (shouldMove: boolean) => {
    if (promptItem && shouldMove && onMarkItemInInventory) {
      onMarkItemInInventory(
        promptItem.name,
        promptItem.aisle,
        promptItem.qty,
        promptItem.unit
      );
    }
    if (rememberChoice) {
      const nextPref = shouldMove ? 'always' : 'never';
      setCheckoffMovePref(nextPref);
      localStorage.setItem('freshdiy_checkoff_move_pref_v1', nextPref);
      setShareFeedback(
        nextPref === 'always'
          ? '⚙️ Remembered: Checked-off items will now automatically move to Kitchen Inventory!'
          : '⚙️ Remembered: Items will just check off without moving to Kitchen Inventory.'
      );
      setTimeout(() => setShareFeedback(null), 4000);
    }
    setPromptItem(null);
    setRememberChoice(false);
  };

  // Filter weekly plan items for the active week
  const currentWeekPlan = useMemo(
    () => weeklyPlan.filter((p) => p.week_start_date === activeWeekStartDate),
    [weeklyPlan, activeWeekStartDate]
  );

  // Include both this week's extras AND recurring weekly staples
  const currentWeekExtras = useMemo(
    () =>
      extras.filter(
        (e) => e.week_start_date === activeWeekStartDate || e.is_recurring
      ),
    [extras, activeWeekStartDate]
  );

  const aggregated = useMemo(
    () =>
      buildAggregatedGroceryList(currentWeekPlan, recipes, cabinet, isDairyFree),
    [currentWeekPlan, recipes, cabinet, isDairyFree]
  );

  // Group BOTH recipe ingredients AND manual/pasted extras by aisle
  const combinedAisles = useMemo(() => {
    const aisleSet = new Set<string>();
    const recipeMap = new Map<string, typeof aggregated>();
    const extraMap = new Map<string, GroceryExtra[]>();

    for (const item of aggregated) {
      aisleSet.add(item.aisle);
      const list = recipeMap.get(item.aisle) || [];
      list.push(item);
      recipeMap.set(item.aisle, list);
    }

    for (const ex of currentWeekExtras) {
      const targetAisle = ex.aisle || 'Household & Extras';
      aisleSet.add(targetAisle);
      const list = extraMap.get(targetAisle) || [];
      list.push(ex);
      extraMap.set(targetAisle, list);
    }

    return Array.from(aisleSet)
      .sort(sortAisles)
      .map((aisle) => ({
        aisle,
        recipeItems: recipeMap.get(aisle) || [],
        extraItems: extraMap.get(aisle) || [],
      }));
  }, [aggregated, currentWeekExtras]);

  // Group BOTH recipe ingredients AND manual/pasted extras by Stop & Shop Walking Step
  const walkingSteps = useMemo(() => {
    return selectedStore.departments
      .map((dept) => {
        const recipeItems = aggregated.filter((item) => {
          const loc = getItemStoreLocation(item.name, selectedStore, item.aisle);
          return loc.departmentId === dept.id;
        });
        const extraItems = currentWeekExtras.filter((ex) => {
          const loc = getItemStoreLocation(ex.item_name, selectedStore, ex.aisle);
          return loc.departmentId === dept.id;
        });
        const totalItems = recipeItems.length + extraItems.length;

        let completedItems = 0;
        for (const item of recipeItems) {
          if (checkedGroceryKeys[item.key] || item.isStruckByCabinet) {
            completedItems++;
          }
        }
        for (const ex of extraItems) {
          if (ex.checked) {
            completedItems++;
          }
        }

        return {
          dept,
          recipeItems,
          extraItems,
          totalItems,
          completedItems,
          isFullyCompleted: totalItems > 0 && completedItems === totalItems,
        };
      })
      .filter((step) => step.totalItems > 0)
      .sort((a, b) => a.dept.sortOrder - b.dept.sortOrder);
  }, [aggregated, currentWeekExtras, selectedStore, checkedGroceryKeys]);

  const tripStats = useMemo(() => {
    let totalItems = 0;
    let collectedItems = 0;
    let completedDepts = 0;
    for (const step of walkingSteps) {
      totalItems += step.totalItems;
      collectedItems += step.completedItems;
      if (step.isFullyCompleted) {
        completedDepts++;
      }
    }
    const percentage = totalItems > 0 ? Math.round((collectedItems / totalItems) * 100) : 0;
    return {
      totalItems,
      collectedItems,
      completedDepts,
      totalDepts: walkingSteps.length,
      percentage,
    };
  }, [walkingSteps]);

  const smsText = useMemo(
    () =>
      formatGroceryListForValleria(
        aggregated,
        currentWeekExtras,
        isDairyFree,
        false,
        viewMode === 'walking_path' ? selectedStore : undefined
      ),
    [aggregated, currentWeekExtras, isDairyFree, viewMode, selectedStore]
  );

  // Cost and Nutrition Aggregations
  const savings = useMemo(
    () => computeWeeklySavings(currentWeekPlan, recipes, hellofreshPrice),
    [currentWeekPlan, recipes, hellofreshPrice]
  );

  const averageNutrition = useMemo(() => {
    if (currentWeekPlan.length === 0) return null;
    let totalCals = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let count = 0;

    for (const p of currentWeekPlan) {
      const r = recipes.find((rec) => rec.id === p.recipe_id);
      if (r) {
        const nut = estimateRecipeNutrition(r);
        totalCals += nut.calories;
        totalProtein += nut.proteinGrams;
        totalCarbs += nut.carbsGrams;
        totalFat += nut.fatGrams;
        totalFiber += nut.fiberGrams;
        count += 1;
      }
    }

    if (count === 0) return null;
    return {
      calories: Math.round(totalCals / count),
      proteinGrams: Math.round(totalProtein / count),
      carbsGrams: Math.round(totalCarbs / count),
      fatGrams: Math.round(totalFat / count),
      fiberGrams: Math.round(totalFiber / count),
    };
  }, [currentWeekPlan, recipes]);

  const matchingRecipesForPicker = useMemo(() => {
    if (!recipeSearch.trim()) return [];
    const q = recipeSearch.toLowerCase();
    return recipes
      .filter((r) => r.is_latest && r.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [recipes, recipeSearch]);

  const handleSendToValleria = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `FreshDIY Grocery List (${formatWeekRange(activeWeekStartDate)})`,
          text: smsText,
        });
        setShareFeedback('Shared via Native Share Sheet!');
        setTimeout(() => setShareFeedback(null), 3500);
        return;
      } catch {
        // Fallback
      }
    }

    await navigator.clipboard.writeText(smsText);
    if (valleriaPhone.trim()) {
      const cleanPhone = valleriaPhone.replace(/[^\d+]/g, '');
      window.open(
        `sms:${cleanPhone}?&body=${encodeURIComponent(smsText)}`,
        '_blank'
      );
      setShareFeedback(`Opened SMS for Family Member (${valleriaPhone}) & copied list!`);
    } else {
      setShowSmsPreview(true);
      setShareFeedback('Copied formatted Grocery List to clipboard!');
    }
    setTimeout(() => setShareFeedback(null), 4000);
  };

  const handleEmailToValleria = () => {
    const subject = encodeURIComponent(
      `🛒 FreshDIY Grocery List — ${formatWeekRange(activeWeekStartDate)}`
    );
    const body = encodeURIComponent(smsText);
    const to = valleriaEmail.trim() ? encodeURIComponent(valleriaEmail.trim()) : '';
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    setShareFeedback('Opened email client for Family Member!');
    setTimeout(() => setShareFeedback(null), 3500);
  };

  const handleAddExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtraName.trim()) return;
    const label = newExtraQty.trim()
      ? `${newExtraQty.trim()} — ${newExtraName.trim()}`
      : newExtraName.trim();
    onAddExtra(label, newExtraAisle, newExtraRecurring);
    setNewExtraName('');
    setNewExtraQty('');
    setNewExtraRecurring(false);
  };

  const handleQuickAddRecipeToGrocery = (recipeId: string) => {
    const usedDays = new Set(currentWeekPlan.map((p) => p.day_of_week));
    const availableDay =
      DAYS_OF_WEEK.find((d) => !usedDays.has(d)) || 'Sunday';
    onAddToPlan(recipeId, availableDay, defaultServings);
    setRecipeSearch('');
  };

  const activeBuyCount = aggregated.filter((i) => !i.isStruckByCabinet).length;
  const cabinetSavedCount = aggregated.filter((i) => i.isStruckByCabinet).length;
  const dairyAltCount = aggregated.filter((i) => i.isSubstitutedDairy).length;

  const renderExtraCard = (ex: GroceryExtra) => {
    const loc = getItemStoreLocation(ex.item_name, selectedStore, ex.aisle);
    return (
      <div
        key={ex.id}
        onClick={() => handleCheckExtraItem(ex)}
        className={`p-3 rounded-2xl border transition cursor-pointer flex items-start justify-between gap-3 ${
          ex.checked
            ? 'bg-slate-50 border-slate-200/70 opacity-60'
            : 'bg-emerald-50/30 border-emerald-200 hover:bg-emerald-50/60'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center ${
              ex.checked
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-300 bg-white'
            }`}
          >
            {ex.checked && <Check className="w-3 h-3" />}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-sm font-bold ${
                  ex.checked ? 'line-through text-slate-400' : 'text-slate-900'
                }`}
              >
                {ex.item_name}
              </span>

              {/* Stop & Shop Exact Location Badge */}
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-150 inline-flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5 text-indigo-500" />
                {loc.aisleNumber ? `Aisle ${loc.aisleNumber}` : loc.locationLabel}
              </span>

              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-slate-100 text-slate-600">
                {ex.is_recurring ? '📌 Weekly Staple' : 'Added / Note'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onMarkItemInInventory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkItemInInventory(ex.item_name, ex.aisle || 'Household & Extras', 1, 'item');
              }}
              className="px-2 py-1 rounded-xl bg-white hover:bg-emerald-100 border border-slate-200 text-slate-600 hover:text-emerald-900 text-[10px] font-extrabold transition cursor-pointer"
              title="Add to Kitchen Inventory"
            >
              ✓ In Stock
            </button>
          )}
          {onToggleExtraRecurring && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExtraRecurring(ex.id);
              }}
              className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border transition cursor-pointer ${
                ex.is_recurring
                  ? 'bg-amber-200 border-amber-300 text-amber-950'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-amber-800'
              }`}
              title={
                ex.is_recurring
                  ? 'Pinned as Weekly Staple (appears every week)'
                  : 'Pin as recurring Weekly Staple'
              }
            >
              📌
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteExtra(ex.id);
            }}
            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
            title="Remove item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderRecipeCard = (item: AggregatedGroceryItem) => {
    const isChecked = Boolean(checkedGroceryKeys[item.key]);
    const isCrossed = item.isStruckByCabinet || isChecked;
    const matchedBlend = findBlendDefinition(
      item.blendBreakdown?.blendName || item.name
    );
    const loc = getItemStoreLocation(item.name, selectedStore, item.aisle);

    return (
      <div
        key={item.key}
        onClick={() => handleCheckRecipeItem(item)}
        className={`p-3 rounded-2xl border transition cursor-pointer flex items-start justify-between gap-3 ${
          isCrossed
            ? 'bg-slate-50 border-slate-200/70 opacity-60'
            : item.isSubstitutedDairy
            ? 'bg-teal-50/40 border-teal-200 hover:bg-teal-50'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={`mt-0.5 w-4 h-4 rounded-md flex items-center justify-center ${
              isCrossed
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-300 bg-white'
            }`}
          >
            {isCrossed && <Check className="w-3 h-3" />}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-sm font-bold ${
                  isCrossed ? 'line-through text-slate-400' : 'text-slate-900'
                }`}
              >
                {formatIngredientDisplay(item.totalAmount, item.unit, item.name)}
              </span>

              {/* Stop & Shop Exact Location Badge */}
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-150 inline-flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5 text-indigo-500" />
                {loc.aisleNumber ? `Aisle ${loc.aisleNumber}` : loc.locationLabel}
              </span>

              {item.isSubstitutedDairy && (
                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-teal-100 text-teal-800">
                  {item.substitutionNote}
                </span>
              )}

              {item.isStruckByCabinet && (
                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800">
                  In Cabinet
                </span>
              )}

              {matchedBlend && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBlendModal(matchedBlend.name);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black border border-amber-300 cursor-pointer"
                >
                  <Beaker className="w-3 h-3" /> Make {matchedBlend.name}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              For: {item.fromRecipes.join(', ')}
            </p>
          </div>
        </div>

        {!item.isStruckByCabinet && onMarkItemInInventory && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkItemInInventory(
                item.name,
                item.aisle,
                Math.ceil(item.totalAmount) || 1,
                item.unit
              );
            }}
            className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-900 text-[10px] font-extrabold shrink-0 transition cursor-pointer"
            title="Already have this in your Fridge/Freezer/Pantry? Mark it in-stock in Kitchen Inventory!"
          >
            ✓ Have It
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* 1. COMPACT TOP BAR: WEEK PICKER + SHARE + SETTINGS SHEET BUTTON */}
      <section className="bg-white rounded-2xl border border-slate-200 p-2.5 sm:p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Week Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onNavigateWeek(-1)}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="px-2 py-0.5 text-center">
              <span className="text-xs font-extrabold text-slate-900 flex items-center justify-center gap-1 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {formatWeekRange(activeWeekStartDate)}
              </span>
            </div>
            <button
              onClick={() => onNavigateWeek(1)}
              className="p-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Actions: Share + Options Sheet Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsGrocerySettingsOpen(!isGrocerySettingsOpen)}
              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isGrocerySettingsOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="Shopping As, On Check, Paste List, Email List & Store Route Settings"
            >
              <span>Options</span>
            </button>

            <button
              onClick={handleSendToValleria}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Collapsible Settings Sheet (Shopping As, On Check, Paste, Email, View Mode) */}
        {isGrocerySettingsOpen && (
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> Shopping As:
                </span>
                {(() => {
                  const shopperOptions = Array.from(
                    new Set(
                      [currentUserDisplayName, ...householdMembers]
                        .map((n) => n.trim())
                        .filter(Boolean)
                    )
                  );
                  if (shopperOptions.length < 2) {
                    shopperOptions.push('Partner / Family');
                  }
                  return shopperOptions.map((memberName) => {
                    const isSelected =
                      activeFamilyMember === memberName ||
                      (activeFamilyMember === 'Parent' && memberName === shopperOptions[0]) ||
                      (activeFamilyMember === 'Valleria' && memberName === shopperOptions[1]);
                    return (
                      <button
                        key={memberName}
                        onClick={() => onChangeFamilyMember(memberName)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {memberName === currentUserDisplayName ? `${memberName} (You)` : memberName}
                      </button>
                    );
                  });
                })()}
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                  <Package className="w-3 h-3 text-emerald-600" /> On Check:
                </span>
                <select
                  value={checkoffMovePref}
                  onChange={(e) => {
                    const val = e.target.value as 'ask' | 'always' | 'never';
                    setCheckoffMovePref(val);
                    localStorage.setItem('freshdiy_checkoff_move_pref_v1', val);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <option value="ask">Ask to Move to Inventory</option>
                  <option value="always">Always Move to Inventory</option>
                  <option value="never">Never Move</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsGrocerySettingsOpen(false);
                  setIsPasteModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-extrabold border border-amber-300 transition cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-amber-800" />
                <span>Paste List from Notes</span>
              </button>

              <button
                onClick={handleEmailToValleria}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-emerald-600" />
                <span>Email List</span>
              </button>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSelectViewMode('walking_path')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition cursor-pointer ${
                    viewMode === 'walking_path'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>Store Route</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectViewMode('standard_aisles')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition cursor-pointer ${
                    viewMode === 'standard_aisles'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Aisles</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {shareFeedback && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm">
          <span>{shareFeedback}</span>
        </div>
      )}

      {showSmsPreview && (
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Live Share / Email Payload for Family
            </span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(smsText);
                setShareFeedback('Copied formatted text payload!');
                setTimeout(() => setShareFeedback(null), 3000);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Text
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800 max-h-80 overflow-y-auto">
            {smsText}
          </pre>
        </section>
      )}

      {/* 2. GROCERY LIST & STORE ROUTE FIRST (Visible immediately at 375px without scrolling!) */}
      {combinedAisles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
          <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            No Items on Your List for {formatWeekRange(activeWeekStartDate)} Yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Schedule recipes in the Planner tab, or paste a shopping list from a shared note below.
          </p>
          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Paste Shopping List from Notes</span>
          </button>
        </div>
      ) : viewMode === 'walking_path' ? (
        <div className="space-y-3.5">
          {/* Compact 1-Line Store Route Progress Bar */}
          <div className="px-3.5 py-2.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Store className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-black truncate">{selectedStore.shortName}</span>
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="text-[11px] text-emerald-300 font-bold shrink-0">
                {tripStats.collectedItems}/{tripStats.totalItems} items
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                handleSelectViewMode(
                  viewMode === 'walking_path' ? 'standard_aisles' : 'walking_path'
                )
              }
              className="text-[11px] font-bold text-slate-300 hover:text-white underline shrink-0 cursor-pointer"
            >
              Switch to Aisles
            </button>
          </div>

          {/* Sequential Department Walk Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
            {walkingSteps.map(
              ({
                dept,
                recipeItems,
                extraItems,
                totalItems,
                completedItems,
                isFullyCompleted,
              }) => (
                <div
                  key={dept.id}
                  className={`rounded-2xl border p-3.5 sm:p-4 bg-white shadow-xs space-y-2.5 transition ${
                    isFullyCompleted
                      ? 'border-emerald-300/80 bg-emerald-50/15'
                      : dept.id === 'aisle_1_natural'
                      ? 'border-teal-300 ring-1 ring-teal-500/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                          isFullyCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-white'
                        }`}
                      >
                        {dept.sortOrder}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                            {dept.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">
                            {dept.locationLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isFullyCompleted ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" /> Done
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          {completedItems}/{totalItems}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {extraItems.map(renderExtraCard)}
                    {recipeItems.map(renderRecipeCard)}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        /* Standard Aisles View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {combinedAisles.map(({ aisle, recipeItems, extraItems }) => (
            <div
              key={aisle}
              className={`rounded-3xl border p-4 sm:p-5 bg-white shadow-xs space-y-3 ${
                aisle === 'Dairy Alternatives'
                  ? 'border-teal-300 ring-1 ring-teal-500/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    {aisle}
                  </h3>
                  {aisle === 'Dairy Alternatives' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Dairy-Free Routed
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {recipeItems.length + extraItems.length} items
                </span>
              </div>

              <div className="space-y-2">
                {extraItems.map(renderExtraCard)}
                {recipeItems.map(renderRecipeCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. RECIPES IN THIS WEEK'S LIST + MANUAL FAMILY ITEMS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recipes in This Week's Grocery List */}
        <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-emerald-600" />
              Recipes for Week of {formatWeekRange(activeWeekStartDate)} ({currentWeekPlan.length})
            </h3>
            <p className="text-xs text-slate-500">
              Add any recipe below to pull its ingredients into this dated shopping list.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="Search 3,500+ recipes to add to this week's list..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {matchingRecipesForPicker.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {matchingRecipesForPicker.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 flex items-center justify-between hover:bg-emerald-50/60 transition"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {rec.title}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {rec.subtitle}
                      </p>
                    </div>
                    <button
                      onClick={() => handleQuickAddRecipeToGrocery(rec.id)}
                      className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {currentWeekPlan.map((plan) => {
              const rec = recipes.find((r) => r.id === plan.recipe_id);
              if (!rec) return null;
              return (
                <div
                  key={plan.id}
                  className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-700">
                      {plan.day_of_week}
                    </span>
                    <p className="text-xs font-bold text-slate-900">
                      {rec.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500">
                      Serves
                    </span>
                    {([2, 4, 6] as ServingsSize[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => onUpdatePlanServings(plan.id, s)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer ${
                          plan.servings === s
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={() => onRemoveFromPlan(plan.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Manual Family Items for This Week */}
        <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Household Essentials &amp; Weekly Extras
              </h3>
              <p className="text-xs text-slate-500">
                Add everyday items or paste a list from a shared note for {formatWeekRange(activeWeekStartDate)}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPasteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-2xs transition cursor-pointer shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste Note List</span>
            </button>
          </div>

          <form
            onSubmit={handleAddExtraSubmit}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="text"
              value={newExtraQty}
              onChange={(e) => setNewExtraQty(e.target.value)}
              placeholder="Qty (e.g. 2 cartons)"
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs w-28"
            />
            <input
              type="text"
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
              placeholder="Item name (e.g. Oat Milk, Apples, Snacks)..."
              className="flex-1 min-w-[170px] px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <select
              value={newExtraAisle}
              onChange={(e) => setNewExtraAisle(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="Household & Extras">Household &amp; Extras</option>
              <option value="Produce">Produce</option>
              <option value="Dairy Alternatives">Dairy Alternatives</option>
              <option value="Dairy & Eggs">Dairy &amp; Eggs</option>
              <option value="Meat & Seafood">Meat &amp; Seafood</option>
              <option value="Grains & Bakery">Grains &amp; Bakery</option>
              <option value="Spices & Pantry">Spices &amp; Pantry</option>
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newExtraRecurring}
                onChange={(e) => setNewExtraRecurring(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              Weekly Staple
            </label>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              + Add
            </button>
          </form>

          {/* Quick Staples */}
          <div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FAMILY_STAPLES.map((st) => {
                const alreadyAdded = currentWeekExtras.some(
                  (e) => e.item_name.toLowerCase() === st.name.toLowerCase()
                );
                return (
                  <button
                    key={st.name}
                    type="button"
                    onClick={() => {
                      if (!alreadyAdded) {
                        onAddExtra(st.name, st.aisle);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      alreadyAdded
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {alreadyAdded ? '✓ ' : '+ '}
                    {st.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 4. FAMILY NUTRITION & COST SAVINGS RADAR */}
      {currentWeekPlan.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cost Savings Estimator */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 text-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                    HelloFresh vs FreshDIY Savings
                  </span>
                  <h3 className="text-base font-black">
                    You Save ${savings.weeklySavings.toFixed(2)} This Week!
                  </h3>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950">
                ~${savings.annualSavings.toLocaleString()} / year
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block">
                  HelloFresh Box ({savings.totalServings} servings)
                </span>
                <span className="text-sm font-black text-rose-300">
                  ${savings.helloFreshEstimatedCost.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block">
                  FreshDIY Grocery Total
                </span>
                <span className="text-sm font-black text-emerald-300">
                  ${savings.freshDiyGroceryCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Average Nutrition per Serving */}
          {averageNutrition && (
            <div className="rounded-3xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Dinner Nutrition Averages
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    ~{averageNutrition.calories} Calories / Serving
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Protein</span>
                  <span className="text-xs font-black text-slate-900">
                    {averageNutrition.proteinGrams}g
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Carbs</span>
                  <span className="text-xs font-black text-slate-900">
                    {averageNutrition.carbsGrams}g
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Fats</span>
                  <span className="text-xs font-black text-slate-900">
                    {averageNutrition.fatGrams}g
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Fiber</span>
                  <span className="text-xs font-black text-slate-900">
                    {averageNutrition.fiberGrams}g
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 📋 PASTE SHOPPING LIST FROM SHARED NOTE MODAL */}
      {isPasteModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsPasteModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
                  <ClipboardPaste className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Paste Shopping List from Shared Note
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paste any list from Apple Notes, Google Keep, or texts — we&apos;ll clean bullets and auto-sort every item by grocery aisle.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Paste Your List (1 item per line or comma-separated)
                </label>
                <button
                  type="button"
                  onClick={handleReadFromClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold border border-emerald-200 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" /> Read from Clipboard
                </button>
              </div>
              <textarea
                rows={5}
                autoFocus
                value={pastedText}
                onChange={(e) => handlePasteTextChange(e.target.value)}
                placeholder={`Example:\n- 2 cartons Oat milk\n- Ground turkey (2 packs)\n- Honeycrisp apples\n- Avocados x4\n- Sourdough bread\n- Paper towels`}
                className="w-full p-3.5 rounded-2xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Live Parsed Items & Auto-Sorted Aisles Preview */}
            {parsedNoteItems.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">
                    Ready to Import ({parsedNoteItems.length} item
                    {parsedNoteItems.length === 1 ? '' : 's'} detected)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Adjust aisle or pin as staple if needed
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {parsedNoteItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2"
                    >
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParsedNoteItems((prev) =>
                            prev.map((p) =>
                              p.id === item.id ? { ...p, itemName: val } : p
                            )
                          );
                        }}
                        className="flex-1 min-w-[140px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-900"
                      />

                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={item.aisle}
                          onChange={(e) => {
                            const nextAisle = e.target.value;
                            setParsedNoteItems((prev) =>
                              prev.map((p) =>
                                p.id === item.id ? { ...p, aisle: nextAisle } : p
                              )
                            );
                          }}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700"
                        >
                          {AISLE_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            setParsedNoteItems((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? { ...p, isRecurring: !p.isRecurring }
                                  : p
                              )
                            )
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                            item.isRecurring
                              ? 'bg-amber-200 border-amber-300 text-amber-950'
                              : 'bg-white border-slate-200 text-slate-500'
                          }`}
                          title="Pin as recurring weekly staple"
                        >
                          📌 {item.isRecurring ? 'Staple' : 'Once'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setParsedNoteItems((prev) =>
                              prev.filter((p) => p.id !== item.id)
                            )
                          }
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Remove line"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>

              {onMarkItemInInventory && parsedNoteItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportParsedToInventory}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                  title="Already bought these? Add all directly to your Kitchen Inventory"
                >
                  Add {parsedNoteItems.length} to Kitchen Inventory
                </button>
              )}

              <button
                type="button"
                disabled={parsedNoteItems.length === 0}
                onClick={handleImportParsedToGrocery}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add {parsedNoteItems.length || ''} Item
                {parsedNoteItems.length === 1 ? '' : 's'} to Grocery List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛒 ITEM CHECKED OFF: MOVE TO INVENTORY PROMPT MODAL */}
      {promptItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => handleConfirmMovePrompt(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Move to Kitchen Inventory?
                  </h3>
                  <p className="text-xs text-slate-500">
                    You checked off an item in your shopping list.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleConfirmMovePrompt(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-slate-900">
                  {promptItem.name}
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  +{promptItem.qty || 1} {promptItem.unit || 'item'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Will be added as In-Stock in{' '}
                <strong>
                  {promptItem.aisle === 'Meat & Seafood'
                    ? 'Freezer & Deep Freeze'
                    : promptItem.aisle === 'Produce' ||
                      promptItem.aisle === 'Dairy Alternatives' ||
                      promptItem.aisle === 'Dairy & Eggs'
                    ? 'Refrigerator'
                    : 'Pantry & Spices'}
                </strong>
                .
              </p>
            </div>

            <label className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none border border-transparent hover:border-slate-200 transition">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 w-4 h-4"
              />
              <span className="text-xs font-bold text-slate-700">
                Remember my choice and don&apos;t ask again
              </span>
            </label>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmMovePrompt(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Just Check Off
              </button>
              <button
                type="button"
                onClick={() => handleConfirmMovePrompt(true)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition cursor-pointer"
              >
                ✓ Yes, Move to Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
