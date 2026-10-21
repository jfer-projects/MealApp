import { Household, HouseholdMember, UserProfile } from '../types/freshdiy';
import { supabase } from './supabase';

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomStr = '';
  for (let i = 0; i < 4; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FAM-${randomStr}`;
}

export interface SignUpParams {
  email: string;
  password: string;
  displayName: string;
  householdMode: 'create' | 'join';
  householdName?: string;
  inviteCode?: string;
}

export interface AuthResult {
  ok: boolean;
  user?: UserProfile | null;
  message?: string;
  session?: any;
}

/**
 * Sign up a new user and either create a new Household or join an existing Household via invite code.
 */
export async function signUpWithHousehold(params: SignUpParams): Promise<AuthResult> {
  const { email, password, displayName, householdMode, householdName, inviteCode } = params;
  const cleanName = displayName.trim() || 'Me';
  const cleanCode = householdMode === 'join' && inviteCode ? inviteCode.trim().toUpperCase() : null;

  try {
    // Household choices are saved on the account so they still apply if the user
    // has to confirm their email first (there is no session until then).
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        data: {
          display_name: cleanName,
          pending_invite_code: cleanCode,
          pending_household_name: householdMode === 'create' ? householdName?.trim() || null : null,
        },
      },
    });

    if (authError) {
      return { ok: false, message: authError.message };
    }

    const authUser = authData.user;
    if (!authUser) {
      return { ok: false, message: 'Could not create account. Please try again.' };
    }

    if (!authData.session) {
      return {
        ok: true,
        session: null,
        message: cleanCode
          ? `Check your email to confirm your account. You'll join household ${cleanCode} when you first sign in.`
          : 'Check your email to confirm your account, then sign in.',
      };
    }

    const profile = await fetchUserProfile(authUser.id, authUser.email || email);
    return {
      ok: true,
      session: authData.session,
      user: profile,
      message: 'Account created!',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Sign up encountered an unexpected error',
    };
  }
}

/**
 * Sign in existing user
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    const authUser = data.user;
    if (!authUser) {
      return { ok: false, message: 'Invalid credentials' };
    }

    const profile = await fetchUserProfile(authUser.id, authUser.email || email);

    return {
      ok: true,
      session: data.session,
      user: profile,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Sign in failed',
    };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Fetches the user profile and linked household
 */
export async function fetchUserProfile(userId: string, email: string): Promise<UserProfile> {
  try {
    // 1. Fetch household_members for this user
    const { data: memberRows, error: memberErr } = await supabase
      .from('household_members')
      .select('*, households(*)')
      .eq('user_id', userId)
      .limit(1);

    if (!memberErr && memberRows && memberRows.length > 0) {
      const member = memberRows[0];
      const household = (member as any).households as Household;
      return {
        id: userId,
        email,
        display_name: member.display_name || 'Family Member',
        household: household || null,
        household_member: member as HouseholdMember,
      };
    }

    // 2. No household yet (common when email confirmation was on during signup).
    //    Use details saved at signup to join the invited household or create a new one.
    const { data: userData } = await supabase.auth.getUser();
    const meta = (userData?.user?.user_metadata || {}) as Record<string, string | undefined>;
    const displayName = meta.display_name || email.split('@')[0] || 'Me';
    const pendingInvite = meta.pending_invite_code;

    if (pendingInvite) {
      const { data: joinData, error: joinErr } = await supabase.rpc('join_household_with_code', {
        invite_code_input: pendingInvite,
        member_name: displayName,
      });
      if (!joinErr && joinData?.ok) {
        await supabase.auth.updateUser({ data: { pending_invite_code: null } });
        return fetchUserProfile(userId, email);
      }
    }

    const { data: ensured, error: ensureErr } = await supabase.rpc('ensure_my_household', {
      member_name: displayName,
      kitchen_name: meta.pending_household_name || `${displayName}'s Kitchen`,
    });

    if (!ensureErr && ensured?.ok && ensured.household) {
      return {
        id: userId,
        email,
        display_name: ensured.member?.display_name || displayName,
        household: ensured.household as Household,
        household_member: (ensured.member as HouseholdMember) || null,
      };
    }

    if (ensureErr) {
      console.warn(
        'ensure_my_household is unavailable. Run supabase/migration_sync_repair.sql in Supabase.',
        ensureErr.message
      );
    }

    return {
      id: userId,
      email,
      display_name: displayName,
      household: null,
      household_member: null,
    };
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return {
      id: userId,
      email,
      display_name: 'Family Member',
      household: null,
      household_member: null,
    };
  }
}

/**
 * Join an existing household using an invite code
 */
export async function joinHouseholdByCode(
  userId: string,
  inviteCode: string,
  displayName: string
): Promise<{ ok: boolean; message: string; household?: Household }> {
  try {
    const cleanCode = inviteCode.trim().toUpperCase();

    // 1. Try secure RPC function first (prevents leaking all household codes)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('join_household_with_code', {
        invite_code_input: cleanCode,
        member_name: displayName.trim() || 'Family Member',
      });

      if (!rpcError && rpcData) {
        if (rpcData.ok) {
          return {
            ok: true,
            message: rpcData.message,
            household: rpcData.household as Household,
          };
        } else {
          return { ok: false, message: rpcData.message };
        }
      }
    } catch {
      // Fallback to direct query if RPC not installed
    }

    // 2. Direct lookup fallback
    const { data: foundHousehold, error } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (error || !foundHousehold) {
      return { ok: false, message: `Invite code "${cleanCode}" not found. Please verify with your family member.` };
    }

    const household = foundHousehold as Household;

    const { error: joinError } = await supabase
      .from('household_members')
      .upsert({
        household_id: household.id,
        user_id: userId,
        display_name: displayName.trim() || 'Family Member',
        role: 'member',
      });

    if (joinError) {
      return { ok: false, message: joinError.message };
    }

    return {
      ok: true,
      message: `🎉 Successfully joined "${household.name}"!`,
      household,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to join family household',
    };
  }
}

/**
 * Get all members belonging to a household
 */
export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  try {
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data as HouseholdMember[];
  } catch {
    return [];
  }
}
