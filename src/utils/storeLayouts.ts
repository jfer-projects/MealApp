/**
 * Store Layout & Aisle Directory Engine for FreshDIY
 * Provides store-specific aisle numbering, department sequencing, and optimized walking routes.
 */

export interface StoreDepartment {
  id: string;
  name: string;
  locationLabel: string; // e.g. "Front Entrance", "Aisle 1", "Back Wall"
  aisleNumber?: string;
  sortOrder: number; // 1-based progressive walking path through the store
  description?: string;
  keywords: string[];
}

export interface StoreLayout {
  id: string;
  name: string;
  address: string;
  shortName: string;
  notes?: string;
  departments: StoreDepartment[];
}

export interface ItemStoreLocation {
  storeId: string;
  storeName: string;
  departmentId: string;
  departmentName: string;
  locationLabel: string;
  aisleNumber?: string;
  sortOrder: number;
}

/**
 * Stop & Shop — 950 American Legion Hwy, Roslindale, MA 02131
 * Compact ~40,000 sq ft neighborhood store layout.
 * Walking route enters at Produce, moves down left perimeter (Bakery/Deli),
 * navigates center dry grocery aisles, hits back-wall Meat & Seafood,
 * passes Frozen, and finishes at the right-wall Dairy coolers before registers.
 */
export const STOP_AND_SHOP_AMERICAN_LEGION: StoreLayout = {
  id: 'stop_shop_american_legion',
  name: 'Stop & Shop (American Legion Hwy)',
  shortName: 'Stop & Shop (Roslindale)',
  address: '950 American Legion Hwy, Roslindale, MA 02131',
  notes: 'Optimal route: Produce ➔ Bakery/Deli ➔ Center Aisles ➔ Back Meat Wall ➔ Frozen ➔ Dairy (kept cold last before checkout)',
  departments: [
    {
      id: 'produce',
      name: 'Produce & Fresh Herbs',
      locationLabel: 'Front Entrance (Produce)',
      sortOrder: 1,
      keywords: [
        'apple', 'banana', 'berry', 'berries', 'strawberry', 'strawberries', 'blueberry', 'blueberries',
        'raspberry', 'blackberry', 'grape', 'orange', 'lemon', 'lime', 'avocado', 'tomato', 'tomatoes',
        'potato', 'potatoes', 'onion', 'onions', 'scallion', 'scallions', 'shallot', 'garlic', 'ginger',
        'carrot', 'carrots', 'broccoli', 'spinach', 'lettuce', 'kale', 'salad', 'greens', 'cucumber',
        'zucchini', 'squash', 'pepper', 'peppers', 'bell pepper', 'jalapeno', 'poblano', 'cilantro',
        'parsley', 'basil', 'mint', 'dill', 'rosemary', 'thyme', 'celery', 'mushroom', 'mushrooms',
        'corn', 'cabbage', 'asparagus', 'green bean', 'green beans', 'peas', 'cauliflower', 'peach',
        'pear', 'melon', 'watermelon', 'mango', 'pineapple', 'fruit', 'vegetable', 'spring mix', 'arugula',
        'chives', 'radish', 'sweet potato', 'russet', 'yukon', 'grape tomatoes', 'roma tomatoes'
      ],
    },
    {
      id: 'bakery_deli',
      name: 'Bakery & Fresh Bread',
      locationLabel: 'Left Wall (Bakery)',
      sortOrder: 2,
      keywords: [
        'bread', 'sourdough', 'bagel', 'bagels', 'buns', 'bun', 'potato buns', 'burger buns',
        'rolls', 'dinner rolls', 'tortilla', 'tortillas', 'wrap', 'wraps', 'pita', 'flatbread',
        'flatbreads', 'naan', 'croissant', 'croissants', 'muffin', 'muffins', 'crust', 'pizza crust',
        'baguette', 'ciabatta', 'brioche'
      ],
    },
    {
      id: 'aisle_1_natural',
      name: 'Natural, Organic & Plant-Based',
      locationLabel: 'Aisle 1',
      aisleNumber: '1',
      sortOrder: 3,
      description: 'Dairy-free milks, plant-based butter, gluten-free, organic specialty',
      keywords: [
        'oat milk', 'almond milk', 'soy milk', 'coconut milk', 'plant butter', 'vegan butter',
        'dairy-free butter', 'plant-based', 'vegan', 'dairy-free', 'dairy free', 'nutritional yeast',
        'oatly', 'silk', 'chobani oat', 'miyoko', 'violife', 'kite hill', 'daiya', 'gluten-free',
        'almond flour', 'coconut flour', 'organic oat', 'df sour cream', 'dairy-free sour cream',
        'dairy-free shredded cheese', 'dairy-free cream cheese'
      ],
    },
    {
      id: 'aisle_2_rice_international',
      name: 'Rice, Grains & International',
      locationLabel: 'Aisle 2',
      aisleNumber: '2',
      sortOrder: 4,
      keywords: [
        'rice', 'jasmine rice', 'basmati rice', 'brown rice', 'white rice', 'quinoa', 'couscous',
        'goya', 'hispanic', 'asian', 'soy sauce', 'tamari', 'teriyaki', 'sweet soy', 'hoisin',
        'rice vinegar', 'rice wine vinegar', 'sesame oil', 'toasted sesame oil', 'sriracha',
        'chili sauce', 'curry paste', 'taco shells', 'enchilada sauce', 'salsa'
      ],
    },
    {
      id: 'aisle_3_pasta_canned',
      name: 'Pasta, Sauces & Canned Goods',
      locationLabel: 'Aisle 3',
      aisleNumber: '3',
      sortOrder: 5,
      keywords: [
        'pasta', 'spaghetti', 'penne', 'macaroni', 'rotini', 'fettuccine', 'linguine', 'orzo',
        'noodles', 'ramen', 'marinara', 'pasta sauce', 'tomato sauce', 'canned tomato', 'crushed tomatoes',
        'diced tomatoes', 'tomato paste', 'canned beans', 'black beans', 'chickpeas', 'garbanzo',
        'kidney beans', 'canto beans', 'broth', 'chicken broth', 'beef broth', 'vegetable broth',
        'stock', 'chicken stock', 'beef stock', 'vegetable stock', 'bouillon', 'broth concentrate',
        'canned tuna', 'canned salmon', 'soup', 'canned soup'
      ],
    },
    {
      id: 'aisle_4_oils_condiments',
      name: 'Cooking Oils, Vinegars & Condiments',
      locationLabel: 'Aisle 4',
      aisleNumber: '4',
      sortOrder: 6,
      keywords: [
        'oil', 'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil', 'avocado oil',
        'vinegar', 'red wine vinegar', 'white wine vinegar', 'balsamic vinegar', 'apple cider vinegar',
        'distilled vinegar', 'mayo', 'mayonnaise', 'mustard', 'dijon mustard', 'yellow mustard',
        'ketchup', 'bbq sauce', 'barbecue sauce', 'salad dressing', 'ranch', 'italian dressing',
        'hot sauce', 'worcestershire', 'marinade', 'relish', 'pickles'
      ],
    },
    {
      id: 'aisle_5_spices_baking',
      name: 'Spices, Seasonings & Baking',
      locationLabel: 'Aisle 5',
      aisleNumber: '5',
      sortOrder: 7,
      keywords: [
        'spice', 'spices', 'seasoning', 'paprika', 'smoked paprika', 'cumin', 'oregano', 'garlic powder',
        'onion powder', 'chili powder', 'black pepper', 'kosher salt', 'sea salt', 'cinnamon', 'cayenne',
        'nutmeg', 'coriander', 'curry powder', 'turmeric', 'thyme dried', 'rosemary dried', 'bay leaves',
        'italian seasoning', 'taco seasoning', 'flour', 'all-purpose flour', 'sugar', 'brown sugar',
        'powdered sugar', 'baking powder', 'baking soda', 'yeast', 'cornstarch', 'vanilla', 'vanilla extract',
        'cocoa powder', 'chocolate chips', 'honey', 'maple syrup'
      ],
    },
    {
      id: 'aisle_6_breakfast_coffee',
      name: 'Coffee, Tea & Breakfast',
      locationLabel: 'Aisle 6',
      aisleNumber: '6',
      sortOrder: 8,
      keywords: [
        'coffee', 'coffee beans', 'ground coffee', 'cold brew', 'k-cups', 'tea', 'tea bags',
        'cereal', 'oats', 'oatmeal', 'rolled oats', 'granola', 'pancake mix', 'waffle mix',
        'peanut butter', 'almond butter', 'jam', 'jelly', 'preserves'
      ],
    },
    {
      id: 'aisle_7_snacks_beverages',
      name: 'Snacks, Crackers & Drinks',
      locationLabel: 'Aisle 7',
      aisleNumber: '7',
      sortOrder: 9,
      keywords: [
        'chips', 'potato chips', 'tortilla chips', 'pretzels', 'popcorn', 'crackers', 'graham crackers',
        'cookies', 'kids snacks', 'apple sauce', 'applesauce pouches', 'fruit snacks', 'bars', 'granola bars',
        'seltzer', 'polar seltzer', 'sparkling water', 'soda', 'coke', 'juice', 'apple juice', 'lemonade',
        'nuts', 'almonds', 'peanuts', 'cashews', 'trail mix'
      ],
    },
    {
      id: 'aisle_8_household_paper',
      name: 'Household, Paper & Cleaning',
      locationLabel: 'Aisle 8',
      aisleNumber: '8',
      sortOrder: 10,
      keywords: [
        'paper towels', 'toilet paper', 'napkins', 'facial tissue', 'kleenex', 'trash bags',
        'foil', 'aluminum foil', 'parchment paper', 'plastic wrap', 'ziploc', 'storage bags',
        'dish soap', 'dishwasher pods', 'sponge', 'sponges', 'cleaning spray', 'wipes',
        'laundry detergent', 'hand soap'
      ],
    },
    {
      id: 'meat_seafood',
      name: 'Fresh Meat & Seafood',
      locationLabel: 'Back Wall (Meat & Seafood Counter)',
      sortOrder: 11,
      description: 'Grabbed near end of trip to keep cold',
      keywords: [
        'chicken', 'chicken breasts', 'chicken breast', 'chicken thighs', 'ground turkey', 'turkey',
        'ground beef', 'beef', 'steak', 'sirloin', 'ribeye', 'flank steak', 'pork', 'pork chops',
        'pork tenderloin', 'ground pork', 'bacon', 'sausage', 'italian sausage', 'breakfast sausage',
        'salmon', 'salmon fillets', 'shrimp', 'fish', 'tilapia', 'cod', 'scallops', 'meatballs'
      ],
    },
    {
      id: 'frozen',
      name: 'Frozen Foods',
      locationLabel: 'Aisles 9 & 10 (Frozen)',
      aisleNumber: '9-10',
      sortOrder: 12,
      keywords: [
        'frozen', 'frozen vegetables', 'frozen broccoli', 'frozen peas', 'frozen corn', 'frozen berries',
        'frozen fruit', 'ice cream', 'frozen pizza', 'frozen waffles', 'frozen fries', 'tater tots'
      ],
    },
    {
      id: 'dairy_eggs',
      name: 'Dairy & Eggs',
      locationLabel: 'Right Wall (Dairy Wall - Grab Cold Items Last)',
      sortOrder: 13,
      description: 'Final department before checkouts to keep cold chain intact',
      keywords: [
        'eggs', 'egg', 'dozen eggs', 'pasture-raised eggs', 'milk', 'whole milk', '2% milk',
        'heavy cream', 'half and half', 'butter', 'salted butter', 'unsalted butter',
        'cheese', 'cheddar', 'shredded cheese', 'mozzarella', 'parmesan', 'feta',
        'cream cheese', 'sour cream', 'yogurt', 'greek yogurt', 'cottage cheese',
        'ricotta', 'queso'
      ],
    },
  ],
};

export const SUPPORTED_STORES: StoreLayout[] = [
  STOP_AND_SHOP_AMERICAN_LEGION,
];

/**
 * Matches an item name to its exact department, aisle, and walking sequence
 * for the specified store layout.
 */
export function getItemStoreLocation(
  rawItemName: string,
  storeLayout: StoreLayout = STOP_AND_SHOP_AMERICAN_LEGION,
  fallbackAisleCategory?: string
): ItemStoreLocation {
  const cleanName = rawItemName.toLowerCase().trim();

  // 1. Try keyword matching on store departments
  for (const dept of storeLayout.departments) {
    for (const kw of dept.keywords) {
      if (cleanName.includes(kw) || kw.includes(cleanName)) {
        return {
          storeId: storeLayout.id,
          storeName: storeLayout.name,
          departmentId: dept.id,
          departmentName: dept.name,
          locationLabel: dept.locationLabel,
          aisleNumber: dept.aisleNumber,
          sortOrder: dept.sortOrder,
        };
      }
    }
  }

  // 2. Fallback based on general grocery category if supplied
  if (fallbackAisleCategory) {
    const catLower = fallbackAisleCategory.toLowerCase();
    if (catLower.includes('produce')) {
      const d = storeLayout.departments.find((dep) => dep.id === 'produce')!;
      return {
        storeId: storeLayout.id,
        storeName: storeLayout.name,
        departmentId: d.id,
        departmentName: d.name,
        locationLabel: d.locationLabel,
        sortOrder: d.sortOrder,
      };
    }
    if (catLower.includes('meat') || catLower.includes('seafood')) {
      const d = storeLayout.departments.find((dep) => dep.id === 'meat_seafood')!;
      return {
        storeId: storeLayout.id,
        storeName: storeLayout.name,
        departmentId: d.id,
        departmentName: d.name,
        locationLabel: d.locationLabel,
        sortOrder: d.sortOrder,
      };
    }
    if (catLower.includes('dairy alt')) {
      const d = storeLayout.departments.find((dep) => dep.id === 'aisle_1_natural')!;
      return {
        storeId: storeLayout.id,
        storeName: storeLayout.name,
        departmentId: d.id,
        departmentName: d.name,
        locationLabel: d.locationLabel,
        aisleNumber: d.aisleNumber,
        sortOrder: d.sortOrder,
      };
    }
    if (catLower.includes('dairy') || catLower.includes('egg')) {
      const d = storeLayout.departments.find((dep) => dep.id === 'dairy_eggs')!;
      return {
        storeId: storeLayout.id,
        storeName: storeLayout.name,
        departmentId: d.id,
        departmentName: d.name,
        locationLabel: d.locationLabel,
        sortOrder: d.sortOrder,
      };
    }
    if (catLower.includes('grain') || catLower.includes('bakery')) {
      const d = storeLayout.departments.find((dep) => dep.id === 'bakery_deli')!;
      return {
        storeId: storeLayout.id,
        storeName: storeLayout.name,
        departmentId: d.id,
        departmentName: d.name,
        locationLabel: d.locationLabel,
        sortOrder: d.sortOrder,
      };
    }
    if (catLower.includes('spice') || catLower.includes('pantry')) {
      const d = storeLayout.departments.find((dep) => dep.id === 'aisle_5_spices_baking')!;
      return {
        storeId: storeLayout.id,
        storeName: storeLayout.name,
        departmentId: d.id,
        departmentName: d.name,
        locationLabel: d.locationLabel,
        aisleNumber: d.aisleNumber,
        sortOrder: d.sortOrder,
      };
    }
  }

  // Default to Household & Extras (Aisle 8)
  const defaultDept = storeLayout.departments.find((dep) => dep.id === 'aisle_8_household_paper')!;
  return {
    storeId: storeLayout.id,
    storeName: storeLayout.name,
    departmentId: defaultDept.id,
    departmentName: defaultDept.name,
    locationLabel: defaultDept.locationLabel,
    aisleNumber: defaultDept.aisleNumber,
    sortOrder: defaultDept.sortOrder,
  };
}
