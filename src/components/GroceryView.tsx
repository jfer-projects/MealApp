import React, { useMemo, useState } from 'react';
import {
  Beaker,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  DollarSign,
  Heart,
  Mail,
  MessageSquareShare,
  Plus,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  Users,
  Utensils,
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
import { formatAmount } from '../utils/dairyEngine';
import { formatWeekRange } from '../utils/dateUtils';
import {
  buildAggregatedGroceryList,
  formatGroceryListForValleria,
  sortAisles,
} from '../utils/groceryEngine';
import {
  computeWeeklySavings,
  estimateRecipeNutrition,
} from '../utils/nutritionCostEngine';

interface GroceryViewProps {
  weeklyPlan: WeeklyPlanItem[];
  recipes: Recipe[];
  cabinet: CabinetItem[];
  extras: GroceryExtra[];
  isDairyFree: boolean;
  defaultServings: ServingsSize;
  activeWeekStartDate: string;
  onNavigateWeek: (offset: number) => void;
  activeFamilyMember: 'Parent' | 'Valleria';
  onChangeFamilyMember: (member: 'Parent' | 'Valleria') => void;
  valleriaEmail: string;
  onSetValleriaEmail: (email: string) => void;
  valleriaPhone: string;
  onSetValleriaPhone: (phone: string) => void;
  checkedGroceryKeys: Record<string, boolean>;
  onToggleGroceryKey: (key: string) => void;
  onAddExtra: (itemName: string, aisle: string) => void;
  onToggleExtra: (id: string) => void;
  onDeleteExtra: (id: string) => void;
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
  valleriaEmail,
  onSetValleriaEmail,
  valleriaPhone,
  onSetValleriaPhone,
  checkedGroceryKeys,
  onToggleGroceryKey,
  onAddExtra,
  onToggleExtra,
  onDeleteExtra,
  onAddToPlan,
  onRemoveFromPlan,
  onUpdatePlanServings,
  onOpenBlendModal,
}) => {
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraQty, setNewExtraQty] = useState('');
  const [newExtraAisle, setNewExtraAisle] = useState('Household & Extras');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showSmsPreview, setShowSmsPreview] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Filter weekly plan items for the active week
  const currentWeekPlan = useMemo(
    () => weeklyPlan.filter((p) => p.week_start_date === activeWeekStartDate),
    [weeklyPlan, activeWeekStartDate]
  );

  const currentWeekExtras = useMemo(
    () => extras.filter((e) => e.week_start_date === activeWeekStartDate),
    [extras, activeWeekStartDate]
  );

  const aggregated = useMemo(
    () =>
      buildAggregatedGroceryList(currentWeekPlan, recipes, cabinet, isDairyFree),
    [currentWeekPlan, recipes, cabinet, isDairyFree]
  );

  const groupedByAisle = useMemo(() => {
    const groups = new Map<string, typeof aggregated>();
    for (const item of aggregated) {
      const list = groups.get(item.aisle) || [];
      list.push(item);
      groups.set(item.aisle, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => sortAisles(a, b));
  }, [aggregated]);

  const smsText = useMemo(
    () => formatGroceryListForValleria(aggregated, currentWeekExtras, isDairyFree, false),
    [aggregated, currentWeekExtras, isDairyFree]
  );

  // Cost and Nutrition Aggregations
  const savings = useMemo(
    () => computeWeeklySavings(currentWeekPlan, recipes),
    [currentWeekPlan, recipes]
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
      setShareFeedback(`Opened SMS to Valleria (${valleriaPhone}) & copied list!`);
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
    setShareFeedback('Opened email client for Valleria!');
    setTimeout(() => setShareFeedback(null), 3500);
  };

  const handleAddExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtraName.trim()) return;
    const label = newExtraQty.trim()
      ? `${newExtraQty.trim()} — ${newExtraName.trim()}`
      : newExtraName.trim();
    onAddExtra(label, newExtraAisle);
    setNewExtraName('');
    setNewExtraQty('');
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

  return (
    <div className="space-y-6 pb-8">
      {/* 1. DATED WEEK NAVIGATION & SHOPPER PROFILE BAR */}
      <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Week Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => onNavigateWeek(-1)}
              className="p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 text-center min-w-[170px]">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                Grocery List Week
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center justify-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {formatWeekRange(activeWeekStartDate)}
              </span>
            </div>
            <button
              onClick={() => onNavigateWeek(1)}
              className="p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-700 shadow-2xs transition cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Shopper Mode Selector (You vs Valleria) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
              <User className="w-3 h-3" /> Shopping As:
            </span>
            <button
              onClick={() => onChangeFamilyMember('Parent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeFamilyMember === 'Parent'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              You (Parent)
            </button>
            <button
              onClick={() => onChangeFamilyMember('Valleria')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeFamilyMember === 'Valleria'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Valleria
            </button>
          </div>

          {/* Free Email / Share Sheet Triggers */}
          <button
            onClick={handleEmailToValleria}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer"
            title="Send list via email for free"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-600" />
            Email List (Free)
          </button>

          <button
            onClick={handleSendToValleria}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Send to Valleria
          </button>
        </div>
      </section>

      {/* 2. FAMILY NUTRITION & COST SAVINGS RADAR */}
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

      {shareFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm">
          <span>✅ {shareFeedback}</span>
        </div>
      )}

      {showSmsPreview && (
        <section className="bg-slate-900 text-slate-100 rounded-3xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              📱 Live Share / Email Payload for Valleria
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
                      + Add ({defaultServings}p)
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
                        {s}p
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
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Household Essentials &amp; Weekly Extras
            </h3>
            <p className="text-xs text-slate-500">
              Add everyday items for {formatWeekRange(activeWeekStartDate)}.
            </p>
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

          {currentWeekExtras.length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
              {currentWeekExtras.map((ex) => (
                <div
                  key={ex.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs ${
                    ex.checked
                      ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                      : 'bg-emerald-50/70 border-emerald-200 text-slate-900 font-bold'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={ex.checked}
                    onChange={() => onToggleExtra(ex.id)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>
                    {ex.item_name}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({ex.aisle})
                    </span>
                  </span>
                  <button
                    onClick={() => onDeleteExtra(ex.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 4. AISLE-SORTED AGGREGATED RECIPE INGREDIENTS */}
      {currentWeekPlan.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-2">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            No Meals Scheduled for {formatWeekRange(activeWeekStartDate)}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Use the search box above or the Planner tab to schedule recipes for this week!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {groupedByAisle.map(([aisle, items]) => (
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
                  {items.length} items
                </span>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const isChecked = Boolean(checkedGroceryKeys[item.key]);
                  const isCrossed = item.isStruckByCabinet || isChecked;
                  const matchedBlend = findBlendDefinition(
                    item.blendBreakdown?.blendName || item.name
                  );

                  return (
                    <div
                      key={item.key}
                      onClick={() => onToggleGroceryKey(item.key)}
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
                                isCrossed
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {formatAmount(item.totalAmount)} {item.unit}{' '}
                              {item.name}
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
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
