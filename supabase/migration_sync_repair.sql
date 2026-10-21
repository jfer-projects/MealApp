/* ============================================================================ */
/* FreshDIY - Sync Repair Migration                                             */
/* Safe to run more than once. Run AFTER migration_household_fixes.sql.         */
/*                                                                              */
/* Fixes:                                                                       */
/*  A. household_members policy referenced itself (infinite recursion error),   */
/*     which made household lookups fail.                                       */
/*  B. Creating a household failed because the creator could not read back the */
/*     row they had just inserted.                                              */
/*  C. user_id columns pointed at public.users, which is never populated, so    */
/*     every cabinet / plan / grocery insert failed with a foreign key error.   */
/*  D. Cabinet upserts used a conflict target that did not exist.               */
/*  E. Rows with no household were visible to every account.                    */
/*  F. Recipe forks and feedback were shared across all households.             */
/* ============================================================================ */

/* A. Helper that returns the caller's household ids without triggering RLS */
CREATE OR REPLACE FUNCTION public.my_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_household_ids() TO authenticated;

/* household_members policies (no self reference) */
DROP POLICY IF EXISTS "Members can view peers in household" ON public.household_members;
CREATE POLICY "Members can view peers in household"
    ON public.household_members FOR SELECT
    USING (user_id = auth.uid() OR household_id IN (SELECT public.my_household_ids()));

DROP POLICY IF EXISTS "Users can join households" ON public.household_members;
CREATE POLICY "Users can join households"
    ON public.household_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their member profile" ON public.household_members;
CREATE POLICY "Users can update their member profile"
    ON public.household_members FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave households" ON public.household_members;
CREATE POLICY "Users can leave households"
    ON public.household_members FOR DELETE
    USING (auth.uid() = user_id);

/* B. households: creator can read their own row immediately after insert */
DROP POLICY IF EXISTS "Members can view their households" ON public.households;
CREATE POLICY "Members can view their households"
    ON public.households FOR SELECT
    USING (created_by = auth.uid() OR id IN (SELECT public.my_household_ids()));

DROP POLICY IF EXISTS "Authenticated users can create households" ON public.households;
CREATE POLICY "Authenticated users can create households"
    ON public.households FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Household owners can update their household" ON public.households;
CREATE POLICY "Household owners can update their household"
    ON public.households FOR UPDATE
    USING (id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid() AND role = 'owner'));

/* Atomic "get or create my household" used on first sign-in */
CREATE OR REPLACE FUNCTION public.ensure_my_household(
    member_name TEXT,
    kitchen_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id UUID := auth.uid();
    found_member public.household_members%ROWTYPE;
    found_household public.households%ROWTYPE;
    new_code TEXT;
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    i INTEGER;
BEGIN
    IF caller_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Not signed in');
    END IF;

    SELECT * INTO found_member FROM public.household_members
    WHERE user_id = caller_id ORDER BY created_at ASC LIMIT 1;

    IF found_member.id IS NOT NULL THEN
        SELECT * INTO found_household FROM public.households WHERE id = found_member.household_id;
    ELSE
        SELECT * INTO found_household FROM public.households
        WHERE created_by = caller_id ORDER BY created_at ASC LIMIT 1;

        IF found_household.id IS NULL THEN
            LOOP
                new_code := 'FAM-';
                FOR i IN 1..4 LOOP
                    new_code := new_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
                END LOOP;
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.households WHERE invite_code = new_code);
            END LOOP;

            INSERT INTO public.households (name, invite_code, created_by)
            VALUES (COALESCE(NULLIF(TRIM(kitchen_name), ''), 'Our Kitchen'), new_code, caller_id)
            RETURNING * INTO found_household;
        END IF;

        INSERT INTO public.household_members (household_id, user_id, display_name, role)
        VALUES (found_household.id, caller_id, COALESCE(NULLIF(TRIM(member_name), ''), 'Me'), 'owner')
        ON CONFLICT (household_id, user_id) DO NOTHING
        RETURNING * INTO found_member;

        IF found_member.id IS NULL THEN
            SELECT * INTO found_member FROM public.household_members
            WHERE user_id = caller_id AND household_id = found_household.id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'household', to_jsonb(found_household),
        'member', to_jsonb(found_member)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_household(TEXT, TEXT) TO authenticated;

/* C. Point user_id columns at auth.users instead of the empty public.users */
ALTER TABLE public.cabinet DROP CONSTRAINT IF EXISTS cabinet_user_id_fkey;
ALTER TABLE public.cabinet ADD CONSTRAINT cabinet_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.weekly_plan DROP CONSTRAINT IF EXISTS weekly_plan_user_id_fkey;
ALTER TABLE public.weekly_plan ADD CONSTRAINT weekly_plan_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.grocery_extras DROP CONSTRAINT IF EXISTS grocery_extras_user_id_fkey;
ALTER TABLE public.grocery_extras ADD CONSTRAINT grocery_extras_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.recipe_feedback DROP CONSTRAINT IF EXISTS recipe_feedback_user_id_fkey;
ALTER TABLE public.recipe_feedback ADD CONSTRAINT recipe_feedback_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

/* Recipes are served from the static catalog file, so not every recipe exists */
/* in the recipes table. Plan rows and feedback must not require that.          */
ALTER TABLE public.weekly_plan DROP CONSTRAINT IF EXISTS weekly_plan_recipe_id_fkey;
ALTER TABLE public.recipe_feedback DROP CONSTRAINT IF EXISTS recipe_feedback_recipe_id_fkey;
ALTER TABLE public.recipe_feedback DROP CONSTRAINT IF EXISTS recipe_feedback_forked_recipe_id_fkey;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_original_id_fkey;

/* D. Cabinet uniqueness per household + location quantity columns */
ALTER TABLE public.cabinet DROP CONSTRAINT IF EXISTS cabinet_user_id_item_name_key;
DROP INDEX IF EXISTS public.idx_cabinet_shared_item_name;
ALTER TABLE public.cabinet ALTER COLUMN category TYPE TEXT;
ALTER TABLE public.cabinet ADD COLUMN IF NOT EXISTS freezer_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cabinet ADD COLUMN IF NOT EXISTS fridge_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cabinet ADD COLUMN IF NOT EXISTS pantry_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.cabinet ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pkg';
DELETE FROM public.cabinet a
    USING public.cabinet b
    WHERE a.household_id IS NOT DISTINCT FROM b.household_id
      AND a.item_name = b.item_name
      AND a.ctid < b.ctid;
DO $$
BEGIN
    ALTER TABLE public.cabinet ADD CONSTRAINT cabinet_household_item_key UNIQUE (household_id, item_name);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

/* E. Household-only access for shared tables (no more ownerless shared rows) */
DROP POLICY IF EXISTS "Household access to cabinet" ON public.cabinet;
CREATE POLICY "Household access to cabinet"
    ON public.cabinet FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()) OR (household_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()) OR (household_id IS NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Household access to weekly_plan" ON public.weekly_plan;
CREATE POLICY "Household access to weekly_plan"
    ON public.weekly_plan FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()) OR (household_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()) OR (household_id IS NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Household access to grocery_extras" ON public.grocery_extras;
CREATE POLICY "Household access to grocery_extras"
    ON public.grocery_extras FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()) OR (household_id IS NULL AND user_id = auth.uid()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()) OR (household_id IS NULL AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can access their household settings" ON public.household_settings;
CREATE POLICY "Members can access their household settings"
    ON public.household_settings FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()));

DROP POLICY IF EXISTS "Members can access their grocery checks" ON public.grocery_checks;
CREATE POLICY "Members can access their grocery checks"
    ON public.grocery_checks FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()));

DROP POLICY IF EXISTS "Members can access their recipe ratings" ON public.recipe_ratings;
CREATE POLICY "Members can access their recipe ratings"
    ON public.recipe_ratings FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()));

/* Grocery extras: recurring staples carry over to each new week */
ALTER TABLE public.grocery_extras ADD COLUMN IF NOT EXISTS is_staple BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.grocery_extras ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.grocery_extras ADD COLUMN IF NOT EXISTS added_by_name TEXT;

/* F. Recipe forks and feedback belong to a household */
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.recipe_feedback ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Allow public read access to recipes" ON public.recipes;
DROP POLICY IF EXISTS "Allow household write access to recipes" ON public.recipes;
DROP POLICY IF EXISTS "Read catalog and own household forks" ON public.recipes;
CREATE POLICY "Read catalog and own household forks"
    ON public.recipes FOR SELECT
    USING (household_id IS NULL OR household_id IN (SELECT public.my_household_ids()));
DROP POLICY IF EXISTS "Write own household forks" ON public.recipes;
CREATE POLICY "Write own household forks"
    ON public.recipes FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()));

DROP POLICY IF EXISTS "Allow household access to recipe_feedback" ON public.recipe_feedback;
DROP POLICY IF EXISTS "Household access to recipe_feedback" ON public.recipe_feedback;
CREATE POLICY "Household access to recipe_feedback"
    ON public.recipe_feedback FOR ALL
    USING (household_id IN (SELECT public.my_household_ids()))
    WITH CHECK (household_id IN (SELECT public.my_household_ids()));

/* Realtime for ratings (ignore if already added) */
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_ratings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
