import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MessageSquareShare,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CabinetItem,
  GroceryExtra,
  Recipe,
  WeeklyPlanItem,
} from '../types/freshdiy';
import { formatAmount } from '../utils/dairyEngine';
import {
  buildAggregatedGroceryList,
  formatGroceryListForValleria,
  sortAisles,
} from '../utils/groceryEngine';

interface GroceryViewProps {
  weeklyPlan: WeeklyPlanItem[];
  recipes: Recipe[];
  cabinet: CabinetItem[];
  extras: GroceryExtra[];
  isDairyFree: boolean;
  valleriaPhone: string;
  onSetValleriaPhone: (phone: string) => void;
  onAddExtra: (itemName: string, aisle: string) => void;
  onToggleExtra: (id: string) => void;
  onDeleteExtra: (id: string) => void;
}

export const GroceryView: React.FC<GroceryViewProps> = ({
  weeklyPlan,
  recipes,
  cabinet,
  extras,
  isDairyFree,
  valleriaPhone,
  onSetValleriaPhone,
  onAddExtra,
  onToggleExtra,
  onDeleteExtra,
}) => {
  const [checkedKeys, setCheckedKeys] = useState<Record<string, boolean>>({});
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraAisle, setNewExtraAisle] = useState('Household & Extras');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [showSmsPreview, setShowSmsPreview] = useState(false);

  const aggregated = useMemo(
    () =>
      buildAggregatedGroceryList(weeklyPlan, recipes, cabinet, isDairyFree),
    [weeklyPlan, recipes, cabinet, isDairyFree]
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
    () => formatGroceryListForValleria(aggregated, extras, isDairyFree, false),
    [aggregated, extras, isDairyFree]
  );

  const handleSendToValleria = async () => {
    // 1. Try native Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FreshDIY Grocery List for Valleria',
          text: smsText,
        });
        setShareFeedback('Shared via Web Share API!');
        setTimeout(() => setShareFeedback(null), 3500);
        return;
      } catch {
        // Fallback to SMS or clipboard if user cancelled modal
      }
    }

    // 2. If phone number is entered, open native SMS link + copy to clipboard
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
      setShareFeedback('Copied Valleria Grocery List to clipboard!');
    }
    setTimeout(() => setShareFeedback(null), 4000);
  };

  const handleAddExtraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtraName.trim()) return;
    onAddExtra(newExtraName.trim(), newExtraAisle);
    setNewExtraName('');
  };

  const activeBuyCount = aggregated.filter((i) => !i.isStruckByCabinet).length;
  const cabinetSavedCount = aggregated.filter((i) => i.isStruckByCabinet).length;
  const dairyAltCount = aggregated.filter((i) => i.isSubstitutedDairy).length;

  return (
    <div className="space-y-8">
      {/* Header & "Send to Valleria" Action Bar */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Smart Aggregated Grocery List
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              {activeBuyCount} Items to Buy
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {cabinetSavedCount} Struck by Cabinet
            </span>
            {isDairyFree && dairyAltCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                🌱 {dairyAltCount} Routed to Dairy Alternatives
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Automatically scaled for your weekly meal servings, deduplicated across recipes, and cross-checked against your Spice Cabinet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="tel"
            value={valleriaPhone}
            onChange={(e) => onSetValleriaPhone(e.target.value)}
            placeholder="Valleria's mobile (optional SMS)"
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button
            onClick={() => setShowSmsPreview(!showSmsPreview)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            <MessageSquareShare className="w-4 h-4 text-emerald-600" />
            {showSmsPreview ? 'Hide Text Preview' : 'Preview Text'}
          </button>

          <button
            onClick={handleSendToValleria}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Send to Valleria
          </button>
        </div>
      </section>

      {shareFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-sm">
          <span>✅ {shareFeedback}</span>
        </div>
      )}

      {showSmsPreview && (
        <section className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              📱 Live SMS / Web Share Payload for Valleria
            </span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(smsText);
                setShareFeedback('Copied formatted SMS payload!');
                setTimeout(() => setShareFeedback(null), 3000);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Text
            </button>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800 max-h-80 overflow-y-auto">
            {smsText}
          </pre>
        </section>
      )}

      {/* Custom Household Extras for Valleria */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Household Extras (Included in &ldquo;Send to Valleria&rdquo;)
            </h3>
            <p className="text-xs text-slate-500">
              Add kid snacks, paper towels, fruit, or lunchbox items to share alongside recipe ingredients.
            </p>
          </div>

          <form onSubmit={handleAddExtraSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
              placeholder="e.g., Kids Oat Milk Boxes, Apples..."
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-60 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={newExtraAisle}
              onChange={(e) => setNewExtraAisle(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="Household & Extras">Household &amp; Extras</option>
              <option value="Produce">Produce</option>
              <option value="Dairy Alternatives">Dairy Alternatives</option>
              <option value="Grains & Bakery">Grains &amp; Bakery</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Extra
            </button>
          </form>
        </div>

        {extras.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {extras.map((ex) => (
              <div
                key={ex.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                  ex.checked
                    ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                    : 'bg-emerald-50/60 border-emerald-200 text-slate-800 font-medium'
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
                  <span className="text-[10px] text-slate-400">
                    ({ex.aisle})
                  </span>
                </span>
                <button
                  onClick={() => onDeleteExtra(ex.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Aisle-Sorted Aggregated Recipe Ingredients */}
      {weeklyPlan.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            No Meals in Your Weekly Plan Yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Head to the Catalog &amp; Planner tab to add meals to your week. Your ingredients will automatically scale, substitute dairy, and deduplicate here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {groupedByAisle.map(([aisle, items]) => (
            <div
              key={aisle}
              className={`rounded-2xl border p-5 bg-white shadow-xs space-y-3 ${
                aisle === 'Dairy Alternatives'
                  ? 'border-teal-300 ring-1 ring-teal-500/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    {aisle}
                  </h3>
                  {aisle === 'Dairy Alternatives' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-Routed DF
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {items.length} items
                </span>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const isUserChecked = Boolean(checkedKeys[item.key]);
                  const isCrossed = item.isStruckByCabinet || isUserChecked;

                  return (
                    <div
                      key={item.key}
                      onClick={() =>
                        setCheckedKeys((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                        isCrossed
                          ? 'bg-slate-50 border-slate-200/70 opacity-65'
                          : item.isSubstitutedDairy
                          ? 'bg-teal-50/40 border-teal-200 hover:bg-teal-50'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border ${
                            isCrossed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
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
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                                {item.substitutionNote}
                              </span>
                            )}

                            {item.isStruckByCabinet && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                In Cabinet Stock
                              </span>
                            )}

                            {item.cabinetStatus === 'low' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Low in Cabinet
                              </span>
                            )}
                          </div>

                          {item.blendBreakdown && (
                            <p className="text-[11px] text-amber-800 mt-0.5 font-medium">
                              {item.blendBreakdown.canMakeFromCabinet
                                ? `✨ DIY Blend: All base spices for ${item.blendBreakdown.blendName} are in your Cabinet!`
                                : `⚠️ DIY Blend Missing Base Spices: ${item.blendBreakdown.missingSpices.join(', ')}`}
                            </p>
                          )}

                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Used in: {item.fromRecipes.join(', ')}
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
