import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  Camera,
  CheckCircle2,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Refrigerator,
  Search,
  ShoppingCart,
  Snowflake,
  Trash2,
  XCircle,
} from 'lucide-react';
import { CabinetItem, StockStatus } from '../types/freshdiy';
import {
  evaluateBlendStock,
  HELLOFRESH_PROPRIETARY_BLENDS,
} from '../utils/blendDecoder';

interface CabinetViewProps {
  cabinet: CabinetItem[];
  onUpdateStatus: (id: string, status: StockStatus) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems?: () => void;
  onAddCabinetItem: (
    name: string,
    category: CabinetItem['category'],
    status: StockStatus
  ) => void;
  onRestockAllLowAndOut: () => void;
  onAddExtraToGrocery: (itemName: string, aisle: string) => void;
  onOpenPhotoScanner: (mode?: 'cabinet' | 'fridge' | 'freezer') => void;
  onOpenBlendModal: (blendName: string) => void;
}

const CATEGORIES: CabinetItem['category'][] = [
  'Spices',
  'Sauces',
  'Broth Concentrates',
  'Oils & Vinegars',
  'Pantry',
  'Refrigerator',
  'Freezer & Deep Freeze',
];

export const CabinetView: React.FC<CabinetViewProps> = ({
  cabinet,
  onUpdateStatus,
  onDeleteItem,
  onClearAllItems,
  onAddCabinetItem,
  onRestockAllLowAndOut,
  onAddExtraToGrocery,
  onOpenPhotoScanner,
  onOpenBlendModal,
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [newCategory, setNewCategory] =
    useState<CabinetItem['category']>('Spices');
  const [activeZone, setActiveZone] = useState<'all' | 'pantry' | 'fridge' | 'freezer'>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'in_stock' | 'out_of_stock' | 'low'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    onAddCabinetItem(newItemName.trim(), newCategory, 'in_stock');
    setNewItemName('');
  };

  const outItems = useMemo(
    () => cabinet.filter((c) => c.status === 'out_of_stock'),
    [cabinet]
  );
  const lowItems = useMemo(
    () => cabinet.filter((c) => c.status === 'low'),
    [cabinet]
  );
  const inStockCount = cabinet.filter((c) => c.status === 'in_stock').length;

  const filteredCabinet = useMemo(() => {
    return cabinet.filter((item) => {
      // Zone filter: Pantry vs Fridge vs Freezer
      if (activeZone === 'freezer' && item.category !== 'Freezer & Deep Freeze') return false;
      if (activeZone === 'fridge' && item.category !== 'Refrigerator') return false;
      if (activeZone === 'pantry' && (item.category === 'Refrigerator' || item.category === 'Freezer & Deep Freeze')) return false;

      // Specific Category filter
      if (
        activeCategoryFilter !== 'All' &&
        item.category !== activeCategoryFilter
      ) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      // Search
      if (
        searchQuery.trim() &&
        !item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [cabinet, activeZone, activeCategoryFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-8">
      {/* Mobile-First Header & AI Camera Photo Scanner CTA */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            Kitchen &amp; Deep Freezer Inventory
          </div>
          <h2 className="text-xl font-black tracking-tight">
            Household Inventory &amp; Restock Radar
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Keep track of your deep freezer, refrigerator, and pantry shelves. Snap photos to auto-import items with AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenPhotoScanner('freezer')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            title="Scan Deep Freezer contents"
          >
            <Snowflake className="w-4 h-4" />
            Scan Freezer
          </button>
          <button
            onClick={() => onOpenPhotoScanner('cabinet')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer shrink-0 active:scale-98"
          >
            <Camera className="w-4 h-4" />
            Scan Pantry/Spices
          </button>
        </div>
      </section>

      {/* 🚨 HIGH-VISIBILITY "RAN OUT / RUNNING LOW" ALERT HUB */}
      {(outItems.length > 0 || lowItems.length > 0) && (
        <section className="rounded-3xl border-2 border-rose-200 bg-gradient-to-br from-rose-50/90 via-white to-amber-50/60 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    Ingredients You Have Run Out Of / Running Low
                  </h3>
                  {outItems.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-600 text-white">
                      {outItems.length} Out of Stock
                    </span>
                  )}
                  {lowItems.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-white">
                      {lowItems.length} Running Low
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Send missing items straight to your grocery list or mark them restocked once replenished.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  [...outItems, ...lowItems].forEach((item) =>
                    onAddExtraToGrocery(item.item_name, item.category === 'Freezer & Deep Freeze' ? 'Meat & Seafood' : 'Spices & Pantry')
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Add All ({outItems.length + lowItems.length}) to Grocery List
              </button>

              <button
                onClick={onRestockAllLowAndOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                Mark All Restocked
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {[...outItems, ...lowItems].map((item) => {
              const isOut = item.status === 'out_of_stock';
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    isOut
                      ? 'bg-rose-50/90 border-rose-300'
                      : 'bg-amber-50/90 border-amber-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOut ? 'bg-rose-600' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-sm font-black text-slate-900 truncate">
                        {item.item_name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider block mt-0.5 ${
                        isOut ? 'text-rose-700' : 'text-amber-800'
                      }`}
                    >
                      {isOut ? '🚨 RAN OUT' : '⚠️ RUNNING LOW'} • {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        onAddExtraToGrocery(item.item_name, item.category === 'Freezer & Deep Freeze' ? 'Meat & Seafood' : 'Spices & Pantry')
                      }
                      className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Add to Grocery List"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" /> Buy
                    </button>
                    <button
                      onClick={() => onUpdateStatus(item.id, 'in_stock')}
                      className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                    >
                      ✓ In
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                      title="Remove item from inventory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Household Inventory Tracker */}
      <section className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Top Location Tabs (All vs Pantry vs Fridge vs Freezer) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
            <button
              onClick={() => {
                setActiveZone('all');
                setActiveCategoryFilter('All');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeZone === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({cabinet.length})
            </button>
            <button
              onClick={() => {
                setActiveZone('pantry');
                setActiveCategoryFilter('All');
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeZone === 'pantry'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              Pantry &amp; Spices
            </button>
            <button
              onClick={() => {
                setActiveZone('fridge');
                setActiveCategoryFilter('All');
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeZone === 'fridge'
                  ? 'bg-white text-blue-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Refrigerator className="w-3.5 h-3.5 text-blue-600" />
              Refrigerator
            </button>
            <button
              onClick={() => {
                setActiveZone('freezer');
                setActiveCategoryFilter('All');
              }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeZone === 'freezer'
                  ? 'bg-white text-cyan-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
              Deep Freezer
            </button>
          </div>

          {/* Clean Slate Action */}
          {onClearAllItems && cabinet.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear all items from your inventory? This lets you start fresh with only what is currently in your household.')) {
                  onClearAllItems();
                }
              }}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer inline-flex items-center gap-1 transition self-end sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All &amp; Start Clean
            </button>
          )}
        </div>

        {/* Status Filter Pills & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                statusFilter === 'in_stock'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              ✅ In Stock / In Household ({inStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                statusFilter === 'low'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              ⚠️ Low ({lowItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                statusFilter === 'out_of_stock'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              🚨 Out ({outItems.length})
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pantry, fridge & freezer..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
            />
          </div>
        </div>

        {/* Category Pills & Add Item Form */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['All', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategoryFilter === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g. Chicken Breasts, Oregano..."
              className="flex-1 sm:w-48 px-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as CabinetItem['category'])
              }
              className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5" /> Add
            </button>
          </form>
        </div>

        {/* Items Grid with In/Low/Out & Delete Button */}
        {filteredCabinet.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No items match your filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Add items manually using the input bar above, or snap a photo of your shelves.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredCabinet.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                  item.status === 'out_of_stock'
                    ? 'bg-rose-50/50 border-rose-200'
                    : item.status === 'low'
                    ? 'bg-amber-50/50 border-amber-200'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {item.item_name}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    {item.category === 'Freezer & Deep Freeze' && <Snowflake className="w-3 h-3 text-cyan-600" />}
                    {item.category === 'Refrigerator' && <Refrigerator className="w-3 h-3 text-blue-600" />}
                    <span>{item.category}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                  {(
                    [
                      { val: 'in_stock', label: 'In' },
                      { val: 'low', label: 'Low' },
                      { val: 'out_of_stock', label: 'Out' },
                    ] as { val: StockStatus; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => onUpdateStatus(item.id, opt.val)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                        item.status === opt.val
                          ? opt.val === 'in_stock'
                            ? 'bg-emerald-600 text-white'
                            : opt.val === 'low'
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-600 text-white'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-0.5"
                    title={`Delete ${item.item_name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* HelloFresh Proprietary Blend Decoder */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl bg-amber-100 text-amber-800">
            <Beaker className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              HelloFresh Proprietary Blend &amp; Glaze Decoder
            </h3>
            <p className="text-xs text-slate-500">
              Tap any blend card to open full DIY mixing instructions and check missing base spices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HELLOFRESH_PROPRIETARY_BLENDS.map((blend) => {
            const evalResult = evaluateBlendStock(blend.name, cabinet);
            if (!evalResult) return null;

            return (
              <div
                key={blend.name}
                onClick={() => onOpenBlendModal(blend.name)}
                className={`rounded-2xl border p-4 bg-white shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between ${
                  evalResult.overallStatus === 'ready'
                    ? 'border-emerald-200'
                    : evalResult.overallStatus === 'low_stock'
                    ? 'border-amber-200'
                    : 'border-rose-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {blend.name}
                    </h4>
                    {evalResult.overallStatus === 'ready' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    )}
                    {evalResult.overallStatus === 'low_stock' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" /> Low Spice
                      </span>
                    )}
                    {evalResult.overallStatus === 'missing_items' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3 h-3" /> Missing Item
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mb-2">
                    {blend.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
