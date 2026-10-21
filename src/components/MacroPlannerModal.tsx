import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChefHat,
  Dumbbell,
  Flame,
  KeyRound,
  Loader2,
  Plus,
  Refrigerator,
  Scale,
  Settings,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Target,
  Utensils,
  Wheat,
  X,
  Zap,
} from 'lucide-react';
import {
  CabinetItem,
  DAYS_OF_WEEK,
  DayOfWeek,
  MacroGoals,
  MacroMealSuggestion,
  Recipe,
  ServingsSize,
} from '../types/freshdiy';
import { suggestMacroMealsWithGemini } from '../utils/geminiClient';
import { suggestMacroMealsFallback } from '../utils/nutritionCostEngine';

interface MacroPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cabinet: CabinetItem[];
  onHandFridgeItems: string[];
  recipes: Recipe[];
  isDairyFree: boolean;
  geminiApiKey: string;
  defaultServings: ServingsSize;
  initialMacroGoals?: MacroGoals | null;
  onSaveMacroGoals?: (goals: MacroGoals) => void;
  onAddMacroMealToPlan: (
    suggestion: MacroMealSuggestion,
    day: DayOfWeek,
    servings: ServingsSize
  ) => void;
  onOpenFamilySettings?: () => void;
}

const PRESET_GOALS: {
  id: NonNullable<MacroGoals['dietStyle']>;
  label: string;
  desc: string;
  icon: string;
  goals: MacroGoals;
}[] = [
  {
    id: 'high_protein',
    label: 'High Protein',
    desc: '45g+ protein for muscle retention & lean growth',
    icon: '🥩',
    goals: {
      calories: 620,
      proteinGrams: 48,
      carbsGrams: 45,
      fatGrams: 18,
      dietStyle: 'high_protein',
    },
  },
  {
    id: 'deficit',
    label: 'Cut / Deficit',
    desc: 'Under 500 kcal with high satiety & protein',
    icon: '🔥',
    goals: {
      calories: 480,
      proteinGrams: 42,
      carbsGrams: 35,
      fatGrams: 14,
      dietStyle: 'deficit',
    },
  },
  {
    id: 'keto',
    label: 'Keto / Low Carb',
    desc: 'Under 20g net carbs with wholesome fats',
    icon: '🥑',
    goals: {
      calories: 640,
      proteinGrams: 40,
      carbsGrams: 16,
      fatGrams: 42,
      dietStyle: 'keto',
    },
  },
  {
    id: 'balanced',
    label: 'Balanced Energy',
    desc: 'Wholesome carbs, lean protein & healthy fats',
    icon: '⚖️',
    goals: {
      calories: 650,
      proteinGrams: 36,
      carbsGrams: 65,
      fatGrams: 22,
      dietStyle: 'balanced',
    },
  },
  {
    id: 'lean_bulk',
    label: 'Lean Bulk / Mass',
    desc: 'Fuel heavy workouts with high protein & clean carbs',
    icon: '🏋️',
    goals: {
      calories: 820,
      proteinGrams: 55,
      carbsGrams: 90,
      fatGrams: 26,
      dietStyle: 'lean_bulk',
    },
  },
];

export const MacroPlannerModal: React.FC<MacroPlannerModalProps> = ({
  isOpen,
  onClose,
  cabinet,
  onHandFridgeItems,
  recipes,
  isDairyFree,
  geminiApiKey,
  defaultServings,
  initialMacroGoals,
  onSaveMacroGoals,
  onAddMacroMealToPlan,
  onOpenFamilySettings,
}) => {
  const [goals, setGoals] = useState<MacroGoals>(() => {
    if (initialMacroGoals) return initialMacroGoals;
    return PRESET_GOALS[0].goals;
  });

  const [dairyFreeOverride, setDairyFreeOverride] = useState<boolean>(isDairyFree);
  const [customCravings, setCustomCravings] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MacroMealSuggestion[]>([]);
  const [addedMealIds, setAddedMealIds] = useState<Record<string, DayOfWeek>>({});
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');

  if (!isOpen) return null;

  // Inventory on-hand aggregation
  const freezerItems = cabinet
    .filter(
      (c) =>
        (c.category === 'Freezer & Deep Freeze' || (c.freezer_qty || 0) > 0) &&
        c.status !== 'out_of_stock'
    )
    .map((c) => c.item_name);

  const fridgeCabinetItems = cabinet
    .filter(
      (c) =>
        (c.category === 'Refrigerator' || (c.fridge_qty || 0) > 0) &&
        c.status !== 'out_of_stock'
    )
    .map((c) => c.item_name);

  const fridgeCombined = Array.from(
    new Set([...onHandFridgeItems, ...fridgeCabinetItems])
  );

  const pantryItems = cabinet
    .filter(
      (c) =>
        c.category !== 'Freezer & Deep Freeze' &&
        c.category !== 'Refrigerator' &&
        c.status !== 'out_of_stock'
    )
    .map((c) => c.item_name);

  const totalOnHandCount =
    freezerItems.length + fridgeCombined.length + pantryItems.length;

  const handleApplyPreset = (preset: typeof PRESET_GOALS[number]) => {
    const nextGoals: MacroGoals = {
      ...preset.goals,
      notes: customCravings,
    };
    setGoals(nextGoals);
    if (onSaveMacroGoals) onSaveMacroGoals(nextGoals);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const onHand = {
      freezer: freezerItems,
      fridge: fridgeCombined,
      pantry: pantryItems,
    };

    const currentGoalsWithNotes: MacroGoals = {
      ...goals,
      notes: customCravings.trim() || undefined,
    };

    if (onSaveMacroGoals) {
      onSaveMacroGoals(currentGoalsWithNotes);
    }

    try {
      if (geminiApiKey && geminiApiKey.trim()) {
        const results = await suggestMacroMealsWithGemini({
          macroGoals: currentGoalsWithNotes,
          onHandItems: onHand,
          isDairyFree: dairyFreeOverride,
          apiKey: geminiApiKey.trim(),
          catalogRecipes: recipes,
        });
        setSuggestions(results);
      } else {
        // Fallback rule engine
        const fallbackResults = suggestMacroMealsFallback({
          macroGoals: currentGoalsWithNotes,
          onHandItems: onHand,
          recipes,
          isDairyFree: dairyFreeOverride,
        });
        setSuggestions(fallbackResults);
      }
    } catch (err: any) {
      console.warn('AI generation error, using fallback:', err);
      setGenerationError(
        err.message || 'Gemini encountered an issue; matched via on-hand catalog rules.'
      );
      const fallbackResults = suggestMacroMealsFallback({
        macroGoals: currentGoalsWithNotes,
        onHandItems: onHand,
        recipes,
        isDairyFree: dairyFreeOverride,
      });
      setSuggestions(fallbackResults);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddMeal = (suggestion: MacroMealSuggestion) => {
    onAddMacroMealToPlan(suggestion, selectedDay, defaultServings);
    setAddedMealIds((prev) => ({
      ...prev,
      [suggestion.id]: selectedDay,
    }));
  };

  // Macro calorie contributions
  const proteinCals = goals.proteinGrams * 4;
  const carbCals = goals.carbsGrams * 4;
  const fatCals = goals.fatGrams * 9;
  const calcTotalCals = proteinCals + carbCals + fatCals;
  const proteinPct = calcTotalCals > 0 ? Math.round((proteinCals / calcTotalCals) * 100) : 30;
  const carbPct = calcTotalCals > 0 ? Math.round((carbCals / calcTotalCals) * 100) : 40;
  const fatPct = calcTotalCals > 0 ? Math.round((fatCals / calcTotalCals) * 100) : 30;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 via-orange-50/50 to-emerald-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Macro AI Kitchen Planner
                </h3>
                {geminiApiKey ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Gemini AI Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    Catalog Matching
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Hit target macros while prioritizing what is already in your house
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* On-Hand Inventory Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Ingredients On Hand in Your Kitchen:
                </span>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {totalOnHandCount} items
                </span>
              </div>
              <span className="text-[11px] text-slate-600">
                0 cost items used first to reduce grocery bills
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex items-center gap-2">
                <Snowflake className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-600">Freezer</div>
                  <div className="text-xs font-extrabold text-slate-800 truncate">
                    {freezerItems.length} items
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex items-center gap-2">
                <Refrigerator className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-600">Fridge</div>
                  <div className="text-xs font-extrabold text-slate-800 truncate">
                    {fridgeCombined.length} items
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex items-center gap-2">
                <Wheat className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-600">Pantry & Spices</div>
                  <div className="text-xs font-extrabold text-slate-800 truncate">
                    {pantryItems.length} items
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Goal Presets */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-amber-600" />
                1. Select Macro Goal Style
              </label>
              <span className="text-[11px] text-slate-600">Click a preset or customize below</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESET_GOALS.map((preset) => {
                const isActive = goals.dietStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-lg mb-1 block">{preset.icon}</span>
                      <div className="text-xs font-black text-slate-900 leading-tight">
                        {preset.label}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 font-medium leading-tight">
                      {preset.goals.proteinGrams}g P • {preset.goals.calories} kcal
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Macro Sliders & Visual Ratio */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                2. Fine-Tune Targets (Per Serving)
              </label>
              <div className="text-xs font-bold text-slate-600">
                Serving: <span className="text-emerald-700 font-black">{defaultServings} People</span>
              </div>
            </div>

            {/* Macro Ratio Bar */}
            <div className="space-y-1.5">
              <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                <div
                  style={{ width: `${proteinPct}%` }}
                  className="bg-red-500 transition-all duration-300"
                  title={`Protein: ${proteinPct}%`}
                />
                <div
                  style={{ width: `${carbPct}%` }}
                  className="bg-amber-400 transition-all duration-300"
                  title={`Carbs: ${carbPct}%`}
                />
                <div
                  style={{ width: `${fatPct}%` }}
                  className="bg-blue-400 transition-all duration-300"
                  title={`Fat: ${fatPct}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-0.5">
                <span className="flex items-center gap-1 text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  Protein {proteinPct}%
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Carbs {carbPct}%
                </span>
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  Fat {fatPct}%
                </span>
              </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Calories */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    Calories Target
                  </span>
                  <span className="text-slate-900 font-black">{goals.calories} kcal</span>
                </div>
                <input
                  type="range"
                  min="350"
                  max="1100"
                  step="25"
                  value={goals.calories}
                  onChange={(e) =>
                    setGoals((prev) => ({
                      ...prev,
                      calories: parseInt(e.target.value, 10),
                      dietStyle: undefined,
                    }))
                  }
                  className="w-full accent-orange-500 cursor-pointer"
                />
              </div>

              {/* Protein */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 flex items-center gap-1">
                    <Dumbbell className="w-3.5 h-3.5 text-red-500" />
                    Protein Target
                  </span>
                  <span className="text-red-700 font-black">{goals.proteinGrams}g</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="2"
                  value={goals.proteinGrams}
                  onChange={(e) =>
                    setGoals((prev) => ({
                      ...prev,
                      proteinGrams: parseInt(e.target.value, 10),
                      dietStyle: undefined,
                    }))
                  }
                  className="w-full accent-red-500 cursor-pointer"
                />
              </div>

              {/* Carbs */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 flex items-center gap-1">
                    <Wheat className="w-3.5 h-3.5 text-amber-500" />
                    Carbohydrates
                  </span>
                  <span className="text-amber-800 font-black">{goals.carbsGrams}g</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="130"
                  step="5"
                  value={goals.carbsGrams}
                  onChange={(e) =>
                    setGoals((prev) => ({
                      ...prev,
                      carbsGrams: parseInt(e.target.value, 10),
                      dietStyle: undefined,
                    }))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Fat */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    Healthy Fat
                  </span>
                  <span className="text-blue-700 font-black">{goals.fatGrams}g</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="2"
                  value={goals.fatGrams}
                  onChange={(e) =>
                    setGoals((prev) => ({
                      ...prev,
                      fatGrams: parseInt(e.target.value, 10),
                      dietStyle: undefined,
                    }))
                  }
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Dietary Toggle & Custom Notes */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dairyFreeOverride}
                  onChange={(e) => setDairyFreeOverride(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-700">
                  Strict Dairy-Free Substitution
                </span>
              </label>

              <div className="flex-1 sm:max-w-xs">
                <input
                  type="text"
                  placeholder="Notes or cravings (e.g. Mexican, quick, spicy)..."
                  value={customCravings}
                  onChange={(e) => setCustomCravings(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>

          {/* API Key Reminder if missing */}
          {!geminiApiKey && onOpenFamilySettings && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Using rule-based matching. Add a private Gemini API Key in Household Settings for unlimited custom AI meal generation.
                </span>
              </div>
              <button
                onClick={onOpenFamilySettings}
                className="text-xs font-bold text-amber-800 underline hover:text-amber-950 shrink-0 cursor-pointer"
              >
                Set Key
              </button>
            </div>
          )}

          {/* Generation Action Button */}
          <div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-600 hover:from-amber-600 hover:to-emerald-700 text-white font-black text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Gemini is analyzing your kitchen & calculating macros...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Suggest 3 Macro Meals from My Kitchen</span>
                </>
              )}
            </button>
          </div>

          {/* Results Section */}
          {suggestions.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Utensils className="w-4 h-4 text-emerald-600" />
                    Target Macro Matches
                  </h4>
                  <p className="text-xs text-slate-600">
                    Calculated for {goals.proteinGrams}g Protein • {goals.calories} kcal • {defaultServings} servings
                  </p>
                </div>

                {/* Day selector for 1-tap add */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Add to:</span>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
                    className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {suggestions.map((meal) => {
                  const isAdded = Boolean(addedMealIds[meal.id]);
                  const addedDay = addedMealIds[meal.id];

                  return (
                    <div
                      key={meal.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 shadow-xs transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-base font-black text-slate-900">
                              {meal.title}
                            </h5>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                              {meal.macroMatchScore}% Goal Match
                            </span>
                            {meal.prepTimeMinutes && (
                              <span className="text-[11px] font-bold text-slate-600">
                                ⏱️ {meal.prepTimeMinutes} mins
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">{meal.subtitle}</p>
                        </div>

                        {/* 1-Tap Add Button */}
                        <div className="shrink-0 pt-1 sm:pt-0">
                          {isAdded ? (
                            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              Added to {addedDay}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddMeal(meal)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add to {selectedDay} Plan
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Macro Pill Highlights */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-900 text-xs font-black flex items-center gap-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          {meal.nutrition.calories} kcal
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs font-black flex items-center gap-1">
                          <Dumbbell className="w-3 h-3 text-red-500" />
                          {meal.nutrition.proteinGrams}g Protein
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                          🌾 {meal.nutrition.carbsGrams}g Carbs
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
                          🥑 {meal.nutrition.fatGrams}g Fat
                        </span>
                        {meal.nutrition.fiberGrams !== undefined && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
                            🥗 {meal.nutrition.fiberGrams}g Fiber
                          </span>
                        )}
                      </div>

                      {/* Ingredients From Kitchen vs To Buy */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 space-y-1">
                          <div className="font-extrabold text-emerald-900 text-[11px] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            From Your Kitchen (0 Extra Cost):
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {meal.ingredientsFromHome.length > 0 ? (
                              meal.ingredientsFromHome.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-white text-emerald-800 text-[11px] font-medium border border-emerald-200"
                                >
                                  {item}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-600 italic">None</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 space-y-1">
                          <div className="font-extrabold text-amber-900 text-[11px] flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-amber-600" />
                            To Buy From Store:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {meal.ingredientsToBuy.length > 0 ? (
                              meal.ingredientsToBuy.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-white text-amber-900 text-[11px] font-medium border border-amber-200"
                                >
                                  {item}
                                </span>
                              ))
                            ) : (
                              <span className="text-emerald-700 font-bold">Everything already at home! 🎉</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Summary / Cooking note */}
                      {meal.cookingSummary && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <span className="font-bold text-slate-700">Prep tip: </span>
                          {meal.cookingSummary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            Targets save automatically for your household
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
