import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChefHat,
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
import { formatAmount, transformIngredient } from '../utils/dairyEngine';
import { findBlendDefinition } from '../utils/blendDecoder';
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [selectedDayForAdd, setSelectedDayForAdd] = useState<DayOfWeek>('Monday');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [customFridgeInput, setCustomFridgeInput] = useState('');
  const [showMatcherPanel, setShowMatcherPanel] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(24);

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
    ).slice(0, 3);
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

  const plannedCount = weeklyPlan.length;
  const completedCount = weeklyPlan.filter((p) => p.status === 'completed').length;
  const inStockCabinetCount = cabinet.filter(
    (c) => c.status !== 'out_of_stock'
  ).length;

  return (
    <div className="space-y-8">
      {/* Weekly Family Meal Plan Strip */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Weekly Family Meal Plan
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                {plannedCount} Meals Planned
              </span>
              {isDairyFree && (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">
                  🌱 Dairy-Free Substitutions Active
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Defaulting to {defaultServings} servings (2 adults, 2 kids — You &amp; Valleria). Change servings per meal anytime.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Global Serving Size Selector */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <span className="text-xs font-medium text-slate-600 px-2.5 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Default Servings:
              </span>
              {([2, 4, 6] as ServingsSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => onSetDefaultServings(size)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    defaultServings === size
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {plannedCount > 0 && (
              <button
                onClick={onCompleteWeeklyPlan}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                title="Marks planned meals completed and auto-deducts utilized spices & sauces from your Cabinet"
              >
                <CheckCircle2 className="w-4 h-4" />
                {completedCount === plannedCount && plannedCount > 0
                  ? 'Week Completed (Spices Deducted)'
                  : 'Complete Week & Auto-Deduct Cabinet'}
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {DAYS_OF_WEEK.map((day) => {
            const planItem = weeklyPlan.find((p) => p.day_of_week === day);
            const recipe = planItem
              ? recipes.find((r) => r.id === planItem.recipe_id)
              : undefined;
            const isSelectedTarget = selectedDayForAdd === day;

            return (
              <div
                key={day}
                onClick={() => setSelectedDayForAdd(day)}
                className={`rounded-xl p-3 border transition cursor-pointer flex flex-col justify-between min-h-[148px] ${
                  planItem?.status === 'completed'
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : isSelectedTarget
                    ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {day.slice(0, 3)}
                  </span>
                  {planItem ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromPlan(planItem.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md"
                      title="Remove from day"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-600 font-medium">
                      {isSelectedTarget ? 'Target Day' : 'Empty'}
                    </span>
                  )}
                </div>

                {planItem && recipe ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {recipe.version > 1 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-violet-100 text-violet-800">
                          v{recipe.version} AI
                        </span>
                      )}
                      {planItem.status === 'completed' && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-200 text-emerald-900">
                          Done
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
                      {recipe.title}
                    </p>
                    <div
                      className="flex items-center justify-between pt-1 border-t border-slate-200/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        {([2, 4, 6] as ServingsSize[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => onUpdatePlanServings(planItem.id, s)}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              planItem.servings === s
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {s}p
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() =>
                          onOpenCookingView(recipe, planItem.servings)
                        }
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5"
                      >
                        <ChefHat className="w-3.5 h-3.5" /> Cook
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-4 text-slate-400">
                    <Plus className="w-4 h-4 mb-1" />
                    <span className="text-[11px]">
                      Click a recipe below to add to {day}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* NEW: Smart Recipe Suggestor ("Cook With What We Already Have") */}
      <section className="bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 text-white rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 shrink-0">
              <Refrigerator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight">
                  Cook With What We Have — Smart Recipe Suggestor
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {onHandFridgeItems.length} Fridge Items + {inStockCabinetCount} Cabinet Spices Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Select proteins, veggies, or grains currently in your fridge/freezer. We combine them with your live <strong>Spice Cabinet</strong> (and DIY HelloFresh blends) to rank recipes you can cook right now!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onHandFridgeItems.length > 0 && (
              <button
                onClick={onClearFridgeItems}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear Fridge ({onHandFridgeItems.length})
              </button>
            )}
            <button
              onClick={() => setShowMatcherPanel(!showMatcherPanel)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition cursor-pointer"
            >
              {showMatcherPanel ? 'Hide Fridge Selector' : 'Select Fridge Ingredients'}
            </button>
          </div>
        </div>

        {showMatcherPanel && (
          <div className="space-y-5 pt-2 border-t border-white/10">
            {/* Fridge Ingredient Selector Chips + Custom Input */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {COMMON_FRIDGE_STAPLES.map((group) => (
                <div
                  key={group.category}
                  className="bg-white/5 rounded-xl p-3.5 border border-white/10 space-y-2"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    {group.category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => {
                      const active = onHandFridgeItems.some(
                        (i) => i.toLowerCase() === item.toLowerCase()
                      );
                      return (
                        <button
                          key={item}
                          onClick={() => onToggleFridgeItem(item)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            active
                              ? 'bg-emerald-400 text-slate-950 font-bold shadow-xs'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Ingredient Input Bar */}
            <form
              onSubmit={handleAddCustomFridge}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={customFridgeInput}
                onChange={(e) => setCustomFridgeInput(e.target.value)}
                placeholder="Have something else on hand? (e.g., Poblano, Shrimp, Couscous...)"
                className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-400 w-72 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold text-white transition cursor-pointer"
              >
                + Add Custom On-Hand Item
              </button>
            </form>

            {/* Top 3 Suggested Recipes Based on Current Inventory */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Top Suggested Recipes Based on Your Inventory
                </h3>
                <span className="text-[11px] text-slate-300">
                  Ranked by Fridge Matches + In-Stock Cabinet Spices
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topSuggestions.map((sug) => (
                  <div
                    key={sug.recipe.id}
                    className="rounded-xl bg-white/10 border border-white/15 p-4 flex flex-col justify-between gap-3 backdrop-blur-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-400 text-slate-950">
                          {sug.matchPercentage}% Total Match
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          {sug.missingItems.length === 0
                            ? '🎉 Ready to Cook Tonight!'
                            : `Only need ${sug.missingItems.length} item${
                                sug.missingItems.length === 1 ? '' : 's'
                              }`}
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm leading-snug">
                        {sug.recipe.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 line-clamp-1">
                        {sug.recipe.subtitle}
                      </p>

                      {sug.matchedFridgeItems.length > 0 && (
                        <div className="text-[11px] text-emerald-300">
                          <strong>Uses from Fridge:</strong>{' '}
                          {sug.matchedFridgeItems.join(', ')}
                        </div>
                      )}

                      {sug.matchedCabinetItems.length > 0 && (
                        <div className="text-[11px] text-amber-300">
                          <strong>In Your Cabinet:</strong>{' '}
                          {sug.matchedCabinetItems.join(', ')}
                        </div>
                      )}

                      {sug.missingItems.length > 0 && (
                        <div className="text-[11px] text-rose-300">
                          <strong>Missing to Buy:</strong>{' '}
                          {sug.missingItems.map((m) => m.name).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() =>
                          onOpenCookingView(sug.recipe, defaultServings)
                        }
                        className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition cursor-pointer"
                      >
                        Open Cooking Cards
                      </button>
                      <button
                        onClick={() =>
                          onAddToPlan(
                            sug.recipe.id,
                            selectedDayForAdd,
                            defaultServings
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold transition cursor-pointer"
                      >
                        + Plan for {selectedDayForAdd.slice(0, 3)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recipe Vault Search & Instant Filter Bar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(24);
              }}
              placeholder={`Search ${recipes.filter((r) => r.is_latest).length}+ authentic HelloFresh recipes, ingredients, or blends...`}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TAGS.map((tag) => {
              const active = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
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

            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 ml-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllVersions}
                onChange={(e) => setShowAllVersions(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Show older versions (v1)
            </label>
          </div>
        </div>

        {/* Recipe Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-200 overflow-hidden">
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
                        {!recipe.is_latest && ' (Archived)'}
                      </span>
                      {hasDairySub && isDairyFree && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-600 text-white shadow-xs">
                          🌱 DF Adapted
                        </span>
                      )}
                      {matchInfo && matchInfo.matchPercentage > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs">
                          {matchInfo.matchPercentage}% Have On Hand
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/95 text-slate-800 shadow-xs flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      {recipe.prep_time} mins
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {recipe.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
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

                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {recipe.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {recipe.subtitle}
                    </p>

                    {recipe.version > 1 && recipe.version_notes && (
                      <div className="mt-2 p-2 rounded-lg bg-violet-50 border border-violet-200 text-[11px] text-violet-900">
                        <strong>AI Adaptation:</strong> {recipe.version_notes}
                      </div>
                    )}

                    {/* Match Summary Pill */}
                    {matchInfo &&
                      (matchInfo.matchedFridgeItems.length > 0 ||
                        matchInfo.matchedCabinetItems.length > 0) && (
                        <div className="mt-2.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-950">
                          <span className="font-bold text-emerald-800">
                            ✓ Have {matchInfo.matchedFridgeItems.length + matchInfo.matchedCabinetItems.length}/{matchInfo.totalIngredients} ingredients
                          </span>
                          {matchInfo.missingItems.length > 0 && (
                            <span className="text-slate-600">
                              {' '}
                              • Need {matchInfo.missingItems.length} more
                            </span>
                          )}
                        </div>
                      )}

                    {/* Scaled Ingredients Preview */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                        Scaled for {defaultServings} Servings (click ✨ blends for DIY recipe):
                      </p>
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
                              className={`text-[11px] px-2 py-0.5 rounded-md border ${
                                matchedBlend
                                  ? 'bg-amber-100 border-amber-300 text-amber-950 font-bold cursor-pointer hover:bg-amber-200'
                                  : ing.original_dairy_name
                                  ? 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                              title={
                                matchedBlend
                                  ? `Click to see how to make ${matchedBlend.name} at home`
                                  : ing.original_dairy_name
                                  ? `Substituted from ${ing.original_dairy_name}`
                                  : undefined
                              }
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    Cooking Cards
                  </button>

                  <button
                    onClick={() => {
                      onAddToPlan(recipe.id, selectedDayForAdd, defaultServings);
                      const nextIdx =
                        (DAYS_OF_WEEK.indexOf(selectedDayForAdd) + 1) %
                        DAYS_OF_WEEK.length;
                      setSelectedDayForAdd(DAYS_OF_WEEK[nextIdx]);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer"
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
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Load 24 More Recipes
              </button>
              <button
                onClick={() => setVisibleLimit(visibleRecipes.length)}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
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
