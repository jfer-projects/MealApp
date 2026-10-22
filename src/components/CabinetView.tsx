import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  Camera,
  Check,
  CheckCircle2,
  Minus,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Refrigerator,
  Search,
  ShoppingCart,
  Snowflake,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { CabinetItem, StockStatus } from '../types/freshdiy';
import {
  evaluateBlendStock,
  HELLOFRESH_PROPRIETARY_BLENDS,
} from '../utils/blendDecoder';
import {
  deriveStockStatusFromQuantities,
  getItemQuantities,
} from '../utils/groceryEngine';

interface CabinetViewProps {
  cabinet: CabinetItem[];
  onUpdateStatus: (id: string, status: StockStatus) => void;
  onUpdateItem: (updated: CabinetItem) => void;
  onThawToFridge: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems?: () => void;
  onAddCabinetItem: (
    name: string,
    category: CabinetItem['category'],
    status: StockStatus,
    quantities?: {
      freezer_qty?: number;
      fridge_qty?: number;
      pantry_qty?: number;
      unit?: string;
    }
  ) => void;
  onRestockAllLowAndOut: () => void;
  onAddExtraToGrocery: (itemName: string, aisle: string) => void;
  onOpenPhotoScanner: (mode?: 'cabinet' | 'fridge' | 'freezer') => void;
  onOpenBlendModal: (blendName: string) => void;
}

const CATEGORIES: CabinetItem['category'][] = [
  'Freezer & Deep Freeze',
  'Refrigerator',
  'Spices',
  'Sauces',
  'Broth Concentrates',
  'Oils & Vinegars',
  'Pantry',
];

const SUGGESTIONS = {
  freezer: [
    'Ground Turkey',
    'Chicken Breasts',
    'Ground Beef',
    'Pork Chops',
    'Salmon Fillets',
    'Frozen Broccoli',
    'Bacon',
  ],
  fridge: [
    'Ground Turkey',
    'Eggs',
    'Dairy-Free Sour Cream',
    'Carrots',
    'Bell Peppers',
    'Cilantro',
    'Oat Milk',
  ],
  pantry: [
    'Garlic Powder',
    'Onion Powder',
    'Smoked Paprika',
    'Cumin',
    'Oregano',
    'Soy Sauce',
    'Jasmine Rice',
  ],
};

const UNIT_OPTIONS = ['pkg', 'lb', 'item', 'bag', 'box', 'bottle', 'can', 'jar'];

export const CabinetView: React.FC<CabinetViewProps> = ({
  cabinet,
  onUpdateStatus,
  onUpdateItem,
  onThawToFridge,
  onDeleteItem,
  onClearAllItems,
  onAddCabinetItem,
  onRestockAllLowAndOut,
  onAddExtraToGrocery,
  onOpenPhotoScanner,
  onOpenBlendModal,
}) => {
  const [activeZone, setActiveZone] = useState<'all' | 'pantry' | 'fridge' | 'freezer'>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalItemName, setModalItemName] = useState('');
  const [modalCategory, setModalCategory] = useState<CabinetItem['category']>('Freezer & Deep Freeze');
  const [modalStatus, setModalStatus] = useState<StockStatus>('in_stock');
  const [modalFreezerQty, setModalFreezerQty] = useState<number>(1);
  const [modalFridgeQty, setModalFridgeQty] = useState<number>(0);
  const [modalPantryQty, setModalPantryQty] = useState<number>(0);
  const [modalUnit, setModalUnit] = useState<string>('pkg');
  const [justAddedName, setJustAddedName] = useState<string | null>(null);

  const applyCategoryDefaults = (cat: CabinetItem['category']) => {
    setModalCategory(cat);
    if (cat === 'Freezer & Deep Freeze') {
      setModalFreezerQty(1);
      setModalFridgeQty(0);
      setModalPantryQty(0);
      setModalUnit('pkg');
    } else if (cat === 'Refrigerator') {
      setModalFreezerQty(0);
      setModalFridgeQty(1);
      setModalPantryQty(0);
      setModalUnit('item');
    } else {
      setModalFreezerQty(0);
      setModalFridgeQty(0);
      setModalPantryQty(1);
      setModalUnit(cat === 'Sauces' || cat === 'Oils & Vinegars' ? 'bottle' : 'item');
    }
  };

  const handleOpenAddModal = (presetCategory?: CabinetItem['category']) => {
    let initialCat: CabinetItem['category'] = 'Freezer & Deep Freeze';
    if (presetCategory) {
      initialCat = presetCategory;
    } else if (activeZone === 'freezer') {
      initialCat = 'Freezer & Deep Freeze';
    } else if (activeZone === 'fridge') {
      initialCat = 'Refrigerator';
    } else if (activeZone === 'pantry') {
      initialCat = 'Spices';
    }
    applyCategoryDefaults(initialCat);
    setModalItemName('');
    setModalStatus('in_stock');
    setJustAddedName(null);
    setIsAddModalOpen(true);
  };

  // Check if the typed item name already exists on a card so the user sees it will merge
  const existingMatchingCard = useMemo(() => {
    const clean = modalItemName.trim().toLowerCase();
    if (!clean) return null;
    return cabinet.find((c) => c.item_name.trim().toLowerCase() === clean) || null;
  }, [cabinet, modalItemName]);

  const handleSaveModalItem = (addAnother: boolean = false) => {
    if (!modalItemName.trim()) return;
    const name = modalItemName.trim();
    const totalModalQty = modalFreezerQty + modalFridgeQty + modalPantryQty;
    const computedStatus: StockStatus =
      totalModalQty === 0
        ? 'out_of_stock'
        : modalStatus === 'out_of_stock'
        ? 'in_stock'
        : modalStatus;

    onAddCabinetItem(name, modalCategory, computedStatus, {
      freezer_qty: modalFreezerQty,
      fridge_qty: modalFridgeQty,
      pantry_qty: modalPantryQty,
      unit: modalUnit,
    });

    setJustAddedName(name);
    setModalItemName('');
    if (!addAnother) {
      setIsAddModalOpen(false);
    }
  };

  // Adjust location quantity directly on a unified card
  const handleAdjustZoneQuantity = (
    item: CabinetItem,
    zone: 'freezer' | 'fridge' | 'pantry',
    delta: number
  ) => {
    const current = getItemQuantities(item);
    const nextFreezer =
      zone === 'freezer' ? Math.max(0, current.freezer + delta) : current.freezer;
    const nextFridge =
      zone === 'fridge' ? Math.max(0, current.fridge + delta) : current.fridge;
    const nextPantry =
      zone === 'pantry' ? Math.max(0, current.pantry + delta) : current.pantry;

    const nextTotal = nextFreezer + nextFridge + nextPantry;
    const nextStatus = deriveStockStatusFromQuantities(
      nextFreezer,
      nextFridge,
      nextPantry,
      nextTotal === 1 && current.total > 1 ? 'low' : item.status
    );

    // Keep primary category aligned if item moved entirely to freezer or fridge
    let nextCategory = item.category;
    if (nextFreezer > 0 && nextFridge === 0 && nextPantry === 0) {
      nextCategory = 'Freezer & Deep Freeze';
    } else if (nextFridge > 0 && nextFreezer === 0 && nextPantry === 0) {
      nextCategory = 'Refrigerator';
    }

    onUpdateItem({
      ...item,
      category: nextCategory,
      freezer_qty: nextFreezer,
      fridge_qty: nextFridge,
      pantry_qty: nextPantry,
      unit: current.unit,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    });
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

  // Zone counts (items that have stock in that zone OR belong to that zone)
  const freezerCardCount = useMemo(
    () =>
      cabinet.filter((c) => {
        const q = getItemQuantities(c);
        return q.freezer > 0 || c.category === 'Freezer & Deep Freeze';
      }).length,
    [cabinet]
  );

  const fridgeCardCount = useMemo(
    () =>
      cabinet.filter((c) => {
        const q = getItemQuantities(c);
        return q.fridge > 0 || c.category === 'Refrigerator';
      }).length,
    [cabinet]
  );

  const pantryCardCount = useMemo(
    () =>
      cabinet.filter((c) => {
        const q = getItemQuantities(c);
        return (
          q.pantry > 0 ||
          (c.category !== 'Freezer & Deep Freeze' && c.category !== 'Refrigerator')
        );
      }).length,
    [cabinet]
  );

  const filteredCabinet = useMemo(() => {
    return cabinet.filter((item) => {
      const q = getItemQuantities(item);

      // Unified Multi-Location Zone Filter:
      // An item like "Ground Turkey" with 3 in Freezer and 1 in Fridge appears in BOTH Deep Freezer and Refrigerator tabs!
      if (
        activeZone === 'freezer' &&
        q.freezer === 0 &&
        item.category !== 'Freezer & Deep Freeze'
      ) {
        return false;
      }
      if (
        activeZone === 'fridge' &&
        q.fridge === 0 &&
        item.category !== 'Refrigerator'
      ) {
        return false;
      }
      if (
        activeZone === 'pantry' &&
        q.pantry === 0 &&
        (item.category === 'Refrigerator' || item.category === 'Freezer & Deep Freeze')
      ) {
        return false;
      }

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
            Unified Kitchen &amp; Deep Freezer Inventory
          </div>
          <h2 className="text-xl font-black tracking-tight">
            Household Inventory &amp; Thaw Tracker
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Track exact package counts across your Deep Freezer, Refrigerator, and Pantry on a single unified card per ingredient — and move items from Freezer to Fridge with 1 tap.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Add Item</span>
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
                    Running low
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
                    onAddExtraToGrocery(
                      item.item_name,
                      item.category === 'Freezer & Deep Freeze'
                        ? 'Meat & Seafood'
                        : item.category === 'Refrigerator'
                        ? 'Produce'
                        : 'Spices & Pantry'
                    )
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
                    <div className="flex items-start gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          isOut ? 'bg-rose-600' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-sm font-black text-slate-900 line-clamp-2 leading-snug">
                        {item.item_name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider block mt-0.5 ${
                        isOut ? 'text-rose-700' : 'text-amber-800'
                      }`}
                    >
                      {isOut ? 'RAN OUT' : 'RUNNING LOW'} • {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        onAddExtraToGrocery(
                          item.item_name,
                          item.category === 'Freezer & Deep Freeze'
                            ? 'Meat & Seafood'
                            : item.category === 'Refrigerator'
                            ? 'Produce'
                            : 'Spices & Pantry'
                        )
                      }
                      className="px-2 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Add to Grocery List"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" /> Buy
                    </button>
                    <button
                      onClick={() => {
                        const q = getItemQuantities(item);
                        if (q.total === 0) {
                          if (item.category === 'Freezer & Deep Freeze') {
                            handleAdjustZoneQuantity(item, 'freezer', 1);
                          } else if (item.category === 'Refrigerator') {
                            handleAdjustZoneQuantity(item, 'fridge', 1);
                          } else {
                            handleAdjustZoneQuantity(item, 'pantry', 1);
                          }
                        } else {
                          onUpdateStatus(item.id, 'in_stock');
                        }
                      }}
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
        {/* Top Location Tabs (All vs Deep Freezer vs Fridge vs Pantry) */}
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
              Deep Freezer ({freezerCardCount})
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
              Refrigerator ({fridgeCardCount})
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
              Pantry &amp; Spices ({pantryCardCount})
            </button>
          </div>

          {/* Clean Slate Action */}
          {onClearAllItems && cabinet.length > 0 && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Clear all items from your inventory? This lets you start fresh with only what is currently in your household.'
                  )
                ) {
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
              ✅ In Household ({inStockCount})
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

        {/* Category Pills & Add Item Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
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

          <button
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {/* Unified Multi-Location Items Grid */}
        {filteredCabinet.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No items match your filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Tap below to add an ingredient with Freezer/Fridge quantities, or snap a photo of your shelves.
            </p>
            <button
              onClick={() => handleOpenAddModal()}
              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Item to Inventory
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCabinet.map((item) => {
              const qty = getItemQuantities(item);
              const showLocationBreakdown =
                qty.hasExplicitCounts ||
                item.category === 'Freezer & Deep Freeze' ||
                item.category === 'Refrigerator' ||
                qty.freezer > 0 ||
                qty.fridge > 0;
              const isMultiLocation =
                (qty.freezer > 0 ? 1 : 0) +
                  (qty.fridge > 0 ? 1 : 0) +
                  (qty.pantry > 0 ? 1 : 0) >
                1;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition ${
                    item.status === 'out_of_stock'
                      ? 'bg-rose-50/50 border-rose-200'
                      : item.status === 'low'
                      ? 'bg-amber-50/50 border-amber-200'
                      : isMultiLocation
                      ? 'bg-gradient-to-br from-cyan-50/40 via-white to-blue-50/40 border-cyan-200/80 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  {/* Top Row: Item Name, Total Badge, Status Controls & Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug">
                          {item.item_name}
                        </p>
                        {showLocationBreakdown && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              qty.total > 0
                                ? 'bg-slate-900 text-white'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {qty.total} {qty.unit}
                            {qty.total === 1 ? '' : 's'} total
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        {qty.freezer > 0 && <Snowflake className="w-3 h-3 text-cyan-600" />}
                        {qty.fridge > 0 && <Refrigerator className="w-3 h-3 text-blue-600" />}
                        <span>{item.category}</span>
                        {isMultiLocation && (
                          <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100/80 px-1.5 py-0.2 rounded-md">
                            Multi-Location
                          </span>
                        )}
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
                          className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
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
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-0.5"
                        title={`Delete ${item.item_name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Unified Location Quantity Breakdown & "Move to Fridge (Thaw)" Controls */}
                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Deep Freezer Stepper */}
                      {(qty.freezer > 0 ||
                        item.category === 'Freezer & Deep Freeze' ||
                        activeZone === 'freezer') ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-950 text-xs font-bold">
                          <Snowflake className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span>Freezer:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustZoneQuantity(item, 'freezer', -1)}
                            className="w-5 h-5 rounded-md bg-white border border-cyan-200 hover:bg-cyan-100 flex items-center justify-center text-cyan-900 cursor-pointer"
                            title="Remove 1 from Deep Freezer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-black min-w-[16px] text-center">
                            {qty.freezer}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustZoneQuantity(item, 'freezer', 1)}
                            className="w-5 h-5 rounded-md bg-white border border-cyan-200 hover:bg-cyan-100 flex items-center justify-center text-cyan-900 cursor-pointer"
                            title="Add 1 to Deep Freezer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdjustZoneQuantity(item, 'freezer', 1)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-200 text-slate-500 hover:text-cyan-800 text-[11px] font-bold transition cursor-pointer"
                          title="Add 1 to Deep Freezer on this same card"
                        >
                          <Snowflake className="w-3 h-3 text-cyan-600" /> + Freezer
                        </button>
                      )}

                      {/* Refrigerator Stepper */}
                      {(qty.fridge > 0 ||
                        item.category === 'Refrigerator' ||
                        activeZone === 'fridge') ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs font-bold">
                          <Refrigerator className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Fridge:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustZoneQuantity(item, 'fridge', -1)}
                            className="w-5 h-5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 flex items-center justify-center text-blue-900 cursor-pointer"
                            title="Remove 1 from Refrigerator"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-black min-w-[16px] text-center">
                            {qty.fridge}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustZoneQuantity(item, 'fridge', 1)}
                            className="w-5 h-5 rounded-md bg-white border border-blue-200 hover:bg-blue-100 flex items-center justify-center text-blue-900 cursor-pointer"
                            title="Add 1 to Refrigerator"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdjustZoneQuantity(item, 'fridge', 1)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-500 hover:text-blue-800 text-[11px] font-bold transition cursor-pointer"
                          title="Add 1 to Refrigerator on this same card"
                        >
                          <Refrigerator className="w-3 h-3 text-blue-600" /> + Fridge
                        </button>
                      )}

                      {/* Pantry Stepper (shown when pantry has explicit counts or item is in Pantry/Spices) */}
                      {(qty.pantry > 0 &&
                        (qty.hasExplicitCounts ||
                          (item.category !== 'Freezer & Deep Freeze' &&
                            item.category !== 'Refrigerator'))) && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold">
                          <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Pantry:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustZoneQuantity(item, 'pantry', -1)}
                            className="w-5 h-5 rounded-md bg-white border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center text-emerald-900 cursor-pointer"
                            title="Remove 1 from Pantry"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-black min-w-[16px] text-center">
                            {qty.pantry}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustZoneQuantity(item, 'pantry', 1)}
                            className="w-5 h-5 rounded-md bg-white border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center text-emerald-900 cursor-pointer"
                            title="Add 1 to Pantry"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 1-Tap "Move to Fridge (Thaw 1)" Action whenever item has Freezer stock */}
                    {qty.freezer > 0 && (
                      <button
                        type="button"
                        onClick={() => onThawToFridge(item.id)}
                        className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-99"
                        title="Move 1 from Deep Freezer to Refrigerator on this same card"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                        <ArrowRight className="w-3 h-3" />
                        <Refrigerator className="w-3.5 h-3.5" />
                        <span>
                          Move 1 to Fridge (Thaw) • {qty.freezer} in Freezer ➔{' '}
                          {qty.fridge + 1} in Fridge
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {blend.name}
                    </h4>
                    {evalResult.overallStatus === 'ready' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Ready to Mix
                      </span>
                    )}
                    {evalResult.overallStatus === 'low_stock' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" /> Low Spice
                      </span>
                    )}
                    {evalResult.overallStatus === 'missing_items' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                        <Beaker className="w-3 h-3" /> Make it yourself
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

      {/* 🚀 ADD ITEM TO INVENTORY MODAL (UNIFIED MULTI-LOCATION) */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Add Item to Household Inventory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set counts for Deep Freezer, Refrigerator, and Pantry on one unified card.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success toast inside modal if "Add Another" was clicked */}
            {justAddedName && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Saved &quot;{justAddedName}&quot;! Add another item below:</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveModalItem(false);
              }}
              className="space-y-4"
            >
              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ingredient / Item Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={modalItemName}
                  onChange={(e) => setModalItemName(e.target.value)}
                  placeholder="e.g. Ground Turkey, Chicken Breasts, Paprika..."
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />

                {existingMatchingCard && (
                  <div className="mt-2 p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-950 text-xs font-bold flex items-center justify-between">
                    <span>
                      ✨ &quot;{existingMatchingCard.item_name}&quot; is already in your inventory — quantities will merge onto that same card!
                    </span>
                  </div>
                )}

                {/* Quick suggestions based on selected category */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Quick Pick:
                  </span>
                  {(modalCategory === 'Freezer & Deep Freeze'
                    ? SUGGESTIONS.freezer
                    : modalCategory === 'Refrigerator'
                    ? SUGGESTIONS.fridge
                    : SUGGESTIONS.pantry
                  ).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setModalItemName(sug)}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200 transition cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Storage Location / Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Primary Location
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyCategoryDefaults('Freezer & Deep Freeze')}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      modalCategory === 'Freezer & Deep Freeze'
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-900 font-extrabold ring-2 ring-cyan-400/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                    }`}
                  >
                    <Snowflake className="w-5 h-5 text-cyan-600" />
                    <span className="text-xs">Deep Freezer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyCategoryDefaults('Refrigerator')}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      modalCategory === 'Refrigerator'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-extrabold ring-2 ring-blue-400/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                    }`}
                  >
                    <Refrigerator className="w-5 h-5 text-blue-600" />
                    <span className="text-xs">Refrigerator</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        modalCategory === 'Freezer & Deep Freeze' ||
                        modalCategory === 'Refrigerator'
                      ) {
                        applyCategoryDefaults('Spices');
                      }
                    }}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      modalCategory !== 'Freezer & Deep Freeze' &&
                      modalCategory !== 'Refrigerator'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-extrabold ring-2 ring-emerald-400/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium'
                    }`}
                  >
                    <Package className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs">Pantry/Spices</span>
                  </button>
                </div>

                {/* Subcategory dropdown if in Pantry */}
                {modalCategory !== 'Freezer & Deep Freeze' &&
                  modalCategory !== 'Refrigerator' && (
                    <div className="mt-2.5">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Pantry Subcategory:
                      </label>
                      <select
                        value={modalCategory}
                        onChange={(e) =>
                          setModalCategory(
                            e.target.value as CabinetItem['category']
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                      >
                        <option value="Spices">Spices &amp; Seasonings</option>
                        <option value="Sauces">Sauces &amp; Condiments</option>
                        <option value="Broth Concentrates">
                          Broth Concentrates &amp; Stocks
                        </option>
                        <option value="Oils & Vinegars">Oils &amp; Vinegars</option>
                        <option value="Pantry">Dry Pantry Staples &amp; Grains</option>
                      </select>
                    </div>
                  )}
              </div>

              {/* Unified Location Quantities (e.g., 3 in Deep Freezer + 1 in Fridge on the same card!) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800">
                    Quantities by Location (Unified on 1 Card)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Unit:
                    </span>
                    <select
                      value={modalUnit}
                      onChange={(e) => setModalUnit(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-300 text-xs bg-white font-bold"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Deep Freezer Count */}
                  <div className="p-2.5 rounded-xl bg-white border border-cyan-200 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-cyan-900 flex items-center gap-1">
                      <Snowflake className="w-3.5 h-3.5 text-cyan-600" /> Freezer
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setModalFreezerQty(Math.max(0, modalFreezerQty - 1))
                        }
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-black text-slate-900 min-w-[20px] text-center">
                        {modalFreezerQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalFreezerQty(modalFreezerQty + 1)}
                        className="w-6 h-6 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Refrigerator Count */}
                  <div className="p-2.5 rounded-xl bg-white border border-blue-200 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                      <Refrigerator className="w-3.5 h-3.5 text-blue-600" /> Fridge
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setModalFridgeQty(Math.max(0, modalFridgeQty - 1))
                        }
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-black text-slate-900 min-w-[20px] text-center">
                        {modalFridgeQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalFridgeQty(modalFridgeQty + 1)}
                        className="w-6 h-6 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Pantry Count */}
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-emerald-600" /> Pantry
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setModalPantryQty(Math.max(0, modalPantryQty - 1))
                        }
                        className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-black text-slate-900 min-w-[20px] text-center">
                        {modalPantryQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalPantryQty(modalPantryQty + 1)}
                        className="w-6 h-6 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black text-xs flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tip: Have 3 Ground Turkey in the Deep Freezer and 1 thawing in the Fridge? Set Freezer to 3 and Fridge to 1 — both live on one card!
                </p>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveModalItem(true)}
                  disabled={!modalItemName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save &amp; Add Another
                </button>
                <button
                  type="submit"
                  disabled={!modalItemName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
