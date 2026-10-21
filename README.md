# FreshDIY — Family HelloFresh Replicator & Dairy-Free Kitchen Engine

Built for a family of 4 (2 adults, 2 kids — You & **Valleria**). Defaults to **4 servings** and **Dairy-Free Mode (`isDairyFree = true`)**.

## Core Features Included
- **Phase 1 — Supabase Database Architecture**: Full PostgreSQL schema, triggers (`v1` ➔ `v2` automatic `is_latest` rotation), and RLS policies in [`supabase/schema.sql`](./supabase/schema.sql).
- **Phase 2 — Python HelloFresh Scraper**: [`scripts/scrape_hellofresh.py`](./scripts/scrape_hellofresh.py) scrapes and builds **70 structured HelloFresh family recipes** (`public/data/hellofresh_recipes.json`) with Appliance Adaptations (**Air Fryer** & **Rice Cooker**) and upserts them to Supabase.
- **Phase 3 — React + Vite + Tailwind + Lucide Frontend**:
  - **Catalog & Planner View**: Instant filters (`Kid-Friendly`, `Under 30 Mins`, `Sheet Pan`, `Air Fryer`, `Rice Cooker`), dynamic `2 / 4 / 6` serving size scaling, and 7-day weekly meal planner.
  - **Spice & Pantry Cabinet + Proprietary Blend Decoder**: Tracks `in_stock`, `low`, and `out_of_stock` items and decodes 10 HelloFresh proprietary blends (`Fry Seasoning`, `Sweet Soy Glaze`, `Southwest Spice Blend`, `Tuscan Heat Spice`, etc.) against live cabinet inventory.
  - **Smart Grocery List & "Send to Valleria"**: Deduplicates weekly ingredients, crosses off items already `in_stock` in your Cabinet, routes all substituted dairy items to the **Dairy Alternatives** aisle, and shares via Web Share API / SMS to Valleria.
  - **Cooking View & AI Recipe Versioning (`v1` ➔ `v2`)**: Interactive step-by-step cards with countdown timers, Air Fryer / Rice Cooker step diversion toggles, and post-meal feedback form that automatically forks the recipe JSON and publishes `v2`.
- **Phase 4 — Workflow Optimizations**: Clicking **"Complete Week & Auto-Deduct Cabinet"** automatically increments usage and transitions utilized spices/sauces (`in_stock` ➔ `low` ➔ `out_of_stock`).
