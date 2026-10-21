import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  Save,
  Share2,
  Shield,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  getHouseholdMembers,
  joinHouseholdByCode,
  signOut,
} from '../lib/authService';
import { supabase } from '../lib/supabase';
import { HouseholdMember, UserProfile } from '../types/freshdiy';

interface FamilySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  geminiApiKey: string;
  isKeyAuthor?: boolean;
  onUpdateGeminiApiKey: (key: string) => void;
  hellofreshPrice: number;
  onUpdateHellofreshPrice: (price: number) => void;
  onProfileUpdated: (updated: UserProfile) => void;
  onSignOut: () => void;
}

export const FamilySettingsModal: React.FC<FamilySettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  geminiApiKey,
  isKeyAuthor = true,
  onUpdateGeminiApiKey,
  hellofreshPrice,
  onUpdateHellofreshPrice,
  onProfileUpdated,
  onSignOut,
}) => {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [switchCode, setSwitchCode] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchMessage, setSwitchMessage] = useState<string | null>(null);

  // Gemini & Cost Settings State
  const [apiKeyInput, setApiKeyInput] = useState(geminiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [priceInput, setPriceInput] = useState(String(hellofreshPrice || 11.49));
  const [settingsSaved, setSettingsSaved] = useState(false);

  const household = currentUser.household;

  useEffect(() => {
    setApiKeyInput(geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    if (household?.id) {
      getHouseholdMembers(household.id).then(setMembers);
    }
  }, [household?.id]);

  if (!isOpen) return null;

  const inviteCode = household?.invite_code || '';
  const inviteUrl = typeof window !== 'undefined' && inviteCode
    ? `${window.location.origin}/?join=${inviteCode}`
    : '';

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!inviteCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${household?.name || 'our Kitchen'} on FreshDIY!`,
          text: `Join our private kitchen on FreshDIY to plan meals and sync grocery lists together. Use invite code: ${inviteCode}`,
          url: inviteUrl || undefined,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = isKeyAuthor ? apiKeyInput.trim() : geminiApiKey;
    const numPrice = parseFloat(priceInput) || 11.49;

    if (isKeyAuthor) {
      onUpdateGeminiApiKey(cleanKey);
    }
    onUpdateHellofreshPrice(numPrice);

    if (household?.id) {
      try {
        const payload: Record<string, any> = {
          household_id: household.id,
          hellofresh_price_per_serving: numPrice,
          updated_at: new Date().toISOString(),
        };
        if (isKeyAuthor) {
          payload.gemini_api_key = cleanKey || null;
          payload.gemini_api_key_set_by = cleanKey ? currentUser.id : null;
        }
        await supabase.from('household_settings').upsert(payload);
      } catch (err) {
        console.warn('Could not save to Supabase household_settings:', err);
      }
    }

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleJoinDifferent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchCode.trim()) return;

    setSwitching(true);
    setSwitchMessage(null);
    const res = await joinHouseholdByCode(
      currentUser.id,
      switchCode.trim().toUpperCase(),
      currentUser.display_name
    );
    setSwitching(false);

    if (res.ok && res.household) {
      setSwitchMessage(res.message);
      onProfileUpdated({
        ...currentUser,
        household: res.household,
      });
      setSwitchCode('');
    } else {
      setSwitchMessage(res.message || 'Failed to join family');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Family &amp; Account Settings
              </h2>
              <p className="text-xs text-slate-500">
                {currentUser.display_name} • {currentUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Active Family Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full mb-1.5">
                  <Home className="w-3 h-3" />
                  Active Household
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {household?.name || 'Personal Kitchen'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  All grocery lists, spice cabinet inventory, and meal plans are synchronized with members in this household.
                </p>
              </div>
            </div>

            {/* Invite Code Box */}
            <div className="mt-4 pt-4 border-t border-emerald-200/60">
              <label className="block text-[11px] font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                Shareable Household Invite Code
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-white border border-emerald-300 rounded-xl px-3.5 py-2 font-mono text-sm font-black text-emerald-800 tracking-wider text-center sm:text-left flex items-center justify-between">
                  <span>{inviteCode || 'Setting up household...'}</span>
                  {inviteCode && (
                    <button
                      onClick={handleCopyCode}
                      className="ml-2 text-xs font-sans font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer inline-flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>

                {inviteCode && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                    </button>

                    <button
                      onClick={handleNativeShare}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                      title="Share invite code with family or housemates"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-emerald-700/80 mt-1.5">
                💡 Anyone you share this code or link with can enter it when signing up to link to your household kitchen.
              </p>
            </div>
          </div>

          {/* Household Gemini API Key & Cost Customizer */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Household AI &amp; Cost Settings
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                Shared by this Family Only
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3">
              {!isKeyAuthor && geminiApiKey ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      Family Gemini AI Key Active
                    </span>
                    <span className="text-[10px] font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                      Connected
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Provided by household admin. You have full access to AI Photo Scanning and recipe customization without needing your own API key. For security, the key itself is hidden from non-admin members.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      Google Gemini API Key
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
                    >
                      <span>Get Free Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Powers photo scanning &amp; recipe AI customization. Stored safely for your family only.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                  Your HelloFresh Box Price / Serving
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="5"
                    max="30"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="11.49"
                    className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Used by the Cost Estimator to calculate your actual weekly dollars saved.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {settingsSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Settings Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Household Settings</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Members in Household */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Connected Family Members ({members.length || 1})
            </h4>

            <div className="space-y-2">
              {members.length > 0 ? (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                        {m.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{m.display_name}</span>
                          {m.user_id === currentUser.id && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {m.role === 'owner' ? 'Household Admin' : 'Family Member'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">
                      {currentUser.display_name} (You)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">Household Owner</span>
                </div>
              )}
            </div>
          </div>

          {/* Switch or Join Another Household */}
          <div className="pt-2 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 mb-2">
              Have another family invite code?
            </h4>
            <form onSubmit={handleJoinDifferent} className="flex gap-2">
              <input
                type="text"
                value={switchCode}
                onChange={(e) => setSwitchCode(e.target.value.toUpperCase())}
                placeholder="e.g. FAM-9Q2K"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs uppercase font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={switching || !switchCode.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer disabled:opacity-50"
              >
                {switching ? 'Joining...' : 'Join Household'}
              </button>
            </form>
            {switchMessage && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
                {switchMessage}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex items-center justify-between">
          <button
            onClick={async () => {
              await signOut();
              onSignOut();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
