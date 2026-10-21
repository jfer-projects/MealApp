import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { signIn, signUpWithHousehold } from '../lib/authService';
import { UserProfile } from '../types/freshdiy';

interface AuthScreenProps {
  onAuthenticated: (profile: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [householdMode, setHouseholdMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('Ferris Family Kitchen');
  const [inviteCode, setInviteCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-detect invite code from URL query: ?join=FAM-XYZ
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('join') || urlParams.get('invite');
      if (codeFromUrl) {
        setInviteCode(codeFromUrl.toUpperCase());
        setHouseholdMode('join');
        setTab('signup');
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);

    if (res.ok && res.user) {
      onAuthenticated(res.user);
    } else {
      setErrorMessage(res.message || 'Incorrect email or password. Please try again.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please provide an email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (householdMode === 'join' && !inviteCode.trim()) {
      setErrorMessage('Please enter the Family Invite Code provided by your partner.');
      return;
    }

    setLoading(true);
    const res = await signUpWithHousehold({
      email,
      password,
      displayName: displayName.trim() || 'Parent',
      householdMode,
      householdName: householdName.trim() || undefined,
      inviteCode: householdMode === 'join' ? inviteCode.trim().toUpperCase() : undefined,
    });
    setLoading(false);

    if (res.ok) {
      if (res.user && res.session) {
        onAuthenticated(res.user);
      } else {
        setSuccessMessage(
          '🎉 Account created! If your Supabase requires email confirmation, check your inbox. Otherwise you can sign in right now.'
        );
        setTab('signin');
      }
    } else {
      setErrorMessage(res.message || 'Registration failed. Please check your details.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 sm:px-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-600 text-white shadow-xl shadow-emerald-900/50 mb-3 border-2 border-emerald-400/40">
            <ChefHat className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Fresh<span className="text-emerald-400">DIY</span>
          </h1>
          <p className="text-sm font-semibold text-slate-300 mt-1 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Private Family Kitchen &amp; Meal Aggregator
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8">
          {/* Tab Switcher */}
          <div className="flex bg-slate-900/80 p-1 rounded-2xl mb-6 border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                tab === 'signin'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                tab === 'signup'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Join / Create Account
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              {successMessage}
            </div>
          )}

          {/* Form */}
          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Signing In...' : 'Sign In to Family Kitchen'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Ferris or Valleria"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Family Linking Option */}
              <div className="pt-2 border-t border-slate-700/60">
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Family Kitchen Setup
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setHouseholdMode('create')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                      householdMode === 'create'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    🏠 New Family
                  </button>
                  <button
                    type="button"
                    onClick={() => setHouseholdMode('join')}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                      householdMode === 'join'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    🔗 Join Family Code
                  </button>
                </div>

                {householdMode === 'create' ? (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Household Name
                    </label>
                    <input
                      type="text"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder="e.g. Ferris Family Kitchen"
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      An invite code will be generated so you can link Valleria instantly.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Family Invite Code
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                      <input
                        type="text"
                        required
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="e.g. FAM-8X2Q"
                        className="w-full uppercase font-mono tracking-wider bg-slate-900/80 border border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-xs text-emerald-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ask your partner/friend for their 6-character code or invite link.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
              >
                {loading
                  ? 'Creating Account...'
                  : householdMode === 'join'
                  ? 'Join Family & Sign Up'
                  : 'Create Family Account'}
              </button>
            </form>
          )}
        </div>

        {/* Feature badges */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
          <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <span className="font-bold text-slate-300 block">3,578+ Recipes</span>
            HelloFresh Library
          </div>
          <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <span className="font-bold text-slate-300 block">Multi-User</span>
            Realtime Grocery Sync
          </div>
          <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/40">
            <span className="font-bold text-slate-300 block">Dairy-Free</span>
            Smart Substitutions
          </div>
        </div>
      </div>
    </div>
  );
};
