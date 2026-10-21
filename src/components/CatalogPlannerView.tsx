import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Camera,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Plus,
  Refrigerator,
  Search,
  Sparkles,
  Trash2,
  Users,
  Utensils,
  Wind,
  X,
} from 'lucide-react';
import {
  CabinetItem,
  DAYS_OF_WEEK,
  DayOfWeek,
  Recipe,
  ServingsSize,
  WeeklyPlanItem,
} from '../types/freshdiy';
import { findBlendDefinition } from '../utils/blendDecoder';
import { formatAmount, transformIngredient } from '../utils/dairyEngine';
import { formatWeekRange } from '../utils/dateUtils';
import {
  COMMON_FRIDGE_STAPLES,
  evaluateRecipeMatch,
  rankRecipesByOnHandIngredients,
} from '../utils/pantryMatcher';

interface CatalogPlannerViewProps {
  recipes: Recipe[];
  cabinet: CabinetItem[];
  weeklyPlan: WeeklyPlanItem[];
  defaultServings: ServingsSize;
  isDairyFree: boolean;
  activeWeekStartDate: string;
  onNavigateWeek: (offset: number) => void;
  onHandFridgeItems: string[];
  onToggleFridgeItem: (item: string) => void;
  onClearFridgeItems: () => void;
  onSetDefaultServings: (s: ServingsSize) => void;
  onAddToPlan: (recipeId: string, day: DayOfWeek, servings: ServingsSize) => void;
  onUpdatePlanServings: (planId: string, servings: ServingsSize) => void;
  onRemoveFromPlan: (planId: string) => void;
  onCompleteWeeklyPlan: () => void;
  onOpenCookingView: (recipe: Recipe, servings: ServingsSize) => void;
  onOpenBlendModal: (blendName: string) => void;
  onOpenPhotoScanner: (mode: 'cabinet' | 'fridge') => void;
}

const FILTER_TAGS = [
  'All',
  'Best Ingredient Match',
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
  activeWeekStartDate,
  onNavigateWeek,
  onHandFridgeItems,
  onToggleFridgeItem,
  onClearFridgeItems,
  onSetDefaultServings,
  onAddToPlan,
  onUpdatePlanServings,
  onRemoveFromPlan,
  onCompleteWeeklyPlan,
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

  // Compute match scores for all recipes
  const matchMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateRecipeMatch>>();
    for (const r of recipes) {
      map.set(
        r.id,
        evaluateRecipeMatch(
          r,
          onHandFridgeItems,
          cabinet,
          defaultServings,
          isDairyFree
        )
      );
    }
    return map;
  }, [recipes, onHandFridgeItems, cabinet, defaultServings, isDairyFree]);

  // Top suggested recipes based on Fridge + Cabinet
  const topSuggestions = useMemo(() => {
    return rankRecipesByOnHandIngredients(
      recipes,
      onHandFridgeItems,
      cabinet,
      defaultServings,
      isDairyFree
    ).slice(0, 4);
  }, [recipes, onHandFridgeItems, cabinet, defaultServings, isDairyFree]);

  const visibleRecipes = useMemo(() => {
    const filtered = recipes
      .filter((r) => (showAllVersions ? true : r.is_latest))
      .filter((r) => {
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
        const scoreA = ma.fridgeHitCount * 25 + ma.matchPercentage;
        const scoreB = mb.fridgeHitCount * 25 + mb.matchPercentage;
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
    <div className="space-y-6 pb-8">
      {/* 1. MOBILE-FIRST WEEKLY MEAL PLANNER */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700">
                <Calendar className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Family Meal Plan
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-extrabold rounded-full bg-emerald-100 text-emerald-800">
                {plannedCount}/7 Days
              </span>
            </div>

            {/* Week Switcher in Planner */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => onNavigateWeek(-1)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-slate-700">
                Week of {formatWeekRange(activeWeekStartDate)}
              </span>
              <button
                onClick={() => onNavigateWeek(1)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Global Serving Size Selector */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 px-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
              </span>
              {([2, 4, 6] as ServingsSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => onSetDefaultServings(size)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    defaultServings === size
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size}p
                </button>
              ))}
            </div>

            {plannedCount > 0 && (
              <button
                onClick={onCompleteWeeklyPlan}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {completedCount === plannedCount && plannedCount > 0
                  ? 'Week Done'
                  : 'Complete Week'}
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Swipeable Day Strip (Thumb-Optimized for Mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DAYS_OF_WEEK.map((day) => {
            const pItem = currentWeekPlan.find((p) => p.day_of_week === day);
            const isSelected = selectedDayForAdd === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDayForAdd(day)}
                className={`flex-1 min-w-[72px] py-2.5 px-3 rounded-2xl border text-center transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : pItem
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-wider">
                  {day.slice(0, 3)}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1">
                  {pItem ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-emerald-200 text-emerald-900'
                      }`}
                    >
                      {pItem.servings}p ✓
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      Open
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Selected Day Card (Mobile + Desktop Focus) */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {activeDayPlan && activeDayRecipe ? (
            <>
              <div className="flex items-center gap-3">
                <img
                  src={activeDayRecipe.image_url}
                  alt={activeDayRecipe.title}
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-200"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                      {selectedDayForAdd}&apos;s Dinner
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • {activeDayRecipe.prep_time} mins
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                    {activeDayRecipe.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {activeDayRecipe.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/80">
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  {([2, 4, 6] as ServingsSize[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdatePlanServings(activeDayPlan.id, s)}
                      className={`px-2.5 py-1 text-xs font-extrabold rounded-lg cursor-pointer ${
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs cursor-pointer"
                >
                  <ChefHat className="w-4 h-4" /> Start Cooking
                </button>

                <button
                  onClick={() => onRemoveFromPlan(activeDayPlan.id)}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Remove meal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full py-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                  {selectedDayForAdd.slice(0, 3)}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    No meal planned for {selectedDayForAdd} yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tap &ldquo;+ Add to {selectedDayForAdd.slice(0, 3)}&rdquo; on any recipe or smart suggestion below!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. REDESIGNED SMART RECIPE SUGGESTOR ("COOK WITH WHAT WE HAVE") */}
      <section className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shrink-0">
              <Refrigerator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Smart Recipe Recommendations
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {onHandFridgeItems.length} Fridge + {inStockCabinetCount} Spices
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Matches your on-hand fridge ingredients + Spice Cabinet to suggest tonight&apos;s best dinner.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpenPhotoScanner('fridge')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              📸 Snap Fridge Photo
            </button>

            <button
              onClick={() => setShowMatcherPanel(!showMatcherPanel)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
            >
              {showMatcherPanel
                ? 'Hide Fridge Checklist'
                : `Edit Fridge Items (${onHandFridgeItems.length})`}
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

        {/* Recipe Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {visibleRecipes.slice(0, visibleLimit).map((recipe) => {
            const matchInfo = matchMap.get(recipe.id);
            const previewIngredients = recipe.ingredients_json
              .slice(0, 5)
              .map((ing) =>
                transformIngredient(
                  ing,
                  recipe.base_servings || 4,
                  defaultServings,
                  isDairyFree
                )
              );

            const hasDairySub = recipe.ingredients_json.some(
              (ing) =>
                transformIngredient(
                  ing,
                  recipe.base_servings || 4,
                  defaultServings,
                  isDairyFree
                ).original_dairy_name
            );

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div
                    onClick={() => onOpenCookingView(recipe, defaultServings)}
                    className="relative h-44 bg-slate-200 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs flex items-center gap-1 ${
                          recipe.version > 1
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-900/80 text-white backdrop-blur-xs'
                        }`}
                      >
                        {recipe.version > 1 && <Sparkles className="w-3 h-3" />}
                        v{recipe.version}
                      </span>
                      {hasDairySub && isDairyFree && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-600 text-white shadow-xs">
                          🌱 DF
                        </span>
                      )}
                      {matchInfo && matchInfo.matchPercentage > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs">
                          {matchInfo.matchPercentage}% On Hand
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-slate-800 shadow-xs flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      {recipe.prep_time}m
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {recipe.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
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

                    <h3
                      onClick={() => onOpenCookingView(recipe, defaultServings)}
                      className="font-extrabold text-slate-900 text-base leading-snug cursor-pointer hover:text-emerald-700"
                    >
                      {recipe.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {recipe.subtitle}
                    </p>

                    {/* Scaled Ingredients Preview */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap gap-1">
                        {previewIngredients.map((ing, i) => {
                          const matchedBlend = findBlendDefinition(
                            ing.blend_name || ing.name
                          );
                          return (
                            <span
                              key={i}
                              onClick={() => {
                                if (matchedBlend) {
                                  onOpenBlendModal(matchedBlend.name);
                                }
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-lg border ${
                                matchedBlend
                                  ? 'bg-amber-100 border-amber-300 text-amber-950 font-bold cursor-pointer hover:bg-amber-200'
                                  : ing.original_dairy_name
                                  ? 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              {matchedBlend ? '✨ ' : ''}
                              {formatAmount(ing.amount)} {ing.unit} {ing.name}
                            </span>
                          );
                        })}
                        {recipe.ingredients_json.length > 5 && (
                          <span className="text-[11px] px-2 py-0.5 text-slate-400">
                            +{recipe.ingredients_json.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenCookingView(recipe, defaultServings)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    Recipe &amp; Steps
                  </button>

                  <button
                    onClick={() => {
                      onAddToPlan(recipe.id, selectedDayForAdd, defaultServings);
                      const nextIdx =
                        (DAYS_OF_WEEK.indexOf(selectedDayForAdd) + 1) %
                        DAYS_OF_WEEK.length;
                      setSelectedDayForAdd(DAYS_OF_WEEK[nextIdx]);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to {selectedDayForAdd.slice(0, 3)} ({defaultServings}p)
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
