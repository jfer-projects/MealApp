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

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim() || 'Parent',
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

    let household: Household | null = null;
    let membership: HouseholdMember | null = null;

    if (householdMode === 'join' && inviteCode) {
      const cleanCode = inviteCode.trim().toUpperCase();
      const { data: foundHousehold, error: findError } = await supabase
        .from('households')
        .select('*')
        .eq('invite_code', cleanCode)
        .maybeSingle();

      if (findError || !foundHousehold) {
        return {
          ok: true,
          user: {
            id: authUser.id,
            email: authUser.email || email,
            display_name: displayName,
          },
          message: `Account created, but invite code "${cleanCode}" was not found. You can link your family later in Settings.`,
        };
      }

      household = foundHousehold as Household;

      // Insert membership
      const { data: newMember } = await supabase
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: authUser.id,
          display_name: displayName.trim() || 'Family Member',
          role: 'member',
        })
        .select()
        .single();

      membership = newMember as HouseholdMember;
    } else {
      // Create new Household
      const newCode = generateInviteCode();
      const hName = householdName?.trim() || `${displayName.trim()}'s Family Kitchen`;

      const { data: createdHousehold, error: hError } = await supabase
        .from('households')
        .insert({
          name: hName,
          invite_code: newCode,
          created_by: authUser.id,
        })
        .select()
        .single();

      if (!hError && createdHousehold) {
        household = createdHousehold as Household;

        const { data: newMember } = await supabase
          .from('household_members')
          .insert({
            household_id: household.id,
            user_id: authUser.id,
            display_name: displayName.trim() || 'Parent',
            role: 'owner',
          })
          .select()
          .single();

        membership = newMember as HouseholdMember;
      }
    }

    return {
      ok: true,
      session: authData.session,
      user: {
        id: authUser.id,
        email: authUser.email || email,
        display_name: displayName,
        household,
        household_member: membership,
      },
      message: 'Account successfully created!',
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

    if (memberErr || !memberRows || memberRows.length === 0) {
      // Check if user created a household directly
      const { data: directHousehold } = await supabase
        .from('households')
        .select('*')
        .eq('created_by', userId)
        .limit(1);

      if (directHousehold && directHousehold.length > 0) {
        const h = directHousehold[0] as Household;
        // Auto-link owner membership
        const { data: createdMember } = await supabase
          .from('household_members')
          .upsert({
            household_id: h.id,
            user_id: userId,
            display_name: 'Parent',
            role: 'owner',
          })
          .select()
          .single();

        return {
          id: userId,
          email,
          display_name: createdMember?.display_name || 'Parent',
          household: h,
          household_member: createdMember as HouseholdMember,
        };
      }

      // If user is authenticated but has no household yet (e.g. signup occurred before email confirmation),
      // auto-create a real private household with a unique invite code.
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userMeta = userData?.user?.user_metadata;
        const displayName = userMeta?.display_name || email.split('@')[0] || 'My';
        const newCode = generateInviteCode();
        const kitchenName = `${displayName}'s Kitchen`;

        const { data: newHousehold, error: hCreateErr } = await supabase
          .from('households')
          .insert({
            name: kitchenName,
            invite_code: newCode,
            created_by: userId,
          })
          .select()
          .single();

        if (!hCreateErr && newHousehold) {
          const { data: newMember } = await supabase
            .from('household_members')
            .insert({
              household_id: newHousehold.id,
              user_id: userId,
              display_name: displayName,
              role: 'owner',
            })
            .select()
            .single();

          return {
            id: userId,
            email,
            display_name: displayName,
            household: newHousehold as Household,
            household_member: newMember as HouseholdMember,
          };
        }
      } catch (autoCreateErr) {
        console.warn('Auto-create household fallback error:', autoCreateErr);
      }

      return {
        id: userId,
        email,
        display_name: 'Family Member',
        household: null,
        household_member: null,
      };
    }

    const member = memberRows[0];
    const household = (member as any).households as Household;

    return {
      id: userId,
      email,
      display_name: member.display_name || 'Family Member',
      household: household || null,
      household_member: member as HouseholdMember,
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
