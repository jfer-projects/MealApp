# FreshDIY — App Features & Capabilities Guide

**FreshDIY** is an intelligent, family-first meal planning, kitchen inventory, and store-optimized grocery app. It replicates the HelloFresh gourmet experience at a fraction of the cost, with automatic dairy-free substitutions, multi-location inventory tracking, and zero-backtracking store navigation.

---

## 1. 🍽️ Smart Recipe Catalog & HelloFresh Experience

- **3,500+ Scraped Recipes**: Browse authentic HelloFresh recipes with step-by-step instructions, ingredients, cook times, and difficulty ratings.
- **Dynamic Servings Scaling**: Scale any recipe between **2, 4, or 6 servings** on the fly. Ingredient quantities, units, and instruction step descriptions recalculate automatically.
- **Proprietary Blend Decoder**: Reconstitutes HelloFresh proprietary spice packets (*Southwest Spice, Fry Seasoning, Tuscan Heat, Sweet & Smoky BBQ Seasoning, Frank's RedHot Seasoning, Shawarma Spice*, etc.) using staple household spices.
- **Blend Readiness Checker**: 1-tap check to see if you have the base spices in stock to mix a blend at home instead of buying a pre-made packet.

---

## 2. 🌱 Automatic Dairy-Free Substitution Engine

- **Family-Safe Replacements**: When Dairy-Free Mode is active, all dairy ingredients automatically transform into plant-based equivalents:
  - Butter ➔ Plant Butter / Vegan Butter
  - Sour Cream ➔ Dairy-Free Sour Cream
  - Milk / Cream ➔ Unsweetened Oat Milk / Coconut Cream
  - Shredded Cheese ➔ Dairy-Free Cheddar / Mozzarella (Violife, Miyoko’s, Daiya)
  - Cream Cheese ➔ Dairy-Free Cream Cheese (Kite Hill)
- **Store-Routing Integration**: Substituted items are automatically routed to **Aisle 1 (Natural & Plant-Based)** instead of the standard dairy coolers.

---

## 3. 🧊 Multi-Location Kitchen Inventory (Freezer, Fridge & Pantry)

- **Unified Item Cards**: Keeps your inventory clean. Instead of separate cards for the same food, each card tracks:
  - **Deep Freezer / Freezer Qty** (e.g., 3 ground turkey packs)
  - **Refrigerator Qty** (e.g., 1 ground turkey pack thawing)
  - **Pantry Qty**
- **1-Tap Thaw Button (`❄️➔🥛 Move 1 to Fridge`)**: Thawing meat or frozen veggies moves 1 unit from Freezer to Fridge with a single tap.
- **Smart Meal Auto-Deduction**: Marking a meal "Completed" deducts ingredients from your **Fridge first** (prioritizing thawed food), then Freezer, then Pantry.
- **AI Camera Photo Scanner**:
  - Point your phone camera at a spice rack, refrigerator shelf, or deep freezer chest.
  - Google Gemini Vision AI identifies visible items and auto-imports them with categories and quantities.
  - **Shared Household Key & Privacy Protection**: When an admin adds a Gemini API key for their household, all family members in that household automatically inherit and share full access to photo scanning and AI features without needing their own key. For security, the secret API key string is masked and protected from non-author family members.
  - **Works Identically for Friends & Spouses**: When your friend sets up his own household and enters his key, his wife instantly inherits his key when she joins his family via invite code — she never has to enter a key, and their key remains completely isolated to their household.

---

## 4. 📅 Weekly Meal Planner & Auto-Planner

- **Weekly Calendar (Mon–Sun)**: Schedule meals across dated weeks with quick navigation.
- **"✨ Fill My Week" Auto-Planner**: Automatically plans your week based on family meal ratings, favorites, and variety.
- **Family Ratings & Cook History**: Rate recipes (thumbs up/down, favorites ❤️), track how many times a meal has been cooked, and view when you last cooked it.
- **Cost Savings Radar**: Compares your weekly grocery total against the estimated cost of a HelloFresh box, showing weekly and annual family savings.
- **Weekly Macro Nutrition**: Calculates average calories, protein, carbs, fats, and fiber per serving for the scheduled week.

---

## 5. 🛒 Store-Optimized Grocery List & Walking Route

- **Weekly Aggregated List**: Deduplicates ingredients across all scheduled meals into combined amounts.
- **Pantry Strike-Through**: Items already `in_stock` in your cabinet are automatically crossed off so you never double-buy.
- **Stop & Shop (950 American Legion Hwy, Roslindale, MA) Route**:
  - **13 Sequential Walking Steps** organized for zero backtracking:
    1. Produce & Fresh Herbs (Front Entrance)
    2. Bakery & Fresh Bread (Left Wall)
    3. Natural, Organic & Plant-Based (Aisle 1)
    4. Rice, Grains & International (Aisle 2)
    5. Pasta, Sauces & Canned Goods (Aisle 3)
    6. Cooking Oils, Vinegars & Condiments (Aisle 4)
    7. Spices, Seasonings & Baking (Aisle 5)
    8. Coffee, Tea & Cereals (Aisle 6)
    9. Snacks, Crackers & Drinks (Aisle 7)
    10. Household & Paper Towels (Aisle 8)
    11. Fresh Meat & Seafood Counter (Back Wall)
    12. Frozen Foods (Aisles 9 & 10)
    13. Dairy & Eggs (Right Wall — *kept cold last right before checkout!*)
  - **Trip Progress Bar**: Real-time counter of departments cleared and items collected.
  - **Aisle & Location Badges**: Every card shows its exact Stop & Shop location (e.g., `📍 Aisle 1 • Plant-Based`, `📍 Back Wall • Meat Counter`).
- **📋 Paste List from Notes**: Copy and paste any shared note (Apple Notes, Google Keep, texts); FreshDIY strips bullets, checkmarks, and numbers, and auto-sorts each item to its store aisle.
- **Check-off ➔ Move to Inventory**: Checking off an item in the store prompts to move it straight into Kitchen Inventory (with a "Remember my choice" option).

---

## 6. 📱 Multi-Shopper Real-Time Live Sync & Sharing

- **Simultaneous In-Store Shopping**:
  - If two family members are shopping at the same time on two phones (joined under the same household invite code), checking off an item on one phone **instantly syncs and checks off in real time** on the other phone via Supabase Realtime!
  - Cross-tab `BroadcastChannel` support allows instantaneous zero-latency local testing.
- **"Share with Family" / Email List**: 1-tap button formats the grocery list with store aisle sequencing and sends via SMS, Apple Share sheet, or Email.

---

## 7. 🤖 AI Recipe Forking & Versioning Loop

- **Post-Meal Family Feedback**: Log feedback after dinner (e.g., *"Too salty"*, *"Kids loved it, make it spicier next time"*, *"Cut garlic by 50%"*).
- **Automated Versioning (v1 ➔ v2 ➔ v3)**: Gemini AI forks the recipe JSON, scales the ingredients, updates the instruction steps, and publishes the new version as your family's default!
