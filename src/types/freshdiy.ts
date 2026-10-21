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

export interface CabinetItem {
  id: string;
  user_id?: string | null;
  item_name: string;
  category: 'Spices' | 'Broth Concentrates' | 'Sauces' | 'Oils & Vinegars' | 'Pantry';
  status: StockStatus;
  usage_count: number;
  updated_at?: string;
}

export interface WeeklyPlanItem {
  id: string;
  user_id?: string | null;
  week_start_date: string;
  recipe_id: string;
  day_of_week: DayOfWeek;
  servings: ServingsSize;
  status: PlanStatus;
  completed_at?: string | null;
}

export interface GroceryExtra {
  id: string;
  week_start_date: string;
  item_name: string;
  aisle: string;
  checked: boolean;
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
