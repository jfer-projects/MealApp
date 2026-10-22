import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Camera,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Heart,
  Plus,
  Refrigerator,
  Search,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  Utensils,
  Wand2,
  Wind,
  X,
} from 'lucide-react';
import {
  CabinetItem,
  DAYS_OF_WEEK,
  DayOfWeek,
  Recipe,
  RecipeRating,
  ServingsSize,
  WeeklyPlanItem,
} from '../types/freshdiy';
import { findBlendDefinition } from '../utils/blendDecoder';
import { formatAmount, transformIngredient } from '../utils/dairyEngine';
import { formatWeekRange } from '../utils/dateUtils';
import { estimateRecipeNutrition } from '../utils/nutritionCostEngine';
import {
  buildPantryContext,
  COMMON_FRIDGE_STAPLES,
  evaluateRecipeMatch,
} from '../utils/pantryMatcher';

interface CatalogPlannerViewProps {
  recipes: Recipe[];
  cabinet: CabinetItem[];
  weeklyPlan: WeeklyPlanItem[];
  defaultServings: ServingsSize;
  isDairyFree: boolean;
  onToggleDairyFree?: () => void;
  activeWeekStartDate: string;
  onNavigateWeek: (offset: number) => void;
  onHandFridgeItems: string[];
  onToggleFridgeItem: (item: string) => void;
  onClearFridgeItems: () => void;
  onSetDefaultServings: (s: ServingsSize) => void;
  onAddToPlan: (recipeId: string, day: DayOfWeek, servings: ServingsSize) => void;
  onUpdatePlanServings: (planId: string, servings: ServingsSize) => void;
  onMovePlanDay?: (planId: string, newDay: DayOfWeek) => void;
  onRemoveFromPlan: (planId: string) => void;
  onFillMyWeek?: () => void;
  onOpenMacroPlanner?: () => void;
  onCompleteWeeklyPlan: () => void;
  ratingsMap?: Record<string, RecipeRating>;
  onToggleFavorite?: (recipeId: string) => void;
  onOpenCookingView: (recipe: Recipe, servings: ServingsSize) => void;
  onOpenBlendModal: (blendName: string) => void;
  onOpenPhotoScanner: (mode: 'cabinet' | 'fridge' | 'freezer') => void;
}

const FILTER_TAGS = [
  'All',
  '❤️ Favorites',
  'Best Ingredient Match',
  '🥩 High Protein (>35g)',
  '🔥 Under 600 Cal',
  'Kid-Friendly',
  'Under 30 Mins',
  'Sheet Pan',
  'Air Fryer',
  'Rice Cooker',
];

export const CatalogPlannerView: React.FC<CatalogPlannerViewProps> = ({
  recipes,
  cabinet,
  weeklyPlan,
  defaultServings,
  isDairyFree,
  onToggleDairyFree,
  activeWeekStartDate,
  onNavigateWeek,
  onHandFridgeItems,
  onToggleFridgeItem,
  onClearFridgeItems,
  onSetDefaultServings,
  onAddToPlan,
  onUpdatePlanServings,
  onMovePlanDay,
  onRemoveFromPlan,
  onFillMyWeek,
  onOpenMacroPlanner,
  onCompleteWeeklyPlan,
  ratingsMap = {},
  onToggleFavorite,
  onOpenCookingView,
  onOpenBlendModal,
  onOpenPhotoScanner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [selectedDayForAdd, setSelectedDayForAdd] = useState<DayOfWeek>('Monday');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [customFridgeInput, setCustomFridgeInput] = useState('');
  const [showMatcherPanel, setShowMatcherPanel] = useState(false);
  const [activeFridgeCategory, setActiveFridgeCategory] = useState(
    COMMON_FRIDGE_STAPLES[0].category
  );
  const [visibleLimit, setVisibleLimit] = useState(24);

  // Filter weekly plan items for the active week
  const currentWeekPlan = useMemo(
    () => weeklyPlan.filter((p) => p.week_start_date === activeWeekStartDate),
    [weeklyPlan, activeWeekStartDate]
  );

  // Compute match scores for all recipes using a single pre-computed pantry context
  const matchMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateRecipeMatch>>();
    const ctx = buildPantryContext(onHandFridgeItems, cabinet);
    for (const r of recipes) {
      map.set(
        r.id,
        evaluateRecipeMatch(
          r,
          onHandFridgeItems,
          cabinet,
          defaultServings,
          isDairyFree,
          ctx
        )
      );
    }
    return map;
  }, [recipes, onHandFridgeItems, cabinet, defaultServings, isDairyFree]);

  // Top suggested recipes based on Fridge + Cabinet (reusing matchMap without re-evaluating 3,500 recipes)
  const topSuggestions = useMemo(() => {
    const latestResults: ReturnType<typeof evaluateRecipeMatch>[] = [];
    for (const r of recipes) {
      if (!r.is_latest) continue;
      const m = matchMap.get(r.id);
      if (m) latestResults.push(m);
    }
    return latestResults
      .sort((a, b) => {
        if (onHandFridgeItems.length > 0 && a.fridgeHitCount !== b.fridgeHitCount) {
          const scoreA = a.fridgeHitCount * 25 + a.matchPercentage;
          const scoreB = b.fridgeHitCount * 25 + b.matchPercentage;
          if (scoreB !== scoreA) return scoreB - scoreA;
        }
        if (b.matchPercentage !== a.matchPercentage) {
          return b.matchPercentage - a.matchPercentage;
        }
        return a.missingItems.length - b.missingItems.length;
      })
      .slice(0, 4);
  }, [recipes, matchMap, onHandFridgeItems.length]);

  const visibleRecipes = useMemo(() => {
    const filtered = recipes
      .filter((r) => (showAllVersions ? true : r.is_latest))
      .filter((r) => {
        const ratingEntry = ratingsMap[r.original_id || r.id] || ratingsMap[r.id];
        if (activeTag === '❤️ Favorites') {
          return Boolean(ratingEntry?.is_favorite);
        }
        if (activeTag === '🥩 High Protein (>35g)') {
          const nut = estimateRecipeNutrition(r);
          return nut.proteinGrams >= 35;
        }
        if (activeTag === '🔥 Under 600 Cal') {
          const nut = estimateRecipeNutrition(r);
          return nut.calories <= 600;
        }
        if (
          activeTag !== 'All' &&
          activeTag !== 'Best Ingredient Match' &&
          !r.tags.includes(activeTag)
        ) {
          return false;
        }
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchTitle = r.title.toLowerCase().includes(q);
          const matchSub = r.subtitle?.toLowerCase().includes(q);
          const matchIng = r.ingredients_json.some((i) =>
            i.name.toLowerCase().includes(q)
          );
          return matchTitle || matchSub || matchIng;
        }
        return true;
      });

    if (activeTag === 'Best Ingredient Match' || onHandFridgeItems.length > 0) {
      return [...filtered].sort((a, b) => {
        const ma = matchMap.get(a.id);
        const mb = matchMap.get(b.id);
        if (!ma || !mb) return 0;
        const ra = ratingsMap[a.original_id || a.id] || ratingsMap[a.id];
        const rb = ratingsMap[b.original_id || b.id] || ratingsMap[b.id];
        const favBonusA = (ra?.is_favorite ? 15 : 0) + (ra?.rating === 1 ? 10 : ra?.rating === -1 ? -40 : 0);
        const favBonusB = (rb?.is_favorite ? 15 : 0) + (rb?.rating === 1 ? 10 : rb?.rating === -1 ? -40 : 0);
        const scoreA = ma.fridgeHitCount * 25 + ma.matchPercentage + favBonusA;
        const scoreB = mb.fridgeHitCount * 25 + mb.matchPercentage + favBonusB;
        return scoreB - scoreA;
      });
    }

    return filtered;
  }, [
    recipes,
    activeTag,
    searchQuery,
    showAllVersions,
    onHandFridgeItems,
    matchMap,
    ratingsMap,
  ]);

  const handleAddCustomFridge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFridgeInput.trim()) return;
    onToggleFridgeItem(customFridgeInput.trim());
    setCustomFridgeInput('');
  };

  const plannedCount = currentWeekPlan.length;
  const completedCount = currentWeekPlan.filter((p) => p.status === 'completed').length;
  const inStockCabinetCount = cabinet.filter(
    (c) => c.status !== 'out_of_stock'
  ).length;

  const activeDayPlan = currentWeekPlan.find(
    (p) => p.day_of_week === selectedDayForAdd
  );
  const activeDayRecipe = activeDayPlan
    ? recipes.find((r) => r.id === activeDayPlan.recipe_id)
    : undefined;

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* 1. COMPACT MOBILE-FIRST WEEKLY MEAL PLANNER */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
                <Calendar className="w-4 h-4" />
              </span>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Meal Plan
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-100 text-emerald-800">
                {plannedCount}/7
              </span>
            </div>

            {/* Compact Week Switcher */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl px-1.5 py-0.5">
              <button
                onClick={() => onNavigateWeek(-1)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                {formatWeekRange(activeWeekStartDate)}
              </span>
              <button
                onClick={() => onNavigateWeek(1)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {/* 1-Tap Auto-Planner ("Auto-Fill Week") */}
              {onFillMyWeek && (
                <button
                  onClick={onFillMyWeek}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
                  title="Auto-fill open days with varied dinners matching your Freezer, Fridge & Pantry"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Fill Week</span>
                </button>
              )}

              {/* Macro Goals & AI Assistant */}
              {onOpenMacroPlanner && (
                <button
                  onClick={onOpenMacroPlanner}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
                  title="Set target protein/calories and generate meals using your house inventory"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Macro AI</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Global Serving Size Selector */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 pl-2 pr-1 hidden sm:inline">
                  Servings:
                </span>
                {([2, 4, 6] as ServingsSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => onSetDefaultServings(size)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                      defaultServings === size
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={`${size} Servings`}
                  >
                    {size}p
                  </button>
                ))}
              </div>

              {plannedCount > 0 && (
                <button
                  onClick={onCompleteWeeklyPlan}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {completedCount === plannedCount ? 'Week Done' : 'Complete Week'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 7-Day Grid (Fits all 7 days on mobile screen at once!) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {DAYS_OF_WEEK.map((day) => {
            const pItem = currentWeekPlan.find((p) => p.day_of_week === day);
            const isSelected = selectedDayForAdd === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDayForAdd(day)}
                className={`py-2 px-1 rounded-2xl border text-center transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : pItem
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight">
                  {day.slice(0, 3)}
                </div>
                <div className="mt-0.5 flex items-center justify-center">
                  {pItem ? (
                    <span
                      className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      className={`text-[9px] sm:text-[10px] font-medium ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      +
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Selected Day Card (Full card when planned, slim 1-line bar when open) */}
        {activeDayPlan && activeDayRecipe ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <img
                src={activeDayRecipe.image_url}
                alt={activeDayRecipe.title}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover shrink-0 border border-slate-200"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    {selectedDayForAdd}&apos;s Dinner
                  </span>
                  <span className="text-[10px] text-slate-400">
                    • {activeDayRecipe.prep_time}m
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  {activeDayRecipe.title}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  {activeDayRecipe.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/80">
              {onMovePlanDay && (
                <select
                  value={activeDayPlan.day_of_week}
                  onChange={(e) => {
                    const nextDay = e.target.value as DayOfWeek;
                    onMovePlanDay(activeDayPlan.id, nextDay);
                    setSelectedDayForAdd(nextDay);
                  }}
                  className="px-2 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                  title="Move meal to another day of the week"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      Move: {d.slice(0, 3)}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-xl border border-slate-200">
                {([2, 4, 6] as ServingsSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => onUpdatePlanServings(activeDayPlan.id, s)}
                    className={`px-2 py-1 text-[11px] font-extrabold rounded-lg cursor-pointer ${
                      activeDayPlan.servings === s
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    {s}p
                  </button>
                ))}
              </div>

              <button
                onClick={() =>
                  onOpenCookingView(activeDayRecipe, activeDayPlan.servings)
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
              >
                <ChefHat className="w-3.5 h-3.5" /> Cook
              </button>

              <button
                onClick={() => onRemoveFromPlan(activeDayPlan.id)}
                className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Remove meal"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 flex items-center justify-between text-xs text-slate-600">
            <span>
              <strong className="text-slate-800">{selectedDayForAdd} is open</strong> — tap{' '}
              <span className="font-bold text-emerald-700">&ldquo;+ Add to {selectedDayForAdd.slice(0, 3)}&rdquo;</span> on any recipe below
            </span>
          </div>
        )}
      </section>

      {/* 2. COMPACT KITCHEN MATCHER ("COOK WITH WHAT YOU HAVE") */}
      <section className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-3.5 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shrink-0">
              <Refrigerator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                  Cook With What You Have
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {onHandFridgeItems.length} Fridge + {inStockCabinetCount} Pantry
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Matching {onHandFridgeItems.length} fridge items &amp; {inStockCabinetCount} spices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowMatcherPanel(!showMatcherPanel)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
            >
              {showMatcherPanel ? 'Done' : `Fridge (${onHandFridgeItems.length})`}
            </button>
          </div>
        </div>

        {/* Active On-Hand Fridge Pills Summary */}
        {onHandFridgeItems.length > 0 && !showMatcherPanel && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-bold text-emerald-300 shrink-0 mr-1">
              In Fridge:
            </span>
            {onHandFridgeItems.map((item) => (
              <button
                key={item}
                onClick={() => onToggleFridgeItem(item)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/30 text-emerald-100 text-[11px] font-bold shrink-0 cursor-pointer"
              >
                {item} <X className="w-3 h-3 opacity-70" />
              </button>
            ))}
            <button
              onClick={onClearFridgeItems}
              className="text-[11px] text-slate-400 hover:text-white underline ml-2 shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Expandable Tabbed Fridge Selector (Compact on Mobile) */}
        {showMatcherPanel && (
          <div className="space-y-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {COMMON_FRIDGE_STAPLES.map((group) => (
                <button
                  key={group.category}
                  onClick={() => setActiveFridgeCategory(group.category)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                    activeFridgeCategory === group.category
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {group.category}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 bg-white/5 p-3 rounded-2xl border border-white/10">
              {COMMON_FRIDGE_STAPLES.find(
                (g) => g.category === activeFridgeCategory
              )?.items.map((item) => {
                const active = onHandFridgeItems.some(
                  (i) => i.toLowerCase() === item.toLowerCase()
                );
                return (
                  <button
                    key={item}
                    onClick={() => onToggleFridgeItem(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      active
                        ? 'bg-emerald-400 text-slate-950 shadow-xs'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {item}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAddCustomFridge} className="flex gap-2">
              <input
                type="text"
                value={customFridgeInput}
                onChange={(e) => setCustomFridgeInput(e.target.value)}
                placeholder="Type any other ingredient you have on hand..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 text-xs font-extrabold cursor-pointer"
              >
                + Add
              </button>
            </form>
          </div>
        )}

        {/* Horizontal Swipeable Top Suggested Cards on Mobile */}
        <div className="flex lg:grid lg:grid-cols-4 gap-3 overflow-x-auto pb-1 snap-x snap-mandatory no-scrollbar">
          {topSuggestions.map((sug) => (
            <div
              key={sug.recipe.id}
              className="min-w-[265px] sm:min-w-[290px] lg:min-w-0 snap-start rounded-2xl bg-white/10 border border-white/15 p-3.5 flex flex-col justify-between gap-3 backdrop-blur-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-400 text-slate-950">
                    {sug.matchPercentage}% Match
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-200">
                    {sug.missingItems.length === 0
                      ? '🎉 Ready Now!'
                      : `Need ${sug.missingItems.length} item${
                          sug.missingItems.length === 1 ? '' : 's'
                        }`}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <img
                    src={sug.recipe.image_url}
                    alt={sug.recipe.title}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-1">
                      {sug.recipe.title}
                    </h4>
                    <p className="text-[11px] text-slate-300 line-clamp-1">
                      {sug.recipe.subtitle}
                    </p>
                  </div>
                </div>

                {sug.matchedFridgeItems.length > 0 && (
                  <p className="text-[11px] text-emerald-300 line-clamp-1">
                    <strong>Fridge:</strong> {sug.matchedFridgeItems.join(', ')}
                  </p>
                )}

                {sug.missingItems.length > 0 && (
                  <p className="text-[11px] text-rose-300 line-clamp-1">
                    <strong>Need:</strong>{' '}
                    {sug.missingItems.map((m) => m.name).join(', ')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => onOpenCookingView(sug.recipe, defaultServings)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition cursor-pointer"
                >
                  View Recipe
                </button>
                <button
                  onClick={() => {
                    onAddToPlan(
                      sug.recipe.id,
                      selectedDayForAdd,
                      defaultServings
                    );
                    const nextIdx =
                      (DAYS_OF_WEEK.indexOf(selectedDayForAdd) + 1) %
                      DAYS_OF_WEEK.length;
                    setSelectedDayForAdd(DAYS_OF_WEEK[nextIdx]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-[11px] font-black transition cursor-pointer"
                >
                  + Add to {selectedDayForAdd.slice(0, 3)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. RECIPE VAULT SEARCH & MOBILE FILTER PILLS */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(24);
              }}
              placeholder={`Search ${
                recipes.filter((r) => r.is_latest).length
              }+ HelloFresh recipes, ingredients, or blends...`}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {onToggleDairyFree && (
              <button
                type="button"
                role="switch"
                aria-checked={isDairyFree}
                onClick={onToggleDairyFree}
                className={`px-3 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                  isDairyFree
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Automatically substitutes butter, milk, sour cream, and cheese with plant-based alternatives"
              >
                <span>🌱 Dairy-free</span>
                <span
                  className={`w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors ${
                    isDairyFree ? 'bg-teal-800 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                </span>
              </button>
            )}

            {FILTER_TAGS.map((tag) => {
              const active = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tag === 'Best Ingredient Match' && (
                    <Refrigerator className="w-3.5 h-3.5" />
                  )}
                  {tag === 'Air Fryer' && <Wind className="w-3.5 h-3.5" />}
                  {tag === 'Rice Cooker' && <Flame className="w-3.5 h-3.5" />}
                  {tag}
                </button>
              );
            })}

            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 ml-2 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={showAllVersions}
                onChange={(e) => setShowAllVersions(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              v1 History
            </label>
          </div>
        </div>

        {/* Recipe Cards Grid (Compact Mobile-First Layout: 2+ cards per screen at 375px) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {visibleRecipes.slice(0, visibleLimit).map((recipe) => {
            const matchInfo = matchMap.get(recipe.id);
            const rEntry =
              ratingsMap[recipe.original_id || recipe.id] || ratingsMap[recipe.id];

            return (
              <div
                key={recipe.id}
                onClick={() => onOpenCookingView(recipe, defaultServings)}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="relative aspect-[16/10] bg-slate-200 overflow-hidden">
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {recipe.version > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white shadow-xs flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          v{recipe.version}
                        </span>
                      )}
                      {matchInfo && matchInfo.matchPercentage > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                          {matchInfo.matchPercentage}% On Hand
                        </span>
                      )}
                    </div>

                    {onToggleFavorite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(recipe.original_id || recipe.id);
                        }}
                        aria-label="Toggle family favorite"
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition cursor-pointer ${
                          rEntry?.is_favorite
                            ? 'bg-rose-600 text-white'
                            : 'bg-white/90 hover:bg-white text-slate-500 hover:text-rose-600'
                        }`}
                        title="Save to Family Favorites"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            rEntry?.is_favorite ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    )}

                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/95 text-slate-800 shadow-xs flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      {recipe.prep_time}m
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3">
                    {recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {recipe.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                              t === 'Air Fryer'
                                ? 'bg-amber-100 text-amber-800'
                                : t === 'Rice Cooker'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-emerald-700">
                      {recipe.title}
                    </h3>
                  </div>
                </div>

                {/* Single Compact Add Button */}
                <div className="px-2.5 pb-2.5 sm:px-3 sm:pb-3 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToPlan(recipe.id, selectedDayForAdd, defaultServings);
                      const nextIdx =
                        (DAYS_OF_WEEK.indexOf(selectedDayForAdd) + 1) %
                        DAYS_OF_WEEK.length;
                      setSelectedDayForAdd(DAYS_OF_WEEK[nextIdx]);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to {selectedDayForAdd.slice(0, 3)}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {visibleRecipes.length > visibleLimit && (
          <div className="flex flex-col items-center justify-center pt-4 gap-2">
            <p className="text-xs text-slate-500">
              Showing {visibleLimit} of {visibleRecipes.length} unique HelloFresh recipes
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setVisibleLimit((prev) => prev + 24)}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
              >
                Load 24 More Recipes
              </button>
              <button
                onClick={() => setVisibleLimit(visibleRecipes.length)}
                className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Show All ({visibleRecipes.length})
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
