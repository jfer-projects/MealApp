import { CabinetItem, StockStatus } from '../types/freshdiy';

export interface BlendComponent {
  spiceName: string;
  ratio: string;
}

export interface ProprietaryBlendDefinition {
  name: string;
  description: string;
  yieldNote: string;
  components: BlendComponent[];
}

/**
 * Official HelloFresh Proprietary Blend Decoder Reference
 * Breaks down HelloFresh signature packets into standard grocery store spices & sauces.
 */
export const HELLOFRESH_PROPRIETARY_BLENDS: ProprietaryBlendDefinition[] = [
  {
    name: 'Fry Seasoning',
    description: 'HelloFresh signature savory potato & chicken coating blend.',
    yieldNote: '1 tbsp = 1 tsp Garlic Powder + 1 tsp Onion Powder + 1 tsp Paprika',
    components: [
      { spiceName: 'Garlic Powder', ratio: '1 part (1 tsp)' },
      { spiceName: 'Onion Powder', ratio: '1 part (1 tsp)' },
      { spiceName: 'Paprika', ratio: '1 part (1 tsp)' },
    ],
  },
  {
    name: 'Sweet Soy Glaze',
    description: 'Rich umami-sweet glaze used in Firecracker Meatballs & Salmon bowls.',
    yieldNote: '4 tbsp = 2 tbsp Soy Sauce + 1.5 tbsp Honey + 1 tsp Rice Wine Vinegar + ½ tsp Cornstarch',
    components: [
      { spiceName: 'Soy Sauce', ratio: '2 parts (2 tbsp)' },
      { spiceName: 'Honey', ratio: '1.5 parts (1.5 tbsp)' },
      { spiceName: 'Rice Wine Vinegar', ratio: '0.5 part (1 tsp)' },
      { spiceName: 'Cornstarch', ratio: '½ tsp (thickener)' },
    ],
  },
  {
    name: 'Southwest Spice Blend',
    description: 'Earthy, kid-friendly taco & enchilada seasoning without excessive heat.',
    yieldNote: '2 tbsp = 1 tbsp Chili Powder + 1.5 tsp Cumin + 1.5 tsp Garlic Powder',
    components: [
      { spiceName: 'Chili Powder', ratio: '2 parts (1 tbsp)' },
      { spiceName: 'Ground Cumin', ratio: '1 part (1.5 tsp)' },
      { spiceName: 'Garlic Powder', ratio: '1 part (1.5 tsp)' },
    ],
  },
  {
    name: 'Tuscan Heat Spice',
    description: 'Warm Italian herb & gentle fennel-paprika blend for pastas and chicken.',
    yieldNote: '2 tbsp = 2 tsp Dried Basil + 2 tsp Dried Oregano + 1 tsp Garlic Powder + 1 tsp Paprika',
    components: [
      { spiceName: 'Dried Basil', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Dried Oregano', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Garlic Powder', ratio: '1 part (1 tsp)' },
      { spiceName: 'Paprika', ratio: '1 part (1 tsp)' },
    ],
  },
  {
    name: 'Fajita Spice Blend',
    description: 'Smoky citrus-cumin blend for sizzling sheet pan fajitas.',
    yieldNote: '2 tbsp = 2 tsp Ground Cumin + 2 tsp Paprika + 1 tsp Garlic Powder + 1 tsp Dried Oregano',
    components: [
      { spiceName: 'Ground Cumin', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Paprika', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Garlic Powder', ratio: '1 part (1 tsp)' },
      { spiceName: 'Dried Oregano', ratio: '1 part (1 tsp)' },
    ],
  },
  {
    name: 'Blackening Spice',
    description: 'Bold smoky-savory rub for Alfredo chicken and fish.',
    yieldNote: '1.5 tbsp = 2 tsp Smoked Paprika + 1 tsp Garlic Powder + 1 tsp Onion Powder + ½ tsp Dried Thyme',
    components: [
      { spiceName: 'Smoked Paprika', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Garlic Powder', ratio: '1 part (1 tsp)' },
      { spiceName: 'Onion Powder', ratio: '1 part (1 tsp)' },
      { spiceName: 'Dried Thyme', ratio: '0.5 part (½ tsp)' },
    ],
  },
  {
    name: 'Cream Sauce Spice Blend',
    description: 'Herbed béchamel/orzo seasoning base.',
    yieldNote: '2 tbsp = 1 tbsp All-Purpose Flour + 1.5 tsp Garlic Powder + 1.5 tsp Onion Powder + 1 tsp Dried Parsley',
    components: [
      { spiceName: 'All-Purpose Flour', ratio: '2 parts (1 tbsp)' },
      { spiceName: 'Garlic Powder', ratio: '1 part (1.5 tsp)' },
      { spiceName: 'Onion Powder', ratio: '1 part (1.5 tsp)' },
      { spiceName: 'Dried Parsley', ratio: '1 part (1 tsp)' },
    ],
  },
  {
    name: 'Shawarma Spice Blend',
    description: 'Warm Middle Eastern aromatic blend for flatbreads and roasted chicken.',
    yieldNote: '2 tbsp = 2 tsp Ground Cumin + 2 tsp Ground Coriander + 1 tsp Paprika + ½ tsp Ground Turmeric + ½ tsp Ground Cinnamon',
    components: [
      { spiceName: 'Ground Cumin', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Ground Coriander', ratio: '2 parts (2 tsp)' },
      { spiceName: 'Paprika', ratio: '1 part (1 tsp)' },
      { spiceName: 'Ground Turmeric', ratio: '0.5 part (½ tsp)' },
      { spiceName: 'Ground Cinnamon', ratio: '0.5 part (½ tsp)' },
    ],
  },
  {
    name: 'Moo Shu Spice Blend',
    description: 'Aromatic ginger-five-spice blend for street tacos and stir-fries.',
    yieldNote: '2 tbsp = 1 tbsp Ground Ginger + 1.5 tsp Garlic Powder + 1.5 tsp Chinese Five Spice',
    components: [
      { spiceName: 'Ground Ginger', ratio: '2 parts (1 tbsp)' },
      { spiceName: 'Garlic Powder', ratio: '1 part (1.5 tsp)' },
      { spiceName: 'Chinese Five Spice', ratio: '1 part (1.5 tsp)' },
    ],
  },
  {
    name: 'Tex-Mex Paste',
    description: 'Savory-sweet smoky tomato-chili paste for enchiladas and tortilla melts.',
    yieldNote: '2 tbsp = 1 tbsp Tomato Paste + 1.5 tsp Chili Powder + 1 tsp Ground Cumin + 1 tsp Honey',
    components: [
      { spiceName: 'Tomato Paste', ratio: '2 parts (1 tbsp)' },
      { spiceName: 'Chili Powder', ratio: '1 part (1.5 tsp)' },
      { spiceName: 'Ground Cumin', ratio: '0.5 part (1 tsp)' },
      { spiceName: 'Honey', ratio: '0.5 part (1 tsp)' },
    ],
  },
];

export const DEFAULT_CABINET_ITEMS: CabinetItem[] = [
  { id: 'cab-1', item_name: 'Garlic Powder', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-2', item_name: 'Onion Powder', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-3', item_name: 'Paprika', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-4', item_name: 'Smoked Paprika', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-5', item_name: 'Chili Powder', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-6', item_name: 'Ground Cumin', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-7', item_name: 'Dried Oregano', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-8', item_name: 'Dried Basil', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-9', item_name: 'Dried Thyme', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-10', item_name: 'Dried Parsley', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-11', item_name: 'Ground Coriander', category: 'Spices', status: 'low', usage_count: 2 },
  { id: 'cab-12', item_name: 'Ground Turmeric', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-13', item_name: 'Ground Cinnamon', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-14', item_name: 'Ground Ginger', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-15', item_name: 'Chinese Five Spice', category: 'Spices', status: 'out_of_stock', usage_count: 3 },
  { id: 'cab-16', item_name: 'Korean Chili Flakes', category: 'Spices', status: 'in_stock', usage_count: 0 },
  { id: 'cab-17', item_name: 'Soy Sauce', category: 'Sauces', status: 'in_stock', usage_count: 0 },
  { id: 'cab-18', item_name: 'Honey', category: 'Sauces', status: 'in_stock', usage_count: 0 },
  { id: 'cab-19', item_name: 'Dijon Mustard', category: 'Sauces', status: 'in_stock', usage_count: 0 },
  { id: 'cab-20', item_name: 'Ketchup', category: 'Sauces', status: 'in_stock', usage_count: 0 },
  { id: 'cab-21', item_name: 'Tomato Paste', category: 'Sauces', status: 'low', usage_count: 2 },
  { id: 'cab-22', item_name: 'Rice Wine Vinegar', category: 'Oils & Vinegars', status: 'in_stock', usage_count: 0 },
  { id: 'cab-23', item_name: 'Chicken Stock Concentrate', category: 'Broth Concentrates', status: 'in_stock', usage_count: 0 },
  { id: 'cab-24', item_name: 'Beef Stock Concentrate', category: 'Broth Concentrates', status: 'low', usage_count: 2 },
  { id: 'cab-25', item_name: 'Cornstarch', category: 'Pantry', status: 'in_stock', usage_count: 0 },
  { id: 'cab-26', item_name: 'All-Purpose Flour', category: 'Pantry', status: 'in_stock', usage_count: 0 },
  { id: 'cab-27', item_name: 'Panko Breadcrumbs', category: 'Pantry', status: 'in_stock', usage_count: 0 },
];

export interface BlendEvaluation {
  blend: ProprietaryBlendDefinition;
  overallStatus: 'ready' | 'low_stock' | 'missing_items';
  missingSpices: string[];
  lowSpices: string[];
  componentStatuses: {
    spiceName: string;
    ratio: string;
    status: StockStatus;
  }[];
}

export function evaluateBlendStock(
  blendName: string,
  cabinet: CabinetItem[]
): BlendEvaluation | null {
  const def = HELLOFRESH_PROPRIETARY_BLENDS.find(
    (b) => b.name.toLowerCase() === blendName.toLowerCase()
  );
  if (!def) return null;

  const missingSpices: string[] = [];
  const lowSpices: string[] = [];

  const componentStatuses = def.components.map((comp) => {
    const found = cabinet.find(
      (c) => c.item_name.toLowerCase() === comp.spiceName.toLowerCase()
    );
    const status: StockStatus = found ? found.status : 'out_of_stock';
    if (status === 'out_of_stock') {
      missingSpices.push(comp.spiceName);
    } else if (status === 'low') {
      lowSpices.push(comp.spiceName);
    }
    return {
      spiceName: comp.spiceName,
      ratio: comp.ratio,
      status,
    };
  });

  let overallStatus: 'ready' | 'low_stock' | 'missing_items' = 'ready';
  if (missingSpices.length > 0) {
    overallStatus = 'missing_items';
  } else if (lowSpices.length > 0) {
    overallStatus = 'low_stock';
  }

  return {
    blend: def,
    overallStatus,
    missingSpices,
    lowSpices,
    componentStatuses,
  };
}
