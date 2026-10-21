import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  Utensils,
  Wind,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  Recipe,
  ServingsSize,
  WeeklyPlanItem,
} from '../types/freshdiy';
import { formatAmount, transformIngredient } from '../utils/dairyEngine';

interface CatalogPlannerViewProps {
  recipes: Recipe[];
  weeklyPlan: WeeklyPlanItem[];
  defaultServings: ServingsSize;
  isDairyFree: boolean;
  onSetDefaultServings: (s: ServingsSize) => void;
  onAddToPlan: (recipeId: string, day: DayOfWeek, servings: ServingsSize) => void;
  onUpdatePlanServings: (planId: string, servings: ServingsSize) => void;
  onRemoveFromPlan: (planId: string) => void;
  onCompleteWeeklyPlan: () => void;
  onOpenCookingView: (recipe: Recipe, servings: ServingsSize) => void;
}

const FILTER_TAGS = [
  'All',
  'Kid-Friendly',
  'Under 30 Mins',
  'Sheet Pan',
  'Air Fryer',
  'Rice Cooker',
];

export const CatalogPlannerView: React.FC<CatalogPlannerViewProps> = ({
  recipes,
  weeklyPlan,
  defaultServings,
  isDairyFree,
  onSetDefaultServings,
  onAddToPlan,
  onUpdatePlanServings,
  onRemoveFromPlan,
  onCompleteWeeklyPlan,
  onOpenCookingView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [selectedDayForAdd, setSelectedDayForAdd] = useState<DayOfWeek>('Monday');
  const [showAllVersions, setShowAllVersions] = useState(false);

  const visibleRecipes = useMemo(() => {
    return recipes
      .filter((r) => (showAllVersions ? true : r.is_latest))
      .filter((r) => {
        if (activeTag !== 'All' && !r.tags.includes(activeTag)) {
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
  }, [recipes, activeTag, searchQuery, showAllVersions]);

  const plannedCount = weeklyPlan.length;
  const completedCount = weeklyPlan.filter((p) => p.status === 'completed').length;

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
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
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

      {/* Recipe Vault Search & Instant Filter Bar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 70+ HelloFresh recipes, ingredients, or blends..."
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
          {visibleRecipes.map((recipe) => {
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

                    {/* Scaled Ingredients Preview */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                        Scaled for {defaultServings} Servings:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {previewIngredients.map((ing, i) => (
                          <span
                            key={i}
                            className={`text-[11px] px-2 py-0.5 rounded-md border ${
                              ing.original_dairy_name
                                ? 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                                : ing.blend_name
                                ? 'bg-amber-50 border-amber-200 text-amber-900 font-medium'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                            title={
                              ing.original_dairy_name
                                ? `Substituted from ${ing.original_dairy_name}`
                                : undefined
                            }
                          >
                            {formatAmount(ing.amount)} {ing.unit} {ing.name}
                          </span>
                        ))}
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
                      // Advance target day automatically for fast weekly planning
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
      </section>
    </div>
  );
};
