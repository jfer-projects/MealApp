#!/usr/bin/env python3
"""
FreshDIY - Phase 2: Authentic HelloFresh Library Scraper & Supabase Ingestor
Connects to HelloFresh's SSR __NEXT_DATA__ and Gateway API (/gw/recipes/recipes),
fetches 120+ 100% unique, authentic HelloFresh recipes across all major family collections,
normalizes all ingredient yields to 4 servings, maps grocery aisles & proprietary blends,
adds Air Fryer & Rice Cooker step-level appliance adaptations,
and syncs the clean, deduplicated catalog to public/data/hellofresh_recipes.json and Supabase.
"""

import concurrent.futures
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from bs4 import BeautifulSoup

try:
    from supabase import Client, create_client
except ImportError:
    create_client = None

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xamzenezncjsmmvkafxq.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY", "sb_publishable_ouCtW1z5jcvxE1PaDbT1eQ_Xlu5CbNy"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

COLLECTION_URLS = [
    "https://www.hellofresh.com/recipes/kid-friendly-recipes",
    "https://www.hellofresh.com/recipes/most-popular-recipes",
    "https://www.hellofresh.com/recipes/quick-meals",
    "https://www.hellofresh.com/recipes/one-pot-meals",
    "https://www.hellofresh.com/recipes/chicken-recipes",
    "https://www.hellofresh.com/recipes/beef-recipes",
    "https://www.hellofresh.com/recipes/pork-recipes",
    "https://www.hellofresh.com/recipes/taco-recipes",
    "https://www.hellofresh.com/recipes/pasta-recipes",
    "https://www.hellofresh.com/recipes/mexican-recipes",
    "https://www.hellofresh.com/recipes/asian-recipes",
    "https://www.hellofresh.com/recipes/mediterranean-recipes",
    "https://www.hellofresh.com/recipes/fish-recipes",
    "https://www.hellofresh.com/recipes/burger-recipes",
    "https://www.hellofresh.com/recipes/italian-recipes",
    "https://www.hellofresh.com/recipes/american-recipes",
]

SEARCH_QUERIES = [
    "chicken",
    "beef",
    "pork",
    "salmon",
    "shrimp",
    "steak",
    "turkey",
    "sausage",
    "tacos",
    "pasta",
    "spaghetti",
    "penne",
    "orzo",
    "gnocchi",
    "ravioli",
    "tortellini",
    "burger",
    "meatballs",
    "fajitas",
    "enchiladas",
    "quesadillas",
    "burrito",
    "bowl",
    "rice",
    "noodle",
    "ramen",
    "udon",
    "stir-fry",
    "teriyaki",
    "sweet soy",
    "firecracker",
    "bulgogi",
    "bibimbap",
    "curry",
    "coconut",
    "thai",
    "shawarma",
    "gyro",
    "mediterranean",
    "tuscan",
    "parmesan",
    "lemon",
    "garlic",
    "honey",
    "mustard",
    "bbq",
    "chipotle",
    "poblano",
    "southwest",
    "tex-mex",
    "blackened",
    "cajun",
    "sheet pan",
    "flatbread",
    "pita",
    "sliders",
    "tenders",
    "cutlets",
    "chops",
    "loin",
    "flank",
    "sirloin",
    "barramundi",
    "tilapia",
    "trout",
    "cod",
    "risotto",
    "couscous",
    "quinoa",
    "farro",
    "ciabatta",
    "baguette",
    "brioche",
    "potato",
    "sweet potato",
    "broccoli",
    "zucchini",
    "green beans",
    "carrots",
    "asparagus",
    "brussels sprouts",
    "mushroom",
    "spinach",
    "kale",
    "corn",
    "black beans",
    "chickpeas",
    "tofu",
    "halloumi",
    "feta",
    "mozzarella",
    "cheddar",
    "monterey jack",
    "gouda",
    "cream cheese",
    "sour cream",
    "pesto",
    "marinara",
    "alfredo",
    "bolognese",
    "marsala",
    "piccata",
    "apricot",
    "fig",
    "balsamic",
    "cherry",
    "peach",
    "mango",
    "pineapple",
    "ponzu",
    "hoisin",
    "moo shu",
    "sesame",
    "ginger",
    "sriracha",
    "buffalo",
    "ranch",
    "dill",
    "rosemary",
    "thyme",
    "cilantro",
    "lime",
    "enchilada",
    "flautas",
    "taquitos",
    "tostadas",
    "casserole",
    "skillet",
    "bake",
    "roast",
    "grilled",
    "crispy",
    "creamy",
    "cheesy",
    "zesty",
    "smoky",
    "savory",
]

PROPRIETARY_BLENDS = [
    "Fry Seasoning",
    "Sweet Soy Glaze",
    "Southwest Spice Blend",
    "Tuscan Heat Spice",
    "Fajita Spice Blend",
    "Blackening Spice",
    "Cream Sauce Spice Blend",
    "Shawarma Spice Blend",
    "Moo Shu Spice Blend",
    "Tex-Mex Paste",
]


def infer_aisle(item_name: str) -> str:
    lower = item_name.lower()
    if any(
        k in lower
        for k in [
            "sour cream",
            "cream cheese",
            "butter",
            "milk",
            "parmesan",
            "monterey jack",
            "mexican cheese",
            "cheddar",
            "mozzarella",
            "yogurt",
            "gouda",
            "feta",
            "ricotta",
            "pepper jack",
            "swiss cheese",
        ]
    ):
        return "Dairy & Eggs"
    if any(
        k in lower
        for k in [
            "chicken",
            "beef",
            "pork",
            "sausage",
            "turkey",
            "steak",
            "bacon",
            "salmon",
            "shrimp",
            "tilapia",
            "barramundi",
            "trout",
            "prosciutto",
        ]
    ):
        return "Meat & Seafood"
    if any(
        k in lower
        for k in [
            "potato",
            "onion",
            "garlic",
            "lemon",
            "lime",
            "carrot",
            "broccoli",
            "zucchini",
            "bell pepper",
            "tomato",
            "scallion",
            "cilantro",
            "parsley",
            "apple",
            "green bean",
            "romaine",
            "poblano",
            "cucumber",
            "ginger",
            "avocado",
            "corn",
            "spinach",
            "cabbage",
            "mushroom",
            "jalape",
            "shallot",
            "bok choy",
            "asparagus",
            "kale",
            "radish",
            "dill",
            "thyme",
            "rosemary",
            "basil",
            "chives",
            "celery",
            "squash",
            "sweet potato",
            "cauliflower",
            "pea",
        ]
    ):
        return "Produce"
    if any(
        k in lower
        for k in [
            "seasoning",
            "spice",
            "glaze",
            "concentrate",
            "stock",
            "soy sauce",
            "honey",
            "ketchup",
            "mayo",
            "mustard",
            "vinegar",
            "oil",
            "chili",
            "paprika",
            "cumin",
            "oregano",
            "garlic powder",
            "onion powder",
            "cinnamon",
            "salsa",
            "tex-mex",
            "jam",
            "panko",
            "flour",
            "sugar",
            "salt",
            "pepper",
            "sriracha",
            "hoisin",
            "ponzu",
            "teriyaki",
            "curry",
            "paste",
            "cornstarch",
            "hot sauce",
            "bbq",
            "dressing",
            "marinara",
            "pesto",
            "tahini",
            "hummus",
        ]
    ):
        return "Spices & Pantry"
    if any(
        k in lower
        for k in [
            "rice",
            "pasta",
            "spaghetti",
            "penne",
            "couscous",
            "tortilla",
            "bun",
            "bread",
            "flatbread",
            "noodle",
            "quinoa",
            "orzo",
            "gnocchi",
            "ravioli",
            "tortellini",
            "ciabatta",
            "baguette",
            "pita",
            "ramen",
            "udon",
            "farro",
            "bulgur",
        ]
    ):
        return "Grains & Bakery"
    return "Pantry & Canned"


def detect_blend(item_name: str) -> Optional[str]:
    lower = item_name.lower()
    for blend in PROPRIETARY_BLENDS:
        if blend.lower() in lower:
            return blend
    if "southwest spice" in lower:
        return "Southwest Spice Blend"
    if "fajita spice" in lower:
        return "Fajita Spice Blend"
    if "tuscan heat" in lower:
        return "Tuscan Heat Spice"
    if "shawarma spice" in lower:
        return "Shawarma Spice Blend"
    if "moo shu spice" in lower:
        return "Moo Shu Spice Blend"
    if "cream sauce spice" in lower:
        return "Cream Sauce Spice Blend"
    return None


def parse_iso_minutes(iso_str: Optional[str], default: int = 30) -> int:
    if not iso_str:
        return default
    hours = 0
    mins = 0
    h_match = re.search(r"(\d+)H", str(iso_str))
    m_match = re.search(r"(\d+)M", str(iso_str))
    if h_match:
        hours = int(h_match.group(1))
    if m_match:
        mins = int(m_match.group(1))
    total = hours * 60 + mins
    return total if 5 <= total <= 120 else default


def clean_step_text(raw: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", raw or "")
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def generate_appliance_adaptations(step_text: str) -> Tuple[Optional[str], Optional[str]]:
    lower = step_text.lower()
    air_fryer = None
    rice_cooker = None

    if any(k in lower for k in ["roast", "bake", "baking sheet", "sheet pan", "wedges", "425", "450"]):
        if "potato" in lower or "wedge" in lower or "carrot" in lower or "broccoli" in lower or "green bean" in lower or "veggie" in lower:
            air_fryer = "Air Fryer Adaptation: Toss coated veggies/potatoes in the Air Fryer basket at 400°F for 12-15 minutes, shaking halfway through until golden and crisp."
        elif "chicken" in lower or "meatball" in lower or "pork" in lower or "salmon" in lower:
            air_fryer = "Air Fryer Adaptation: Cook protein in the Air Fryer at 390°F for 9-12 minutes until cooked through and caramelized."

    if ("rice" in lower or "quinoa" in lower or "couscous" in lower) and any(
        k in lower for k in ["small pot", "medium pot", "boil", "simmer", "cover", "fluff"]
    ):
        rice_cooker = "Rice Cooker Adaptation: Combine rinsed grains, water, and a pinch of salt in the Rice Cooker. Run the standard cycle, then fluff and fold in butter/seasonings before serving."

    return air_fryer, rice_cooker


def normalize_title(title: str) -> str:
    clean = re.sub(r"\b(low-lift|2x|prepped|quick-prep|easy cleanup)\b", "", title, flags=re.I)
    clean = re.sub(r"[^a-z0-9]+", " ", clean.lower()).strip()
    return clean


def normalize_ingredient_measurement(amount: float, raw_unit: str, name: str) -> tuple[float, str, str]:
    clean_name = (name or "").strip()
    u = (raw_unit or "").strip().lower()
    amt = amount

    # Salt & Pepper
    if re.search(r"^(?:kosher\s+|sea\s+|flaky\s+)?salt$|^(?:black\s+|white\s+)?pepper$|^salt\s*(?:&|and)\s*pepper$", clean_name, re.I):
        return 0.0, "to taste", clean_name

    # Cooking Oil
    if (u in ["unit", "item", ""]) and re.search(r"\b(?:cooking|olive|vegetable|canola|sesame|avocado|peanut)\s+oil\b|^oil$", clean_name, re.I):
        return 0.0, "as needed", clean_name

    # Ginger 'thumb' -> tablespoon / tsp
    if u == "thumb" or (re.search(r"\bginger\b", clean_name, re.I) and u in ["unit", ""]):
        if amt <= 0.5:
            return 1.5, "tsp minced", clean_name
        if amt <= 1:
            return 1.0, 'tbsp minced (1" piece)', clean_name
        return round(amt), f'tbsp minced ({round(amt)}" piece)', clean_name

    # Milliliters
    if u in ["milliliters", "ml"]:
        if amt <= 6: return 1.0, "tsp", clean_name
        if amt <= 11: return 2.0, "tsp", clean_name
        if amt <= 13: return 2.5, "tsp (approx. ½ tbsp)", clean_name
        if amt <= 16: return 1.0, "tbsp", clean_name
        if amt <= 25: return 1.5, "tbsp", clean_name
        if amt <= 32: return 2.0, "tbsp", clean_name
        if amt <= 65: return 0.25, "cup", clean_name
        if amt <= 130: return 0.5, "cup", clean_name
        return round((amt / 240.0) * 4) / 4.0, "cup", clean_name

    # Grams
    if u in ["g", "grams"]:
        if re.search(r"tempura|batter|flour|panko|mix", clean_name, re.I):
            if 140 <= amt <= 180: return 1.25, "cup", clean_name
            return round((amt / 125.0) * 4) / 4.0, "cup", clean_name
        if amt <= 5: return 1.0, "tsp", clean_name
        if amt <= 8: return 1.5, "tsp", clean_name
        if amt <= 16: return 1.0, "tbsp", clean_name
        if amt <= 23: return 1.5, "tbsp", clean_name
        return round((amt / 14.4) * 2) / 2.0, "tbsp", clean_name

    # Tomato Paste
    if re.search(r"tomato paste", clean_name, re.I):
        if u in ["ounce", "oz"]:
            return amt * 2.0, "tbsp", clean_name
        if u in ["unit", ""]:
            return amt, ("pouch (2 tbsp)" if amt == 1 else "pouches (2 tbsp each)"), clean_name

    # Fresh herbs in ounces
    if u in ["ounce", "oz"] and re.search(r"\b(?:rosemary|thyme|sage|oregano)\b", clean_name, re.I):
        if amt <= 0.25: return 1.0, "tbsp chopped (2–3 sprigs)", clean_name
        return round(amt * 4), "tbsp chopped", clean_name
    if u in ["ounce", "oz"] and re.search(r"\b(?:cilantro|parsley|dill|chives|basil|mint)\b", clean_name, re.I):
        if amt <= 0.25: return 2.0, "tbsp chopped", clean_name
        if amt <= 0.5: return 0.25, "cup chopped", clean_name
        return 0.5, "cup chopped", clean_name

    # Butter in ounces
    if u in ["ounce", "oz"] and re.search(r"\bbutter\b", clean_name, re.I) and not re.search(r"peanut|almond|cashew", clean_name, re.I):
        tbsp = amt * 2.0
        if tbsp >= 4 and tbsp % 4 == 0:
            return tbsp / 16.0, "cup", clean_name
        return tbsp, "tbsp", clean_name

    # Dairy & sauces in ounces
    if u in ["ounce", "oz"]:
        if re.search(r"milk|cream sauce|creamy", clean_name, re.I):
            if abs(amt - 6.75) < 0.5: return 0.75, "cup", clean_name
            if amt >= 2: return round((amt / 8.0) * 4) / 4.0, "cup", clean_name
            return amt * 2.0, "tbsp", clean_name
        if re.search(r"sour cream|greek yogurt|mayo|mayonnaise|cream cheese", clean_name, re.I):
            if amt >= 4: return round((amt / 8.0) * 4) / 4.0, "cup", clean_name
            if amt == 2: return 0.25, "cup (4 tbsp)", clean_name
            return amt * 2.0, "tbsp", clean_name
        if re.search(r"sweet thai chili|marinara|soy glaze|bbq|sauce|dressing|honey|syrup|vinegar|ketchup|mustard|paste", clean_name, re.I):
            if amt == 5: return 0.66, "cup", clean_name
            if amt >= 4: return round((amt / 8.0) * 4) / 4.0, "cup", clean_name
            if amt == 2: return 0.25, "cup (4 tbsp)", clean_name
            return amt * 2.0, "tbsp", clean_name
        if re.search(r"cheese|parmesan|cheddar|mozzarella", clean_name, re.I):
            return round((amt / 4.0) * 4) / 4.0, "cup shredded", clean_name

    # Stock concentrates
    if re.search(r"stock concentrate|broth concentrate", clean_name, re.I) and u in ["unit", ""]:
        return amt, ("packet" if amt == 1 else "packets"), clean_name

    u = re.sub(r"\s*\(tsp\)", "", u, flags=re.I)
    u = re.sub(r"\s*\(tbsp\)", "", u, flags=re.I).strip()
    if u == "teaspoon": u = "tsp"
    if u == "tablespoon": u = "tbsp"

    if u == "tsp":
        if amt >= 3 and amt % 3 == 0:
            amt = amt / 3.0
            u = "tbsp"
        elif amt == 4.5:
            amt = 1.5
            u = "tbsp"

    if u == "tbsp":
        if amt == 4: amt, u = 0.25, "cup"
        elif amt == 8: amt, u = 0.5, "cup"
        elif amt == 12: amt, u = 0.75, "cup"
        elif amt == 16: amt, u = 1.0, "cup"

    if u in ["unit", "units", "item", "items", ""]:
        if re.search(r"scallions?|green onions?", clean_name, re.I):
            return amt, ("bunch" if amt == 1 else "bunches"), clean_name
        if re.search(r"black beans|chickpeas|crushed tomatoes|diced tomatoes|coconut milk", clean_name, re.I):
            return amt, ("can" if amt == 1 else "cans"), clean_name
        return amt, "", clean_name

    return amt, u, clean_name


def convert_hf_item_to_freshdiy(item: Dict[str, Any], collection_tag: Optional[str] = None) -> Optional[Dict[str, Any]]:
    steps = item.get("steps") or []
    ingredients_meta = item.get("ingredients") or []
    yields_list = item.get("yields") or []

    if len(steps) < 3 or len(ingredients_meta) < 4:
        return None

    # Find 4-serving yield (or 2-serving yield multiplied by 2)
    yield_4 = next((y for y in yields_list if y.get("yields") == 4), None)
    yield_2 = next((y for y in yields_list if y.get("yields") == 2), None)
    target_yield = yield_4 or yield_2
    if not target_yield:
        return None

    scale_mult = 1.0 if yield_4 else 2.0
    yield_map: Dict[str, Dict[str, Any]] = {}
    for y_ing in target_yield.get("ingredients") or []:
        if y_ing.get("id"):
            yield_map[y_ing["id"]] = y_ing

    ing_list: List[Dict[str, Any]] = []
    for meta in ingredients_meta:
        ing_id = meta.get("id")
        name = (meta.get("name") or "").strip()
        if not name:
            continue
        y_info = yield_map.get(ing_id, {})
        raw_amount = y_info.get("amount")
        raw_unit = y_info.get("unit") or "unit"
        if raw_amount is None:
            raw_amount = 1.0
        scaled_amount = round(float(raw_amount) * scale_mult, 2)
        norm_amt, norm_unit, norm_name = normalize_ingredient_measurement(scaled_amount, raw_unit, name)
        blend = detect_blend(norm_name)
        aisle = infer_aisle(norm_name)
        ing_list.append({
            "name": norm_name,
            "amount": norm_amt,
            "unit": norm_unit,
            "aisle": aisle,
            "is_pantry_staple": blend is not None or aisle == "Spices & Pantry",
            "blend_name": blend,
        })

    if len(ing_list) < 4:
        return None

    inst_list: List[Dict[str, Any]] = []
    has_air_fryer = False
    has_rice_cooker = False

    for idx, st in enumerate(steps, start=1):
        body = clean_step_text(st.get("instructions") or st.get("instructionsMarkdown") or "")
        if not body:
            continue
        af, rc = generate_appliance_adaptations(body)
        if af:
            has_air_fryer = True
        if rc:
            has_rice_cooker = True

        # Detect timer in step text
        timer_sec = None
        m_time = re.search(r"(\d+)(?:\s*-\s*(\d+))?\s*(?:min|minute)s?", body, re.I)
        if m_time:
            mins = int(m_time.group(1))
            if 1 <= mins <= 45:
                timer_sec = mins * 60

        step_title = f"Step {idx}"
        first_clause = body.split(".")[0]
        if 4 <= len(first_clause) <= 42:
            step_title = first_clause

        inst_list.append({
            "step": idx,
            "title": step_title,
            "body": body,
            "timer_seconds": timer_sec,
            "appliance_override": {
                "air_fryer": af,
                "rice_cooker": rc,
            },
        })

    if len(inst_list) < 3:
        return None

    prep_time = parse_iso_minutes(item.get("totalTime") or item.get("prepTime"), 30)

    # Build tags
    hf_tags = [t.get("name", "") for t in (item.get("tags") or []) if isinstance(t, dict)]
    tags: List[str] = []
    if collection_tag and collection_tag not in tags:
        tags.append(collection_tag)
    if any("kid" in t.lower() or "family" in t.lower() or "hall of fame" in t.lower() or "non-spicy" in t.lower() for t in hf_tags) or prep_time <= 35:
        if "Kid-Friendly" not in tags:
            tags.append("Kid-Friendly")
    if prep_time <= 30 and "Under 30 Mins" not in tags:
        tags.append("Under 30 Mins")
    if (
        any("sheet" in t.lower() or "one-pot" in t.lower() or "easy" in t.lower() for t in hf_tags)
        or "baking sheet" in json.dumps(inst_list).lower()
    ):
        if "Sheet Pan" not in tags:
            tags.append("Sheet Pan")
    if has_air_fryer and "Air Fryer" not in tags:
        tags.append("Air Fryer")
    if has_rice_cooker and "Rice Cooker" not in tags:
        tags.append("Rice Cooker")

    image_path = item.get("imagePath")
    if image_path:
        image_url = f"https://img.hellofresh.com/w_1080,q_auto,f_auto,c_limit,fl_lossy/hellofresh_s3{image_path}"
    else:
        image_url = item.get("imageLink") or "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80"

    raw_title = (item.get("name") or "HelloFresh Recipe").strip()
    clean_display_title = re.sub(r"^Low-Lift\s+", "", raw_title, flags=re.I)
    clean_display_title = re.sub(r"\b2x\s+", "", clean_display_title, flags=re.I).strip()

    slug = item.get("slug") or re.sub(r"[^a-z0-9]+", "-", clean_display_title.lower()).strip("-")
    rec_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"freshdiy-hf-{slug}"))

    return {
        "id": rec_uuid,
        "version": 1,
        "original_id": rec_uuid,
        "source_slug": slug,
        "title": clean_display_title,
        "subtitle": (item.get("headline") or "Signature HelloFresh Family Dinner").strip(),
        "prep_time": prep_time,
        "base_servings": 4,
        "tags": tags,
        "image_url": image_url,
        "ingredients_json": ing_list,
        "instructions_json": inst_list,
        "version_notes": "Official HelloFresh v1 Recipe (Normalized to 4 Servings)",
        "is_latest": True,
    }


def fetch_jwt_and_collection_ids() -> Tuple[Optional[str], List[Tuple[str, Optional[str]]]]:
    jwt: Optional[str] = None
    recipe_ids: List[Tuple[str, Optional[str]]] = []
    seen_ids: Set[str] = set()

    for url in COLLECTION_URLS:
        try:
            r = requests.get(url, headers=HEADERS, timeout=8)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            nd_script = soup.find("script", id="__NEXT_DATA__")
            if not nd_script or not nd_script.string:
                continue
            nd = json.loads(nd_script.string)
            ssr = nd.get("props", {}).get("pageProps", {}).get("ssrPayload", {})
            if not jwt:
                jwt = ssr.get("serverAuth", {}).get("access_token")
            col_recipes = ssr.get("collection", {}).get("recipes", [])
            tag_hint = "Kid-Friendly" if "kid" in url else None
            for rec in col_recipes:
                rid = rec.get("recipeId") or rec.get("id")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    recipe_ids.append((rid, tag_hint))
        except Exception as exc:
            print(f"[Scraper] Hub fetch warning ({url}): {exc}")

    return jwt, recipe_ids


def scrape_authentic_hellofresh_library() -> List[Dict[str, Any]]:
    jwt, collection_recipe_ids = fetch_jwt_and_collection_ids()
    if not jwt:
        print("[Scraper] Could not obtain HelloFresh SSR JWT.")
        return []

    print(f"[Scraper] Discovered {len(collection_recipe_ids)} candidate recipe IDs from 16 HelloFresh collections.")
    auth_headers = {**HEADERS, "Authorization": f"Bearer {jwt}"}

    unique_recipes: List[Dict[str, Any]] = []
    seen_titles: Set[str] = set()
    seen_uuids: Set[str] = set()

    def fetch_detail(pair: Tuple[str, Optional[str]]) -> Optional[Dict[str, Any]]:
        rid, tag_hint = pair
        try:
            resp = requests.get(
                f"https://www.hellofresh.com/gw/recipes/recipes/{rid}?country=US&locale=en-US",
                headers=auth_headers,
                timeout=8,
            )
            if resp.status_code == 200:
                return convert_hf_item_to_freshdiy(resp.json(), tag_hint)
        except Exception:
            pass
        return None

    # 1. Fetch details concurrently for collection recipes
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for res in pool.map(fetch_detail, collection_recipe_ids):
            if res:
                norm = normalize_title(res["title"])
                if norm and norm not in seen_titles and res["id"] not in seen_uuids:
                    seen_titles.add(norm)
                    seen_uuids.add(res["id"])
                    unique_recipes.append(res)

    print(f"[Scraper] Extracted {len(unique_recipes)} full multi-step recipes from collections. Expanding via Gateway Search...")

    # 2. Query Gateway Search across 135+ culinary categories with take=100 to get 1,500-2,500+ unique full recipes
    def search_query(q: str) -> List[Dict[str, Any]]:
        found = []
        try:
            resp = requests.get(
                "https://www.hellofresh.com/gw/recipes/recipes/search",
                params={"country": "US", "locale": "en-US", "q": q, "take": 100},
                headers=auth_headers,
                timeout=10,
            )
            if resp.status_code == 200:
                for raw_item in resp.json().get("items", []):
                    conv = convert_hf_item_to_freshdiy(raw_item)
                    if conv:
                        found.append(conv)
        except Exception:
            pass
        return found

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for batch in pool.map(search_query, SEARCH_QUERIES):
            for rec in batch:
                norm = normalize_title(rec["title"])
                if norm and norm not in seen_titles and rec["id"] not in seen_uuids:
                    seen_titles.add(norm)
                    seen_uuids.add(rec["id"])
                    unique_recipes.append(rec)

    print(f"[Scraper] Total 100% unique, authentic HelloFresh recipes scraped: {len(unique_recipes)}")
    return unique_recipes


def sync_clean_catalog_to_supabase(recipes: List[Dict[str, Any]]) -> None:
    if not create_client:
        return
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Upsert in batches of 50
        for i in range(0, len(recipes), 50):
            batch = recipes[i : i + 50]
            supabase.table("recipes").upsert(batch, on_conflict="id").execute()
        print(f"[Supabase] Synced {len(recipes)} unique authentic HelloFresh recipes to Supabase!")
    except Exception as exc:
        print(f"[Supabase] Sync error: {exc}")


def main() -> None:
    recipes = scrape_authentic_hellofresh_library()
    if not recipes:
        print("[Scraper] Warning: No recipes scraped.")
        return

    out_path = Path(__file__).resolve().parent.parent / "public" / "data" / "hellofresh_recipes.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(recipes, f, indent=2)

    print(f"[Scraper] Saved {len(recipes)} unique HelloFresh recipes to {out_path}")
    sync_clean_catalog_to_supabase(recipes)


if __name__ == "__main__":
    main()
