import React from 'react';
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  Plus,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { CabinetItem } from '../types/freshdiy';
import { evaluateBlendStock } from '../utils/blendDecoder';

interface BlendRecipeModalProps {
  blendName: string | null;
  cabinet: CabinetItem[];
  onClose: () => void;
  onAddExtraToGrocery: (itemName: string, aisle: string) => void;
}

export const BlendRecipeModal: React.FC<BlendRecipeModalProps> = ({
  blendName,
  cabinet,
  onClose,
  onAddExtraToGrocery,
}) => {
  if (!blendName) return null;

  const evalResult = evaluateBlendStock(blendName, cabinet);
  if (!evalResult) return null;

  const { blend, overallStatus, componentStatuses, missingSpices } = evalResult;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800">
              <Beaker className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                  HelloFresh DIY Decoder
                </span>
                {overallStatus === 'ready' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> All in Cabinet
                  </span>
                )}
                {overallStatus === 'low_stock' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    <AlertTriangle className="w-3 h-3" /> Running Low
                  </span>
                )}
                {overallStatus === 'missing_items' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                    <XCircle className="w-3 h-3" /> Missing Base Item
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                How to Make {blend.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {blend.description}
        </p>

        {/* Formula Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-950">
          ✨ {blend.yieldNote}
        </div>

        {/* Base Ingredients & Live Cabinet Check */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            What You Need From Your Cabinet:
          </p>
          <div className="space-y-2">
            {componentStatuses.map((comp) => (
              <div
                key={comp.spiceName}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    {comp.spiceName}
                  </span>
                  <span className="ml-2 text-xs font-semibold text-slate-500">
                    ({comp.ratio})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      comp.status === 'in_stock'
                        ? 'bg-emerald-100 text-emerald-800'
                        : comp.status === 'low'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {comp.status.replace(/_/g, ' ')}
                  </span>

                  {comp.status !== 'in_stock' && (
                    <button
                      onClick={() => {
                        onAddExtraToGrocery(comp.spiceName, 'Spices & Pantry');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add to Grocery
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-Step Mixing Instructions */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Quick Prep Instructions
          </p>
          <p className="text-xs text-slate-200 leading-relaxed">
            {blend.mixingSteps}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          {missingSpices.length > 0 ? (
            <button
              onClick={() => {
                missingSpices.forEach((sp) =>
                  onAddExtraToGrocery(sp, 'Spices & Pantry')
                );
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add {missingSpices.length} Missing Base Item(s) to Grocery List
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-700">
              ✅ You have everything in your Cabinet to make {blend.name}!
            </span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
