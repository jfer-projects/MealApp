import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Beaker,
  CheckCircle2,
  Clock,
  Flame,
  GitBranch,
  Heart,
  Pause,
  Play,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wind,
} from 'lucide-react';
import {
  CabinetItem,
  Recipe,
  RecipeFeedback,
  RecipeRating,
  ServingsSize,
} from '../types/freshdiy';
import {
  evaluateBlendStock,
  findBlendDefinition,
  HELLOFRESH_PROPRIETARY_BLENDS,
} from '../utils/blendDecoder';
import {
  formatAmount,
  transformIngredient,
  transformInstructions,
} from '../utils/dairyEngine';

interface CookingViewProps {
  recipe: Recipe;
  allVersions: Recipe[];
  cabinet?: CabinetItem[];
  servings: ServingsSize;
  isDairyFree: boolean;
  geminiApiKey?: string;
  currentUserDisplayName?: string;
  householdMembers?: string[];
  feedbackHistory: RecipeFeedback[];
  recipeRating?: RecipeRating;
  onToggleFavorite?: (recipeId: string) => void;
  onMarkRecipeCooked?: (recipe: Recipe, rating?: -1 | 0 | 1) => void;
  onChangeServings: (s: ServingsSize) => void;
  onSelectVersion: (r: Recipe) => void;
  onSubmitFeedbackAndFork: (
    recipe: Recipe,
    authorName: string,
    notes: string,
    geminiApiKey?: string
  ) => Promise<void> | void;
  onAddRecipeToGroceryList: (recipe: Recipe, servings: ServingsSize) => void;
  onOpenBlendModal: (blendName: string) => void;
  onBackToCatalog: () => void;
}

const QUICK_FEEDBACK_PRESETS = [
  'Too spicy for kids, cut chili powder by 50%',
  'Kids loved the sauce! Double garlic next time',
  'Cut Fry Seasoning by 50% for less salt',
  'Cook 5 minutes longer for extra crispy veggies',
  'Increase broccoli by 50% for the family',
];

export const CookingView: React.FC<CookingViewProps> = ({
  recipe,
  allVersions,
  cabinet = [],
  servings,
  isDairyFree,
  geminiApiKey = '',
  currentUserDisplayName = 'Me',
  householdMembers = [],
  feedbackHistory,
  recipeRating,
  onToggleFavorite,
  onMarkRecipeCooked,
  onChangeServings,
  onSelectVersion,
  onSubmitFeedbackAndFork,
  onAddRecipeToGroceryList,
  onOpenBlendModal,
  onBackToCatalog,
}) => {
  const [useAirFryer, setUseAirFryer] = useState(
    recipe.tags.includes('Air Fryer')
  );
  const [useRiceCooker, setUseRiceCooker] = useState(
    recipe.tags.includes('Rice Cooker')
  );
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>(
    {}
  );
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Screen Wake Lock API to prevent phone sleep while cooking
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        } catch {
          // wake lock denied or unsupported
        }
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Timer state per step number
  const [timers, setTimers] = useState<
    Record<number, { remaining: number; running: boolean; initial: number }>
  >({});

  const authorOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        [currentUserDisplayName, ...householdMembers]
          .map((n) => n.trim())
          .filter(Boolean)
      )
    );
    if (names.length < 2) {
      names.push('Partner / Family');
    }
    return names;
  }, [currentUserDisplayName, householdMembers]);

  // Post-meal AI Feedback & Versioning state
  const [authorName, setAuthorName] = useState<string>(
    () => authorOptions[0] || 'Family'
  );
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isForking, setIsForking] = useState(false);
  const [forkBanner, setForkBanner] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<
      number,
      { remaining: number; running: boolean; initial: number }
    > = {};
    for (const st of recipe.instructions_json) {
      if (st.timer_seconds) {
        init[st.step] = {
          remaining: st.timer_seconds,
          running: false,
          initial: st.timer_seconds,
        };
      }
    }
    setTimers(init);
    setCompletedSteps({});
  }, [recipe]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const stepKey of Object.keys(next)) {
          const k = Number(stepKey);
          const t = next[k];
          if (t && t.running && t.remaining > 0) {
            changed = true;
            next[k] = {
              ...t,
              remaining: t.remaining - 1,
              running: t.remaining - 1 > 0,
            };
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients_json.map((ing) =>
        transformIngredient(
          ing,
          recipe.base_servings || 4,
          servings,
          isDairyFree
        )
      ),
    [recipe, servings, isDairyFree]
  );

  const scaledInstructions = useMemo(
    () =>
      transformInstructions(
        recipe.instructions_json,
        recipe.base_servings || 4,
        servings,
        isDairyFree
      ),
    [recipe, servings, isDairyFree]
  );

  const hasAirFryerAdaptation = recipe.instructions_json.some(
    (s) => s.appliance_override?.air_fryer
  );
  const hasRiceCookerAdaptation = recipe.instructions_json.some(
    (s) => s.appliance_override?.rice_cooker
  );

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackNotes.trim()) return;
    setIsForking(true);
    try {
      await onSubmitFeedbackAndFork(recipe, authorName, feedbackNotes.trim(), geminiApiKey);
      setForkBanner(
        `✨ Custom recipe v${recipe.version + 1} created based on ${authorName}'s notes!`
      );
      setFeedbackNotes('');
      setTimeout(() => setForkBanner(null), 6000);
    } finally {
      setIsForking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Navigation & Recipe Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Recipe Vault
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {wakeLockActive && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold shadow-xs">
              <Sun className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Screen Kept Awake</span>
            </span>
          )}

          <button
            onClick={() => onAddRecipeToGroceryList(recipe, servings)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Add Recipe to Grocery List</span>
          </button>

          {/* Version Switcher */}
          {allVersions.length > 1 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <GitBranch className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-slate-600">
                Recipe Version:
              </span>
              {allVersions.map((ver) => (
                <button
                  key={ver.id}
                  onClick={() => onSelectVersion(ver)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ver.id === recipe.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  v{ver.version} {ver.is_latest ? '(Latest)' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {forkBanner && (
        <div className="p-4 rounded-2xl bg-violet-600 text-white text-sm font-bold flex items-center gap-2 shadow-md">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{forkBanner}</span>
        </div>
      )}

      {/* Hero Header Card */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-3">
        <div className="h-64 lg:h-auto bg-slate-200 relative">
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            {recipe.version > 1 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-violet-600 text-white shadow-xs">
                Version v{recipe.version}
              </span>
            )}
            {isDairyFree && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-600 text-white shadow-xs">
                🌱 Dairy-Free Active
              </span>
            )}
          </div>
        </div>

        <div className="p-6 lg:col-span-2 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {recipe.title}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{recipe.subtitle}</p>

            {recipe.version_notes && (
              <div className="mt-3 p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-900">
                <strong>Version v{recipe.version} Notes:</strong>{' '}
                {recipe.version_notes}
              </div>
            )}
          </div>

          {/* Interactive Controls: Servings & Appliance Diversion Toggles */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 px-2.5 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Scale Servings:
              </span>
              {([2, 4, 6] as ServingsSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => onChangeServings(size)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    servings === size
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size} Servings
                </button>
              ))}
            </div>

            {hasAirFryerAdaptation && (
              <button
                onClick={() => setUseAirFryer(!useAirFryer)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  useAirFryer
                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <Wind className="w-4 h-4" />
                Air Fryer Adaptation: {useAirFryer ? 'ON' : 'OFF'}
              </button>
            )}

            {hasRiceCookerAdaptation && (
              <button
                onClick={() => setUseRiceCooker(!useRiceCooker)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  useRiceCooker
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <Flame className="w-4 h-4" />
                Rice Cooker Adaptation: {useRiceCooker ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Split: Scaled Ingredients Sidebar + Step-by-Step Cooking Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scaled & Dairy-Substituted Ingredients */}
        <aside className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Ingredients ({servings} Servings)
            </h2>
            <span className="text-xs text-slate-400">
              Click any ✨ blend for DIY recipe
            </span>
          </div>

          <ul className="space-y-2.5">
            {scaledIngredients.map((ing, idx) => {
              const matchedBlend = findBlendDefinition(
                ing.blend_name || ing.name
              );
              const blendEval = matchedBlend
                ? evaluateBlendStock(matchedBlend.name, cabinet)
                : null;
              const isBlendReady =
                blendEval && blendEval.overallStatus !== 'missing_items';

              return (
                <li
                  key={idx}
                  onClick={() => {
                    if (matchedBlend) {
                      onOpenBlendModal(matchedBlend.name);
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                    matchedBlend
                      ? isBlendReady
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 cursor-pointer hover:bg-emerald-100/70'
                        : 'bg-amber-50/80 border-amber-300 text-amber-950 cursor-pointer hover:bg-amber-100/80'
                      : ing.original_dairy_name
                      ? 'bg-teal-50/70 border-teal-200 text-teal-950'
                      : 'bg-slate-50/70 border-slate-200/80 text-slate-800'
                  }`}
                >
                  <div>
                    <span className="font-bold">{ing.name}</span>
                    {ing.original_dairy_name && (
                      <span className="block text-[10px] text-teal-700 font-medium">
                        🌱 {ing.substitution_note}
                      </span>
                    )}
                    {matchedBlend && blendEval && (
                      <span
                        className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isBlendReady
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-200/80 text-slate-800'
                        }`}
                      >
                        <Beaker className="w-3 h-3" />{' '}
                        {isBlendReady
                          ? `Ready to Mix (${matchedBlend.name})`
                          : `Make it yourself (${matchedBlend.name})`}
                      </span>
                    )}
                  </div>
                  <span className="font-extrabold text-slate-900 ml-2 shrink-0">
                    {formatAmount(ing.amount)} {ing.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Interactive Step-by-Step Cooking Cards */}
        <div className="lg:col-span-2 space-y-4">
          {scaledInstructions.map((step) => {
            const isDone = Boolean(completedSteps[step.step]);
            const timer = timers[step.step];

            // Detect any proprietary blends mentioned inside this cooking step!
            const stepBlends = HELLOFRESH_PROPRIETARY_BLENDS.filter(
              (b) =>
                step.body.toLowerCase().includes(b.name.toLowerCase()) ||
                b.aliases?.some((al) =>
                  step.body.toLowerCase().includes(al.toLowerCase())
                )
            );

            // Determine active instruction text based on Appliance Adaptations
            const airFryerText =
              useAirFryer && step.appliance_override?.air_fryer
                ? step.appliance_override.air_fryer
                : null;
            const riceCookerText =
              useRiceCooker && step.appliance_override?.rice_cooker
                ? step.appliance_override.rice_cooker
                : null;

            return (
              <div
                key={step.step}
                className={`rounded-2xl border p-5 bg-white shadow-xs transition ${
                  isDone
                    ? 'border-emerald-300 bg-emerald-50/30 opacity-80'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center">
                      {step.step}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {step.title}
                    </h3>
                  </div>

                  <button
                    onClick={() =>
                      setCompletedSteps((prev) => ({
                        ...prev,
                        [step.step]: !prev[step.step],
                      }))
                    }
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isDone ? 'Completed' : 'Mark Done'}
                  </button>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {step.body}
                </p>

                {/* Clickable DIY Blend Buttons inside Step Card */}
                {stepBlends.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stepBlends.map((b) => (
                      <button
                        key={b.name}
                        onClick={() => onOpenBlendModal(b.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold transition cursor-pointer"
                      >
                        <Beaker className="w-3.5 h-3.5 text-amber-700" />
                        How to make {b.name} ({b.yieldNote.split(':')[1]?.trim() || 'View DIY Formula'})
                      </button>
                    ))}
                  </div>
                )}

                {/* Appliance Diversion Callouts */}
                {airFryerText && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                    <Wind className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">
                        Air Fryer Diversion Step:
                      </strong>{' '}
                      {airFryerText}
                    </div>
                  </div>
                )}

                {riceCookerText && (
                  <div className="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start gap-2">
                    <Flame className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">
                        Rice Cooker Diversion Step:
                      </strong>{' '}
                      {riceCookerText}
                    </div>
                  </div>
                )}

                {/* Interactive Step Countdown Timer */}
                {timer && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="font-mono text-sm font-extrabold text-slate-900">
                        {formatTimer(timer.remaining)}
                      </span>
                      {timer.remaining === 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                          🔔 Timer Done!
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          setTimers((prev) => ({
                            ...prev,
                            [step.step]: {
                              ...prev[step.step],
                              running: !prev[step.step].running,
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                      >
                        {timer.running ? (
                          <>
                            <Pause className="w-3 h-3" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" /> Start Timer
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setTimers((prev) => ({
                            ...prev,
                            [step.step]: {
                              ...prev[step.step],
                              running: false,
                              remaining: prev[step.step].initial,
                            },
                          }))
                        }
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Mark Meal as Cooked & Family Rating Bar */}
          {onMarkRecipeCooked && (
            <section className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Finished Cooking Dinner?
                  {recipeRating?.times_cooked ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      Cooked {recipeRating.times_cooked}x
                    </span>
                  ) : null}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Mark this meal cooked to automatically deduct used packages from your Fridge, Deep Freezer &amp; Pantry inventory.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(recipe.original_id || recipe.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                      recipeRating?.is_favorite
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:text-rose-600'
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        recipeRating?.is_favorite ? 'fill-current' : ''
                      }`}
                    />
                    {recipeRating?.is_favorite ? 'Favorited' : 'Favorite'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onMarkRecipeCooked(recipe, 1)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Cooked &amp; Loved It!
                </button>

                <button
                  type="button"
                  onClick={() => onMarkRecipeCooked(recipe, -1)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 text-xs font-bold transition cursor-pointer"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Cooked (Pass Next Time)
                </button>
              </div>
            </section>
          )}

          {/* AI Recipe Versioning & Feedback Loop Card */}
          <section className="rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-600 text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Post-Meal Family Feedback &amp; AI Recipe Versioning (v{recipe.version} ➔ v{recipe.version + 1})
                  </h3>
                  <p className="text-xs text-slate-600">
                    Log notes from you or a family member. The AI agent will automatically fork this recipe JSON, adjust ingredient quantities &amp; step instructions, and publish <strong>v{recipe.version + 1}</strong> as the new default!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_FEEDBACK_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFeedbackNotes(preset)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 text-[11px] font-medium text-violet-900 hover:bg-violet-100 transition cursor-pointer"
                >
                  &ldquo;{preset}&rdquo;
                </button>
              ))}
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-violet-200 bg-white text-xs font-bold text-slate-800"
                >
                  {authorOptions.map((name) => (
                    <option key={name} value={name}>
                      Note from {name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder='e.g. "Too spicy for kids, cut chili powder by 50%"'
                  className="flex-1 px-4 py-2 rounded-xl border border-violet-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Fork &amp; Publish v{recipe.version + 1}
                </button>
              </div>
            </form>

            {feedbackHistory.length > 0 && (
              <div className="pt-3 border-t border-violet-200/60 space-y-2">
                <p className="text-xs font-bold text-violet-900">
                  Family Feedback &amp; Fork History:
                </p>
                {feedbackHistory.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-2.5 rounded-xl bg-white border border-violet-100 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {fb.author_name}:
                      </span>{' '}
                      <span className="text-slate-700">&ldquo;{fb.notes}&rdquo;</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {fb.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
