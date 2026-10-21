import React, { useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  PackagePlus,
  RefreshCw,
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
  onAddCabinetItem: (
    name: string,
    category: CabinetItem['category'],
    status: StockStatus
  ) => void;
  onRestockAllLowAndOut: () => void;
}

const CATEGORIES: CabinetItem['category'][] = [
  'Spices',
  'Sauces',
  'Broth Concentrates',
  'Oils & Vinegars',
  'Pantry',
];

export const CabinetView: React.FC<CabinetViewProps> = ({
  cabinet,
  onUpdateStatus,
  onAddCabinetItem,
  onRestockAllLowAndOut,
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [newCategory, setNewCategory] =
    useState<CabinetItem['category']>('Spices');
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<string>('All');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    onAddCabinetItem(newItemName.trim(), newCategory, 'in_stock');
    setNewItemName('');
  };

  const inStockCount = cabinet.filter((c) => c.status === 'in_stock').length;
  const lowCount = cabinet.filter((c) => c.status === 'low').length;
  const outCount = cabinet.filter((c) => c.status === 'out_of_stock').length;

  const filteredCabinet =
    activeCategoryFilter === 'All'
      ? cabinet
      : cabinet.filter((c) => c.category === activeCategoryFilter);

  return (
    <div className="space-y-8">
      {/* Top Summary & Quick Restock */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Spice &amp; Pantry Cabinet Tracker
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Items marked <strong>In Stock</strong> are automatically crossed off your weekly Grocery List so you never double-buy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            {inStockCount} In Stock
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
            {lowCount} Low
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
            {outCount} Out of Stock
          </span>

          {(lowCount > 0 || outCount > 0) && (
            <button
              onClick={onRestockAllLowAndOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restock All to In-Stock
            </button>
          )}
        </div>
      </section>

      {/* HelloFresh Proprietary Blend Decoder */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <Beaker className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              HelloFresh Proprietary Blend Decoder
            </h3>
            <p className="text-xs text-slate-500">
              Decodes signature HelloFresh seasoning packets into standard grocery store spices and evaluates your live Cabinet stock.
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
                className={`rounded-2xl border p-4 bg-white shadow-xs flex flex-col justify-between ${
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
                        <CheckCircle2 className="w-3 h-3" /> Ready to Mix
                      </span>
                    )}
                    {evalResult.overallStatus === 'low_stock' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" /> Low Base Spice
                      </span>
                    )}
                    {evalResult.overallStatus === 'missing_items' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3 h-3" /> Missing Base Spice
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mb-2">
                    {blend.description}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-700 mb-3">
                    {blend.yieldNote}
                  </div>

                  <div className="space-y-1.5">
                    {evalResult.componentStatuses.map((comp) => (
                      <div
                        key={comp.spiceName}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-800 font-medium">
                          {comp.spiceName}{' '}
                          <span className="text-slate-400">({comp.ratio})</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            comp.status === 'in_stock'
                              ? 'bg-emerald-100 text-emerald-800'
                              : comp.status === 'low'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {comp.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Inventory Management Table */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {['All', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeCategoryFilter === cat
                    ? 'bg-slate-900 text-white'
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
              placeholder="Add spice, sauce, or concentrate..."
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={newCategory}
              onChange={(e) =>
                setNewCategory(e.target.value as CabinetItem['category'])
              }
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5" /> Add to Cabinet
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCabinet.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {item.item_name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {item.category} • Used in {item.usage_count} completed meals
                </p>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
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
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
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
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
