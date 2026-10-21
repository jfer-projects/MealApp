export type ServingsSize = 2 | 4 | 6;

export type StockStatus = 'in_stock' | 'low' | 'out_of_stock';

export type FeedbackStatus = 'pending' | 'processing' | 'applied' | 'dismissed';

export type PlanStatus = 'planned' | 'completed' | 'skipped';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  aisle: string;
  is_pantry_staple?: boolean;
  blend_name?: string | null;
  original_dairy_name?: string;
  substitution_note?: string;
}

export interface ApplianceOverride {
  air_fryer: string | null;
  rice_cooker: string | null;
}

export interface RecipeInstruction {
  step: number;
  title: string;
  body: string;
  timer_seconds: number | null;
  appliance_override: ApplianceOverride;
}

export interface Recipe {
  id: string;
  version: number;
  original_id: string;
  source_slug?: string;
  title: string;
  subtitle: string;
  prep_time: number;
  base_servings: ServingsSize;
  tags: string[];
  image_url: string;
  ingredients_json: RecipeIngredient[];
  instructions_json: RecipeInstruction[];
  version_notes?: string;
  is_latest: boolean;
  created_at?: string;
}

export interface RecipeFeedback {
  id: string;
  recipe_id: string;
  user_id?: string | null;
  author_name: string;
  notes: string;
  status: FeedbackStatus;
  forked_recipe_id?: string | null;
  created_at: string;
}

export type InventoryCategory =
  | 'Spices'
  | 'Broth Concentrates'
  | 'Sauces'
  | 'Oils & Vinegars'
  | 'Pantry'
  | 'Refrigerator'
  | 'Freezer & Deep Freeze';

export interface CabinetItem {
  id: string;
  user_id?: string | null;
  household_id?: string | null;
  item_name: string;
  category: InventoryCategory;
  status: StockStatus;
  usage_count: number;
  /** Number of packages/units stored in the Deep Freezer on this unified card */
  freezer_qty?: number;
  /** Number of packages/units stored in the Refrigerator (including thawed items) */
  fridge_qty?: number;
  /** Number of packages/units stored in the Pantry/Cabinet */
  pantry_qty?: number;
  /** Unit label (e.g. 'pkg', 'lb', 'bottle', 'jar', 'item') */
  unit?: string;
  updated_at?: string;
}

export interface WeeklyPlanItem {
  id: string;
  user_id?: string | null;
  household_id?: string | null;
  week_start_date: string;
  recipe_id: string;
  day_of_week: DayOfWeek;
  servings: ServingsSize;
  status: PlanStatus;
  completed_at?: string | null;
}

export interface GroceryExtra {
  id: string;
  user_id?: string | null;
  household_id?: string | null;
  week_start_date: string;
  item_name: string;
  aisle: string;
  checked: boolean;
  /** Recurring staples (milk, eggs...) automatically appear on every week's list */
  is_recurring?: boolean;
  added_by_name?: string | null;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by?: string | null;
  created_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  email?: string | null;
  role: 'owner' | 'member';
  created_at?: string;
}

export type DietaryFlag = 'nut_free' | 'vegetarian' | 'pescatarian' | 'gluten_free' | 'pork_free';

export interface MacroGoals {
  calories: number; // e.g. 650
  proteinGrams: number; // e.g. 45
  carbsGrams: number; // e.g. 50
  fatGrams: number; // e.g. 22
  dietType?: 'balanced' | 'high_protein' | 'keto_low_carb' | 'deficit_cut' | 'lean_bulk';
}

export interface MacroMealSuggestion {
  id: string;
  title: string;
  subtitle: string;
  matchedRecipeId?: string;
  prepTimeMinutes: number;
  nutrition: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
  };
  macroMatchScore: number;
  macroHighlights: string[];
  ingredientsFromHome: string[];
  ingredientsToBuy: string[];
  cookingSummary: string;
  ingredients_json?: Recipe['ingredients_json'];
  instructions_json?: Recipe['instructions_json'];
}

/** Household-wide settings shared by every member (stored in public.household_settings) */
export interface HouseholdSettings {
  household_id: string;
  /** Gemini API key — readable ONLY by members of this household (RLS) */
  gemini_api_key: string | null;
  /** User ID of the member who entered/configured this key */
  gemini_api_key_set_by?: string | null;
  is_dairy_free: boolean;
  default_servings: ServingsSize;
  dietary_flags: DietaryFlag[];
  macro_goals?: MacroGoals | null;
  /** What the household was paying HelloFresh per serving (for the savings estimate) */
  hellofresh_price_per_serving: number;
  /** Preferred grocery aisle walking order for this household's store */
  aisle_order: string[];
  onboarding_complete: boolean;
}

/** Synced check-off state for computed (recipe-derived) grocery items */
export interface GroceryCheck {
  id: string;
  household_id: string;
  week_start_date: string;
  item_key: string;
  checked: boolean;
  checked_by_name: string | null;
  updated_at?: string;
}

/** Household-level favorite / rating / cook history, keyed by recipe original_id */
export interface RecipeRating {
  id: string;
  household_id: string;
  recipe_id: string;
  rating: -1 | 0 | 1;
  is_favorite: boolean;
  times_cooked: number;
  last_cooked_at: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  household?: Household | null;
  household_member?: HouseholdMember | null;
}

export interface AggregatedGroceryItem {
  key: string;
  name: string;
  originalNames: string[];
  totalAmount: number;
  unit: string;
  aisle: string;
  isSubstitutedDairy: boolean;
  substitutionNote?: string;
  cabinetStatus: StockStatus | null;
  isStruckByCabinet: boolean;
  fromRecipes: string[];
  blendBreakdown?: {
    blendName: string;
    canMakeFromCabinet: boolean;
    missingSpices: string[];
  };
}
