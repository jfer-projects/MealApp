-- ============================================================================
-- FreshDIY - Phase 1 Database Schema (Supabase / PostgreSQL)
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xamzenezncjsmmvkafxq/sql/new
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Custom Enum Types
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE stock_status AS ENUM ('in_stock', 'low', 'out_of_stock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE feedback_status AS ENUM ('pending', 'processing', 'applied', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE plan_status AS ENUM ('planned', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE day_of_week_enum AS ENUM (
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Users Table (Extends Supabase auth.users with FreshDIY household defaults)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL DEFAULT 'Parent',
    partner_name TEXT NOT NULL DEFAULT 'Valleria',
    partner_phone TEXT,
    default_servings INTEGER NOT NULL DEFAULT 4 CHECK (default_servings IN (2, 4, 6)),
    is_dairy_free BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Recipes Table (Stores HelloFresh scraped data and AI versions v1 -> v2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    original_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    source_slug TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    prep_time INTEGER NOT NULL DEFAULT 30,
    base_servings INTEGER NOT NULL DEFAULT 4 CHECK (base_servings IN (2, 4, 6)),
    tags TEXT[] NOT NULL DEFAULT '{}',
    image_url TEXT,
    instructions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ingredients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    version_notes TEXT,
    is_latest BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_recipe_original_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.original_id IS NULL THEN
        NEW.original_id := NEW.id;
    END IF;
    IF NEW.version > 1 AND NEW.is_latest = TRUE THEN
        UPDATE public.recipes
        SET is_latest = FALSE, updated_at = NOW()
        WHERE original_id = NEW.original_id
          AND id <> NEW.id
          AND is_latest = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_recipe_original_id ON public.recipes;
CREATE TRIGGER trg_set_recipe_original_id
BEFORE INSERT ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.set_recipe_original_id();

-- ----------------------------------------------------------------------------
-- 4. Recipe Feedback Table (Triggers AI Recipe Forking v1 -> v2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipe_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'Family',
    notes TEXT NOT NULL,
    status feedback_status NOT NULL DEFAULT 'pending',
    forked_recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Cabinet Table (User's Pantry Inventory & Spice Tracker)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cabinet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Spices',
    status stock_status NOT NULL DEFAULT 'in_stock',
    usage_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_name)
);

-- Unique index for shared household rows where user_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_cabinet_shared_item_name
    ON public.cabinet(item_name) WHERE user_id IS NULL;

-- ----------------------------------------------------------------------------
-- 6. Weekly Plan Table (Selected Meals, Day of Week & Servings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    day_of_week day_of_week_enum NOT NULL,
    servings INTEGER NOT NULL DEFAULT 4 CHECK (servings IN (2, 4, 6)),
    status plan_status NOT NULL DEFAULT 'planned',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Grocery Extras Table (Custom Household Items for "Send to Valleria")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grocery_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
    item_name TEXT NOT NULL,
    aisle TEXT NOT NULL DEFAULT 'Household & Extras',
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recipes_is_latest ON public.recipes(is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_recipes_original_id ON public.recipes(original_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON public.recipes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_weekly_plan_user_week ON public.weekly_plan(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_cabinet_user_status ON public.cabinet(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recipe_feedback_recipe ON public.recipe_feedback(recipe_id, status);

-- ----------------------------------------------------------------------------
-- 9. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabinet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to recipes"
    ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Allow household write access to recipes"
    ON public.recipes FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow household access to recipe_feedback"
    ON public.recipe_feedback FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Household access to users"
    ON public.users FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Household access to cabinet"
    ON public.cabinet FOR ALL
    USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Household access to weekly_plan"
    ON public.weekly_plan FOR ALL
    USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Household access to grocery_extras"
    ON public.grocery_extras FOR ALL
    USING (user_id IS NULL OR auth.uid() = user_id)
    WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
