-- ============================================================================
-- FreshDIY - Household Multi-User Auth & Family Linking Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xamzenezncjsmmvkafxq/sql/new
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Households Table (Each family or friend group gets a unique Household)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'My Family Kitchen',
    invite_code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Household Members (Links individual auth logins to a shared Household)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'Family Member',
    role TEXT NOT NULL DEFAULT 'member', -- 'owner' or 'member'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (household_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. Add household_id columns to shared family tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.cabinet 
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.weekly_plan 
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.grocery_extras 
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

-- Also add active_household_id to public.users if public.users exists
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS active_household_id UUID REFERENCES public.households(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Households: Users can read households they belong to or look up by invite code
DROP POLICY IF EXISTS "Members can view their households" ON public.households;
CREATE POLICY "Members can view their households"
    ON public.households FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR true -- Allows invite code lookup during join flow
        )
    );

DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;
CREATE POLICY "Authenticated users can create households"
    ON public.households FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Household owners can update their household" ON public.households;
CREATE POLICY "Household owners can update their household"
    ON public.households FOR UPDATE
    USING (
        id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'owner')
    );

-- Household Members: Members can view their peers; users can insert their own membership
DROP POLICY IF EXISTS "Members can view peers in household" ON public.household_members;
CREATE POLICY "Members can view peers in household"
    ON public.household_members FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can join households" ON public.household_members;
CREATE POLICY "Users can join households"
    ON public.household_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their member profile" ON public.household_members;
CREATE POLICY "Users can update their member profile"
    ON public.household_members FOR UPDATE
    USING (auth.uid() = user_id);

-- Update RLS for cabinet, weekly_plan, and grocery_extras to support household access
DROP POLICY IF EXISTS "Household access to cabinet" ON public.cabinet;
CREATE POLICY "Household access to cabinet"
    ON public.cabinet FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
            OR (household_id IS NULL AND user_id IS NULL)
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
            OR (household_id IS NULL AND user_id IS NULL)
        )
    );

DROP POLICY IF EXISTS "Household access to weekly_plan" ON public.weekly_plan;
CREATE POLICY "Household access to weekly_plan"
    ON public.weekly_plan FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
            OR (household_id IS NULL AND user_id IS NULL)
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
            OR (household_id IS NULL AND user_id IS NULL)
        )
    );

DROP POLICY IF EXISTS "Household access to grocery_extras" ON public.grocery_extras;
CREATE POLICY "Household access to grocery_extras"
    ON public.grocery_extras FOR ALL
    USING (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
            OR (household_id IS NULL AND user_id IS NULL)
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
            OR user_id = auth.uid()
            OR (household_id IS NULL AND user_id IS NULL)
        )
    );

-- ----------------------------------------------------------------------------
-- 5. Performance Indexes for Multi-Household Queries
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_households_invite_code ON public.households(invite_code);
CREATE INDEX IF NOT EXISTS idx_cabinet_household ON public.cabinet(household_id);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_household ON public.weekly_plan(household_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_grocery_extras_household ON public.grocery_extras(household_id, week_start_date);

-- Enable Supabase Realtime for households and household_members
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
