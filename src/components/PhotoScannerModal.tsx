import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  PackagePlus,
  Plus,
  Refrigerator,
  Snowflake,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { CabinetItem } from '../types/freshdiy';
import { analyzePhotoWithGemini } from '../utils/geminiClient';

interface PhotoScannerModalProps {
  isOpen: boolean;
  initialMode: 'cabinet' | 'fridge' | 'freezer';
  geminiApiKey?: string;
  isKeyAuthor?: boolean;
  hasFamilyKey?: boolean;
  onUpdateGeminiApiKey?: (key: string) => void;
  onOpenFamilySettings?: () => void;
  onClose: () => void;
  onImportToCabinet: (
    items: { name: string; category: CabinetItem['category'] }[]
  ) => void;
  onImportToFridge: (items: string[]) => void;
}

interface DetectedIngredient {
  name: string;
  category: CabinetItem['category'];
  selected: boolean;
  confidence: string;
}

export const PhotoScannerModal: React.FC<PhotoScannerModalProps> = ({
  isOpen,
  initialMode,
  geminiApiKey = '',
  isKeyAuthor = true,
  hasFamilyKey = false,
  onUpdateGeminiApiKey,
  onOpenFamilySettings,
  onClose,
  onImportToCabinet,
  onImportToFridge,
}) => {
  const [scanMode, setScanMode] = useState<'cabinet' | 'fridge' | 'freezer'>(initialMode);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedIngredient[]>([]);
  const [customAdd, setCustomAdd] = useState('');
  const [tempApiKey, setTempApiKey] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScanMode(initialMode);
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const effectiveApiKey = (geminiApiKey || tempApiKey || '').trim();
  const hasConfiguredKey = Boolean(effectiveApiKey) || hasFamilyKey;

  const analyzeImage = async (file: File) => {
    setScanError(null);
    if (!effectiveApiKey) {
      setScanError(
        'A Google Gemini API Key is required to scan photos. Please paste your key below or configure it in Account Settings.'
      );
      return;
    }

    setIsScanning(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const items = await analyzePhotoWithGemini(file, scanMode, effectiveApiKey);
      if (items.length === 0) {
        setScanError('No recognizable items found in photo. Please ensure clear lighting and try again.');
      } else {
        // Automatically switch the destination tab if the photo is clearly spices/pantry or freezer
        const spiceOrPantryCount = items.filter((i) =>
          ['Spices', 'Sauces', 'Broth Concentrates', 'Oils & Vinegars', 'Pantry'].includes(i.category)
        ).length;
        const freezerCount = items.filter((i) => i.category === 'Freezer & Deep Freeze').length;
        if (spiceOrPantryCount > items.length / 2) {
          setScanMode('cabinet');
        } else if (freezerCount > items.length / 2) {
          setScanMode('freezer');
        }

        setDetected(
          items.map((item) => ({
            name: item.name,
            category: item.category,
            selected: true,
            confidence: item.category,
          }))
        );
      }
    } catch (err: any) {
      setScanError(err?.message || 'Failed to analyze photo with Gemini AI.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      analyzeImage(file);
      e.target.value = '';
    }
  };

  const handleAddCustomDetected = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAdd.trim()) return;
    setDetected((prev) => [
      {
        name: customAdd.trim(),
        category: 'Spices',
        selected: true,
        confidence: 'Manual',
      },
      ...prev,
    ]);
    setCustomAdd('');
  };

  const handleConfirmImport = () => {
    const selectedItems = detected.filter((d) => d.selected);
    if (selectedItems.length === 0) return;

    if (scanMode === 'cabinet') {
      onImportToCabinet(
        selectedItems.map((i) => ({ name: i.name, category: i.category }))
      );
    } else if (scanMode === 'freezer') {
      onImportToCabinet(
        selectedItems.map((i) => ({ name: i.name, category: 'Freezer & Deep Freeze' }))
      );
    } else {
      onImportToFridge(selectedItems.map((i) => i.name));
      onImportToCabinet(
        selectedItems.map((i) => ({ name: i.name, category: 'Refrigerator' }))
      );
    }
    onClose();
  };

  const selectedCount = detected.filter((d) => d.selected).length;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 max-w-lg w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                AI Photo Ingredient Scanner
              </h3>
              <p className="text-xs text-slate-500">
                Snap a photo of your spice shelf or open fridge to auto-import ingredients.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-5 pb-8 space-y-4">
        {scanError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{scanError}</span>
          </div>
        )}

        {/* What are you scanning? Picker */}
        <div className="space-y-1.5">
          <p className="text-xs font-extrabold text-slate-700">
            What are you scanning?
          </p>
          <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setScanMode('fridge')}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-1 transition cursor-pointer ${
                scanMode === 'fridge'
                  ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Refrigerator className="w-4 h-4" />
              <span className="truncate">Fridge</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('freezer')}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-1 transition cursor-pointer ${
                scanMode === 'freezer'
                  ? 'bg-white text-cyan-700 shadow-xs ring-1 ring-cyan-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Snowflake className="w-4 h-4" />
              <span className="truncate">Freezer</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('cabinet')}
              className={`py-2.5 px-2 rounded-xl text-xs font-extrabold flex flex-col sm:flex-row items-center justify-center gap-1 transition cursor-pointer ${
                scanMode === 'cabinet'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span className="truncate">Pantry/Spices</span>
            </button>
          </div>
        </div>

        {/* Hidden Native Camera & Gallery Inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Camera / Upload Trigger Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition cursor-pointer active:scale-98"
          >
            <Camera className="w-7 h-7" />
            <span>Take Photo with Camera</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-extrabold text-xs transition cursor-pointer active:scale-98"
          >
            <ImageIcon className="w-7 h-7 text-emerald-600" />
            <span>Choose from Photos</span>
          </button>
        </div>

        {/* Image Preview & Scanning Animation */}
        {previewUrl && (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-44 bg-slate-900">
            <img
              src={previewUrl}
              alt="Scanned shelf"
              className="w-full h-full object-cover opacity-90"
            />
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center text-white gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <span className="text-xs font-bold">
                  Scanning labels &amp; jars...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Detected Items Checklist */}
        {detected.length > 0 && !isScanning && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Detected {detected.length} Ingredients (Tap to toggle)
              </span>
              <button
                type="button"
                onClick={() =>
                  setDetected((prev) =>
                    prev.map((d) => ({ ...d, selected: true }))
                  )
                }
                className="text-[11px] font-bold text-slate-500 hover:text-slate-900"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {detected.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  onClick={() =>
                    setDetected((prev) =>
                      prev.map((d, i) =>
                        i === idx ? { ...d, selected: !d.selected } : d
                      )
                    )
                  }
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                    item.selected
                      ? 'bg-emerald-50 border-emerald-300 text-slate-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center ${
                        item.selected
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-300 bg-white'
                      }`}
                    >
                      {item.selected && <Check className="w-3 h-3" />}
                    </div>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    {item.confidence}
                  </span>
                </div>
              ))}
            </div>

            {/* Add any missed item */}
            <form onSubmit={handleAddCustomDetected} className="flex gap-2">
              <input
                type="text"
                value={customAdd}
                onChange={(e) => setCustomAdd(e.target.value)}
                placeholder="Add another item from photo..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                + Add
              </button>
            </form>

            <button
              type="button"
              onClick={handleConfirmImport}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Auto-Import {selectedCount} Items to{' '}
              {scanMode === 'cabinet' ? 'Spice Cabinet (In-Stock)' : 'Fridge Matcher'}
            </button>
          </div>
        )}

        {/* Only show API key prompt at the bottom if NO key is configured yet */}
        {!hasConfiguredKey && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                Gemini API Key Required for Vision Scan
              </span>
              {onOpenFamilySettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFamilySettings();
                  }}
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                >
                  Open Settings
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value.trim())}
                placeholder="Paste AIzaSy... key here"
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (!tempApiKey.trim()) return;
                  if (onUpdateGeminiApiKey) {
                    onUpdateGeminiApiKey(tempApiKey.trim());
                  } else {
                    localStorage.setItem('freshdiy_gemini_api_key_v1', tempApiKey.trim());
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
              >
                Save Key
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
