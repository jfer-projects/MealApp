-- ============================================================================
-- FreshDIY - Household Security, Shared Checks & Settings Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xamzenezncjsmmvkafxq/sql/new
-- ============================================================================

-- 1. Household Settings (Holds Gemini API Key private to this household only)
CREATE TABLE IF NOT EXISTS public.household_settings (
    household_id UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
    gemini_api_key TEXT, -- Accessible ONLY to members of this household
    is_dairy_free BOOLEAN NOT NULL DEFAULT TRUE,
    default_servings INTEGER NOT NULL DEFAULT 4 CHECK (default_servings IN (2, 4, 6)),
    dietary_flags TEXT[] NOT NULL DEFAULT '{}',
    hellofresh_price_per_serving NUMERIC NOT NULL DEFAULT 11.49,
    aisle_order TEXT[] NOT NULL DEFAULT ARRAY[
        'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Dairy Alternatives', 
        'Grains & Bakery', 'Spices & Seasonings', 'Sauces & Condiments', 'Pantry', 'Household & Extras'
    ],
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can access their household settings" ON public.household_settings;
CREATE POLICY "Members can access their household settings"
    ON public.household_settings FOR ALL
    USING (
        auth.uid() IS NOT NULL AND household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

-- 2. Grocery Checks Table (Realtime sync for recipe-derived ingredients)
CREATE TABLE IF NOT EXISTS public.grocery_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    item_key TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT TRUE,
    checked_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (household_id, week_start_date, item_key)
);

ALTER TABLE public.grocery_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can access their grocery checks" ON public.grocery_checks;
CREATE POLICY "Members can access their grocery checks"
    ON public.grocery_checks FOR ALL
    USING (
        auth.uid() IS NOT NULL AND household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

-- 3. Recipe Ratings & Favorites Table
CREATE TABLE IF NOT EXISTS public.recipe_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL,
    rating INTEGER NOT NULL DEFAULT 0, -- 1 = liked, -1 = disliked, 0 = neutral
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    times_cooked INTEGER NOT NULL DEFAULT 0,
    last_cooked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (household_id, recipe_id)
);

ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can access their recipe ratings" ON public.recipe_ratings;
CREATE POLICY "Members can access their recipe ratings"
    ON public.recipe_ratings FOR ALL
    USING (
        auth.uid() IS NOT NULL AND household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

-- 4. Secure RPC function to lookup and join household by invite code (Fixes privacy issue)
CREATE OR REPLACE FUNCTION public.join_household_with_code(
    invite_code_input TEXT,
    member_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated rights to verify code without exposing all households
SET search_path = public
AS $$
DECLARE
    found_household public.households%ROWTYPE;
    caller_id UUID := auth.uid();
BEGIN
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'You must be signed in to join a household.');
    END IF;

    SELECT * INTO found_household
    FROM public.households
    WHERE UPPER(invite_code) = UPPER(TRIM(invite_code_input))
    LIMIT 1;

    IF found_household.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Invalid invite code. Please check with your family member.');
    END IF;

    -- Upsert membership
    INSERT INTO public.household_members (household_id, user_id, display_name, role)
    VALUES (found_household.id, caller_id, COALESCE(NULLIF(TRIM(member_name), ''), 'Family Member'), 'member')
    ON CONFLICT (household_id, user_id) 
    DO UPDATE SET display_name = EXCLUDED.display_name;

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Successfully joined ' || found_household.name,
        'household', jsonb_build_object(
            'id', found_household.id,
            'name', found_household.name,
            'invite_code', found_household.invite_code
        )
    );
END;
$$;

-- 5. Lock down households SELECT policy (Removes open 'OR true')
DROP POLICY IF EXISTS "Members can view their households" ON public.households;
CREATE POLICY "Members can view their households"
    ON public.households FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

-- Add to realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_settings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grocery_checks;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_ratings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
