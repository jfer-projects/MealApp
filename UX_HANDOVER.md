# FreshDIY UX handover

Oct 21, 2026 · @Johnathan Ferrick

Seventeen visual and UX changes to [freshdiy.netlify.app](https://freshdiy.netlify.app/), found in a review at phone width. Fix the three Priority 1 items first; everything else can land in any order.

## Context

FreshDIY is a private family meal planner built on a library of 3,578 HelloFresh recipes, with dairy-free substitutions, a kitchen inventory and a store-ordered grocery list. It is used mainly on phones, so every change must be designed and checked at 375 px wide first.

The app has four tabs in a bottom bar, plus a raised SCAN button in the middle:

| Tab | What it holds |
| --- | --- |
| Planner | Weekly meal plan (Mon–Sun), servings picker, fridge-based recommendations, filters, recipe grid |
| Inventory | Running-low list, freezer/fridge/pantry items, HelloFresh blend decoder |
| Grocery | Week picker, sharing controls, store route for Stop & Shop Roslindale, weekly staples |
| Cook | Recipe detail: ingredients, steps with timers, cooked feedback, AI recipe versioning (v1 to v2) |

Ground rules for the implementer:

- These findings come from using the live app, not from reading the code. Confirm each one in the code before changing it, and note anywhere the code disagrees.
- Keep the current look: dark green brand colour, rounded cards, the header and bottom bar. Do not restyle the app beyond what an item asks for.
- Do not change data, accounts or the recipe import unless an item says so.
- Keep each item a separate commit so they can be reviewed one at a time.

## Priority 1: bugs

These three either block navigation or give wrong information to a dairy-free household. Fix them before anything else.

### 1. Netlify badge covers the bottom bar

- **Problem:** The floating "Powered by Netlify" badge sits over the bottom bar, bottom right. On a phone it hides the Grocery and Cook tabs and blocks taps on them.
- **Change:** Remove the badge. It is usually turned off in the Netlify site settings, or comes from a script or component in the app. If it cannot be removed, move it so it never overlaps the bottom bar.
- **Done when:** At 375 px wide, all five bottom-bar buttons (Planner, Inventory, SCAN, Grocery, Cook) are fully visible and tappable on every tab.

### 2. Dairy-free mode misses cheese

- **Problem:** With dairy-free on, the Pork Bolognese Pasta Casserole recipe swaps milk for oat milk and butter for plant-based butter. But it still lists "Mozzarella Cheese 1½ cup", and step 5 still says to sprinkle mozzarella. Other recipe cards do show "Dairy-Free Shredded Cheese", so the swap works for some names but not others.
- **Change:** Make the dairy matching cover every common dairy name, case-insensitive: cheese, mozzarella, cheddar, parmesan, monterey jack, feta, ricotta, cream cheese, sour cream, cream, crème fraîche, yogurt, butter, milk, ghee. Apply the same swap to the step text, not only the ingredient list.
- **Done when:** With dairy-free on, no recipe's ingredients or steps name an unswapped dairy item. Spot-check at least 20 recipes, including Pork Bolognese Pasta Casserole, Cheesy Smashed Pork Burgers and Cottage Pie with Chicken.

### 3. Blend status contradicts itself

- **Problem:** Recipe cards tag Fry Seasoning with the ✨ blend marker, as if it is covered. In Inventory, the blend decoder marks the same Fry Seasoning as "Missing Item".
- **Change:** Decide one rule for when a blend counts as available (for example, you hold it, or you hold every base spice to make it). Use that rule on recipe cards, recipe ingredients, the Smart Recipe match % and the blend decoder.
- **Done when:** A blend shows the same status everywhere it appears.

## Priority 2: visual and layout

### 4. Compact recipe cards

- **Problem:** The Planner recipe grid shows 24 large cards at a time. Each card has a photo, four tags, five ingredients plus "+N more", and two buttons, so the page runs for many screens on a phone.
- **Change:** Show a compact card in the grid: photo, title (2 lines max), cook time, % on hand, a favourite heart and one "Add" button. Move the ingredient list to the recipe detail view.
- **Done when:** At 375 px, at least two full cards fit on one screen.

### 5. One scan entry point

- **Problem:** Scanning appears five times: "Scan" in the header, "SCAN" in the bottom bar, "Snap Fridge Photo" on Planner, and "Scan Freezer" and "Scan Pantry/Spices" on Inventory.
- **Change:** Keep only the SCAN button in the bottom bar. Tapping it asks what you are scanning: Fridge, Freezer, or Pantry/Spices. Remove the header Scan button. The in-page buttons can stay only if they open the same picker with that choice already made.
- **Done when:** There is one scan flow, reachable from the bottom bar on every tab.

### 6. Accurate recipe tags

- **Problem:** Nearly every card shows the same four tags: Kid-Friendly, Under 30 Mins, Sheet Pan, Air Fryer. This includes Beef Tenderloin with a 30-minute time, so the tags look like defaults rather than real data.
- **Change:** Check how tags are assigned. Only show a tag when the recipe data supports it (for example, Under 30 Mins only when total time is under 30). Show at most two tags per card.
- **Done when:** Tags vary across recipes and match each recipe's data.

### 7. Clean recipe titles and group variants

- **Problem:** Some imported titles keep HelloFresh upsell text, such as "\[UPGRADE CHICKEN CUTLETS TO DOUBLE ORGANIC CHICKEN CUTLETS\] Sheet Pan Crunchy Chicken…". Near-duplicates also sit side by side, such as Creamy Dijon Dill Salmon and Creamy Dijon Dill Trout.
- **Change:** Strip any leading text in square brackets from titles, on import or on display. Optionally group recipes that differ only by protein into one card with a variant picker.
- **Done when:** No card title starts with a bracket.

### 8. Readable quantities

- **Problem:** Quantities such as "10 unit Potatoes", "2 unit Ketchup", "1 unit Salt" and "1 ounce Broccoli" are confusing.
- **Change:** Hide the word "unit" ("10 Potatoes"). Show salt, pepper and cooking oil as "to taste" or "as needed". Use plural names for counts above 1.
- **Done when:** The word "unit" does not appear anywhere in the app.

### 9. Clearer header

- **Problem:** "DF: ON" is cryptic. The subtitle "3,578 HelloFresh…" is cut off. The people icon on the right has no label.
- **Change:** Replace "DF: ON" with a leaf icon and the word "Dairy-free", styled as an on/off switch. Hide the subtitle below 480 px. Give the people icon a label or a tooltip ("Family") and an accessible name.
- **Done when:** A first-time user can tell what each header control does without tapping it.

### 10. Small text fixes

- "+ + Add Item" on Inventory has a doubled plus sign; show one.
- "Onion Pow…" is cut off in the Running Low card; let item names wrap to two lines.
- Several buttons pair an emoji with an icon that means the same thing, such as 📸 beside a camera icon or ✨ beside a wand icon; keep the icon and drop the emoji.
- Rename "Ingredients You Have Run Out Of / Running Low" to "Running low".
- On the sign-in page, rename the tab "Join / Create Account" to "Create account" and the button "Sign In to Family Kitchen" to "Sign in". Add a "Forgot password?" link.

### 11. Hide the v1 badge

- **Problem:** Every card shows a "v1" badge, which means nothing to a new user.
- **Change:** Only show a version badge once a recipe has a v2 or later.
- **Done when:** Recipes that were never forked show no version badge.

## Priority 3: usability

### 12. Planner: make the empty week actionable

- **Problem:** With 0/7 days planned, the only way to fill a day is to scroll down to a recipe card and tap "+ Add to Mon". The day pills also run off the right edge, so Thursday to Sunday are hidden.
- **Change:** Make "Fill My Week" the clear primary action when the week is empty. Fit all seven days on one row. Give each empty day a "+" that opens recipe search with that day already chosen.
- **Done when:** A user can plan any day of the week without scrolling, and all seven days are visible at 375 px.

### 13. Planner: clearer servings picker

- **Problem:** "2p / 4p / 6p" is not obvious, and the same "(4p)" appears on every Add button.
- **Change:** Label the picker "Serves" with options 2, 4 and 6. Drop "(4p)" from the Add buttons.
- **Done when:** No button or label in the app uses "p" for people.

### 14. Cook: a calmer step-by-step view

- **Problem:** Some steps are titled "Step 1" and others use their first sentence. Finished steps stay expanded. Timers are in-page only.
- **Change:**
  - Title every step the same way ("Step 1", "Step 2"…).
  - When "Mark Done" is tapped, collapse that step and scroll to the next one.
  - Keep the screen awake while the Cook view is open, using the Screen Wake Lock API where the browser supports it.
  - Keep timers running if the user switches tabs, and alert when one ends.
- **Done when:** A whole recipe can be cooked from a phone without the screen sleeping or losing a timer.

### 15. Grocery: put the list first

- **Problem:** Seven controls (week picker, Shopping As, On Check, Paste List, Email List, Share with Family, store card) come before any grocery item. "Kids Organic Apple Sauce Pouches" is filed under Produce / Front Entrance.
- **Change:** Keep the week picker and Share at the top. Move Shopping As, On Check, Paste and Email into a settings sheet behind one button. Show the list or store route right below. Re-file apple sauce pouches under a packaged-snacks or kids aisle.
- **Done when:** At 375 px, the first grocery item is visible without scrolling.

### 16. Inventory: calmer blend decoder

- **Problem:** Every blend in "HelloFresh Proprietary Blend & Glaze Decoder" shows a red "Missing Item" badge. A wall of red reads as errors, though the user never asked for those items.
- **Change:** Use a neutral badge such as "Make it yourself", and keep red only for items the user marked Low or Out.
- **Done when:** Red appears in Inventory only for items the user has marked Low or Out.

### 17. Stop cards flashing blank while scrolling

- **Problem:** While scrolling the recipe grid, cards appear as empty white space, and photos and text pop in a moment later.
- **Change:** Give each card image a fixed aspect ratio so space is reserved, and show a grey skeleton until it loads. Check for scroll-triggered fade-in animations that start cards invisible, and remove them.
- **Done when:** Fast scrolling the grid on a phone never shows blank card areas.

## Tracker

Antigravity has already made a design pass that overlaps items 4, 5, 9, 10 and 12. That work is in the code but not deployed (the site has no auto-deploy), so start from the latest code, not the live site. For those five items, check what Antigravity changed and do only what is left.

| # | Item | Priority | Already done by Antigravity (undeployed) | Left to do | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Netlify badge covers bottom bar | 1 | Nothing | None — suppressed floating badge & raised mobile nav z-index + safe-area inset (`36bdb12`) | Done |
| 2 | Dairy-free mode misses cheese | 1 | Relabelled "DF" to "Dairy-Free" only | None — expanded `DAIRY_SUBSTITUTION_MATRIX` to cover all cheeses, creams, butter, milk & step text (`7992b50`) | Done |
| 3 | Blend status contradicts itself | 1 | Nothing | None — unified `evaluateBlendStock` across Planner, Cook, Grocery & Inventory (`91f52eb`) | Done |
| 4 | Compact recipe cards | 2 | Shrank the fridge matcher card (\~60% shorter) and the empty-day box | None — compact 2-column mobile grid cards with photo, 2-line title, cook time, % on hand, heart & single Add button (`665d06b`) | Done |
| 5 | One scan entry point | 2 | Removed the header Scan button on mobile | None — consolidated into single bottom-bar SCAN flow with Fridge / Freezer / Pantry picker (`364f902`) | Done |
| 6 | Accurate recipe tags | 2 | Nothing | None — `computeAccurateRecipeTags` assigns tags strictly from real prep time, equipment & ingredients (`57bc0e9`) | Done |
| 7 | Clean titles, group variants | 2 | Nothing | None — `cleanRecipeTitle` strips leading HelloFresh upsell brackets (`9b1d72d`) | Done |
| 8 | Readable quantities | 2 | Nothing | None — removed "unit" label, formatted salt/pepper/oil as "to taste"/"as needed", pluralized countable items (`e717258`) | Done |
| 9 | Clearer header | 2 | Moved Dairy-Free to a filter-bar chip and a Family Settings toggle; labelled Family; replaced the cut-off subtitle with the household name | None — styled Dairy-free as visual on/off switch with Leaf icon, hid subtitle below 480px, verified 375px fit (`2adbfb3`) | Done |
| 10 | Small text fixes | 2 | Removed emoji + icon pairs on Planner | None — fixed doubled `+`, wrapped Running low names, updated Sign in / Create account / Forgot password (`88cc791`) | Done |
| 11 | Hide the v1 badge | 2 | Nothing | None — hid `v1` badge on never-forked recipes (`749b7b8`) | Done |
| 12 | Planner: actionable empty week | 3 | Seven-column day grid, so Sunday is no longer cut off; one-line empty-day bar | None — made "Fill My Week" primary CTA and added inline `+` day recipe search picker (`8f9f97e`) | Done |
| 13 | Planner: clearer servings picker | 3 | Nothing | None — labelled pickers "Serves 2 / 4 / 6" and removed "p" suffix (`cdef8e8`) | Done |
| 14 | Cook: calmer step view | 3 | Nothing | None — uniform "Step N" titles, auto-collapsing completed steps with smooth scroll, persistent timers & Wake Lock (`17f12ea`) | Done |
| 15 | Grocery: list first | 3 | Nothing | None — moved secondary controls to Options sheet, placed store route/list first, routed apple sauce pouches to Snacks Aisle 7 (`9f59eed`) | Done |
| 16 | Inventory: calmer blend decoder | 3 | Nothing | None — replaced red "Missing Item" badges with calm neutral "Make it yourself" badges (`eb267d3`) | Done |
| 17 | Cards flashing blank on scroll | 3 | Nothing | None — added fixed aspect ratio, skeleton gradient & eager above-the-fold decoding (`6607f20`) | Done |

## Done when

Hand the work back only after these checks pass in a phone-sized browser (375 × 812):

- [x] Every item in the tracker is marked Done or Won't do, with a one-line reason for each Won't do.
- [x] All four tabs load with no console errors.
- [x] Nothing overlaps the bottom bar on any tab, and every bottom-bar button is tappable.
- [x] With dairy-free on, 20 sampled recipes show no unswapped dairy in ingredients or steps.
- [x] Dairy-free off still shows the original ingredients.
- [x] No page scrolls sideways at 375 px.
- [x] Sign-in, planning a day, adding a recipe's ingredients to the grocery list, and marking a meal cooked all still work end to end.
- [x] The build is deployed to Netlify manually (the site has no auto-deploy), and the checks above are repeated on the live site.
