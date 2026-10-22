import { CabinetItem, StockStatus } from '../types/freshdiy';

export interface BlendComponent {
  spiceName: string;
  ratio: string;
}

export interface ProprietaryBlendDefinition {
  name: string;
  aliases?: string[];
  description: string;
  yieldNote: string;
  mixingSteps: string;
  components: BlendComponent[];
}

/**
 * Comprehensive HelloFresh Proprietary Blend, Glaze, Paste & Concentrate Decoder
 * Allows clicking any signature HelloFresh packet/sauce in a recipe to see exactly how to make it at home.
 */
export const HELLOFRESH_PROPRIETARY_BLENDS: ProprietaryBlendDefinition[] = [
  {
    name: 'Sweet Soy Glaze',
    aliases: ['sweet soy glaze', 'sweet soy sauce'],
    description: 'Rich umami-sweet glaze used in Firecracker Meatballs, Pork Tacos & Salmon bowls.',
    yieldNote: 'Makes 4 tbsp: 2 tbsp Soy Sauce + 1.5 tbsp Honey + 1 tsp Rice Wine Vinegar + ½ tsp Cornstarch',
    mixingSteps:
      'Whisk Soy Sauce, Honey, Rice Wine Vinegar, and Cornstarch in a small bowl. Simmer in the pan for 1–2 minutes until glossy and slightly thickened.',
    components: [
      { spiceName: 'Soy Sauce', ratio: '2 tbsp (2 parts)' },
      { spiceName: 'Honey', ratio: '1.5 tbsp (1.5 parts)' },
      { spiceName: 'Rice Wine Vinegar', ratio: '1 tsp (0.5 part)' },
      { spiceName: 'Cornstarch', ratio: '½ tsp (thickener)' },
    ],
  },
  {
    name: 'Fry Seasoning',
    aliases: ['fry seasoning'],
    description: 'HelloFresh signature savory potato wedge, burger & crispy chicken coating blend.',
    yieldNote: 'Makes 1 tbsp: 1 tsp Garlic Powder + 1 tsp Onion Powder + 1 tsp Paprika',
    mixingSteps:
      'Combine equal parts Garlic Powder, Onion Powder, and Paprika in a small bowl. Toss with oiled potato wedges or breading.',
    components: [
      { spiceName: 'Garlic Powder', ratio: '1 tsp (1 part)' },
      { spiceName: 'Onion Powder', ratio: '1 tsp (1 part)' },
      { spiceName: 'Paprika', ratio: '1 tsp (1 part)' },
    ],
  },
  {
    name: 'Southwest Spice Blend',
    aliases: ['southwest spice', 'southwest spice blend'],
    description: 'Earthy, kid-friendly taco, enchilada & skillet seasoning without excessive heat.',
    yieldNote: 'Makes 2 tbsp: 1 tbsp Chili Powder + 1.5 tsp Ground Cumin + 1.5 tsp Garlic Powder',
    mixingSteps:
      'Mix 2 parts Chili Powder with 1 part Ground Cumin and 1 part Garlic Powder.',
    components: [
      { spiceName: 'Chili Powder', ratio: '1 tbsp (2 parts)' },
      { spiceName: 'Ground Cumin', ratio: '1.5 tsp (1 part)' },
      { spiceName: 'Garlic Powder', ratio: '1.5 tsp (1 part)' },
    ],
  },
  {
    name: 'Tuscan Heat Spice',
    aliases: ['tuscan heat spice'],
    description: 'Warm Italian herb & gentle paprika-garlic blend for pastas, sausage, and chicken.',
    yieldNote: 'Makes 2 tbsp: 2 tsp Dried Basil + 2 tsp Dried Oregano + 1 tsp Garlic Powder + 1 tsp Paprika',
    mixingSteps:
      'Combine Dried Basil, Dried Oregano, Garlic Powder, and Paprika. Add a tiny pinch of chili flakes only if desired.',
    components: [
      { spiceName: 'Dried Basil', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Dried Oregano', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Garlic Powder', ratio: '1 tsp (1 part)' },
      { spiceName: 'Paprika', ratio: '1 tsp (1 part)' },
    ],
  },
  {
    name: 'Fajita Spice Blend',
    aliases: ['fajita spice', 'fajita spice blend'],
    description: 'Smoky citrus-cumin blend for sizzling sheet pan fajitas and burritos.',
    yieldNote: 'Makes 2 tbsp: 2 tsp Ground Cumin + 2 tsp Paprika + 1 tsp Garlic Powder + 1 tsp Dried Oregano',
    mixingSteps:
      'Stir together Ground Cumin, Paprika, Garlic Powder, and Dried Oregano.',
    components: [
      { spiceName: 'Ground Cumin', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Paprika', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Garlic Powder', ratio: '1 tsp (1 part)' },
      { spiceName: 'Dried Oregano', ratio: '1 tsp (1 part)' },
    ],
  },
  {
    name: 'Blackening Spice',
    aliases: ['blackening spice'],
    description: 'Bold smoky-savory rub for Alfredo chicken, fish, and roasted veggies.',
    yieldNote: 'Makes 1.5 tbsp: 2 tsp Smoked Paprika + 1 tsp Garlic Powder + 1 tsp Onion Powder + ½ tsp Dried Thyme',
    mixingSteps:
      'Mix Smoked Paprika, Garlic Powder, Onion Powder, and Dried Thyme. Pat protein dry before pressing spice rub onto surface.',
    components: [
      { spiceName: 'Smoked Paprika', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Garlic Powder', ratio: '1 tsp (1 part)' },
      { spiceName: 'Onion Powder', ratio: '1 tsp (1 part)' },
      { spiceName: 'Dried Thyme', ratio: '½ tsp (0.5 part)' },
    ],
  },
  {
    name: 'Cream Sauce Spice Blend',
    aliases: ['cream sauce spice', 'cream sauce spice blend'],
    description: 'Herbed roux & béchamel seasoning base for creamy skillets and orzo.',
    yieldNote: 'Makes 2 tbsp: 1 tbsp All-Purpose Flour + 1.5 tsp Garlic Powder + 1.5 tsp Onion Powder + 1 tsp Dried Parsley',
    mixingSteps:
      'Whisk All-Purpose Flour with Garlic Powder, Onion Powder, and Dried Parsley before adding liquid so it thickens smoothly.',
    components: [
      { spiceName: 'All-Purpose Flour', ratio: '1 tbsp (2 parts)' },
      { spiceName: 'Garlic Powder', ratio: '1.5 tsp (1 part)' },
      { spiceName: 'Onion Powder', ratio: '1.5 tsp (1 part)' },
      { spiceName: 'Dried Parsley', ratio: '1 tsp (1 part)' },
    ],
  },
  {
    name: 'Shawarma Spice Blend',
    aliases: ['shawarma spice', 'shawarma spice blend'],
    description: 'Warm Middle Eastern aromatic blend for flatbreads, gyro bowls, and roasted chicken.',
    yieldNote: 'Makes 2 tbsp: 2 tsp Ground Cumin + 2 tsp Ground Coriander + 1 tsp Paprika + ½ tsp Ground Turmeric + ½ tsp Ground Cinnamon',
    mixingSteps:
      'Combine Cumin, Coriander, Paprika, Turmeric, and Cinnamon in a small bowl.',
    components: [
      { spiceName: 'Ground Cumin', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Ground Coriander', ratio: '2 tsp (2 parts)' },
      { spiceName: 'Paprika', ratio: '1 tsp (1 part)' },
      { spiceName: 'Ground Turmeric', ratio: '½ tsp (0.5 part)' },
      { spiceName: 'Ground Cinnamon', ratio: '½ tsp (0.5 part)' },
    ],
  },
  {
    name: 'Moo Shu Spice Blend',
    aliases: ['moo shu spice', 'moo shu spice blend'],
    description: 'Aromatic ginger-five-spice blend for street tacos and pork stir-fries.',
    yieldNote: 'Makes 2 tbsp: 1 tbsp Ground Ginger + 1.5 tsp Garlic Powder + 1.5 tsp Chinese Five Spice',
    mixingSteps:
      'Mix Ground Ginger, Garlic Powder, and Chinese Five Spice together.',
    components: [
      { spiceName: 'Ground Ginger', ratio: '1 tbsp (2 parts)' },
      { spiceName: 'Garlic Powder', ratio: '1.5 tsp (1 part)' },
      { spiceName: 'Chinese Five Spice', ratio: '1.5 tsp (1 part)' },
    ],
  },
  {
    name: 'Tex-Mex Paste',
    aliases: ['tex-mex paste', 'tex mex paste'],
    description: 'Savory-sweet smoky tomato-chili paste for enchiladas, soups, and tortilla melts.',
    yieldNote: 'Makes 2 tbsp: 1 tbsp Tomato Paste + 1.5 tsp Chili Powder + 1 tsp Ground Cumin + 1 tsp Honey',
    mixingSteps:
      'Stir Tomato Paste, Chili Powder, Ground Cumin, Honey, and 1 tsp warm water until smooth.',
    components: [
      { spiceName: 'Tomato Paste', ratio: '1 tbsp (2 parts)' },
      { spiceName: 'Chili Powder', ratio: '1.5 tsp (1 part)' },
      { spiceName: 'Ground Cumin', ratio: '1 tsp (0.5 part)' },
      { spiceName: 'Honey', ratio: '1 tsp (0.5 part)' },
    ],
  },
  {
    name: 'Bulgogi Sauce',
    aliases: ['bulgogi sauce', 'Korean bulgogi sauce'],
    description: 'Savory-sweet Korean soy, ginger, garlic & sesame glaze for meatballs and beef bowls.',
    yieldNote: 'Makes 4 tbsp: 2 tbsp Soy Sauce + 1.5 tbsp Honey + 1 tsp Ground Ginger + 1 tsp Garlic Powder',
    mixingSteps:
      'Whisk Soy Sauce, Honey, Ginger, and Garlic Powder with 1 tbsp water and ½ tsp Cornstarch.',
    components: [
      { spiceName: 'Soy Sauce', ratio: '2 tbsp' },
      { spiceName: 'Honey', ratio: '1.5 tbsp' },
      { spiceName: 'Ground Ginger', ratio: '1 tsp' },
      { spiceName: 'Garlic Powder', ratio: '1 tsp' },
    ],
  },
  {
    name: 'Sweet Thai Chili Sauce',
    aliases: ['sweet thai chili sauce', 'thai chili sauce'],
    description: 'Tangy, lightly sweet glaze for crispy chicken, tacos, and roasted veggies.',
    yieldNote: 'Makes 4 tbsp: 2 tbsp Honey + 1.5 tbsp Rice Wine Vinegar + ½ tsp Garlic Powder + ½ tsp Korean Chili Flakes',
    mixingSteps:
      'Warm Honey, Rice Wine Vinegar, Garlic Powder, and a pinch of Chili Flakes for 60 seconds until syrupy.',
    components: [
      { spiceName: 'Honey', ratio: '2 tbsp' },
      { spiceName: 'Rice Wine Vinegar', ratio: '1.5 tbsp' },
      { spiceName: 'Garlic Powder', ratio: '½ tsp' },
      { spiceName: 'Korean Chili Flakes', ratio: '½ tsp' },
    ],
  },
  {
    name: 'Italian Seasoning',
    aliases: ['italian seasoning'],
    description: 'Classic Mediterranean herb blend for marinara, flatbreads, and roasted vegetables.',
    yieldNote: 'Makes 1 tbsp: 1 tsp Dried Basil + 1 tsp Dried Oregano + 1 tsp Dried Thyme',
    mixingSteps:
      'Combine equal parts Dried Basil, Dried Oregano, and Dried Thyme.',
    components: [
      { spiceName: 'Dried Basil', ratio: '1 tsp (1 part)' },
      { spiceName: 'Dried Oregano', ratio: '1 tsp (1 part)' },
      { spiceName: 'Dried Thyme', ratio: '1 tsp (1 part)' },
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

export function findBlendDefinition(
  ingredientOrBlendName: string
): ProprietaryBlendDefinition | null {
  if (!ingredientOrBlendName) return null;
  const lower = ingredientOrBlendName.toLowerCase().trim();
  for (const def of HELLOFRESH_PROPRIETARY_BLENDS) {
    if (def.name.toLowerCase() === lower || lower.includes(def.name.toLowerCase())) {
      return def;
    }
    if (def.aliases?.some((al) => lower.includes(al.toLowerCase()))) {
      return def;
    }
  }
  return null;
}

function normalizeSpiceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(?:ground|dried|all-purpose|white|black|smoked|korean)\s+/g, '')
    .replace(/\s+/g, ' ');
}

function findCabinetSpiceMatch(
  spiceName: string,
  cabinet: CabinetItem[]
): CabinetItem | undefined {
  const exactLower = spiceName.toLowerCase().trim();
  const exact = cabinet.find((c) => c.item_name.toLowerCase().trim() === exactLower);
  if (exact) return exact;

  const normTarget = normalizeSpiceName(spiceName);
  return cabinet.find((c) => {
    const normCab = normalizeSpiceName(c.item_name);
    return normCab === normTarget || normCab.includes(normTarget) || normTarget.includes(normCab);
  });
}

export function evaluateBlendStock(
  blendName: string,
  cabinet: CabinetItem[]
): BlendEvaluation | null {
  const def = findBlendDefinition(blendName);
  if (!def) return null;

  // Single unified rule: a blend counts as available if the user holds the blend itself
  // in their cabinet OR holds every base spice required to mix it.
  const directBlendItem = cabinet.find(
    (c) =>
      c.status !== 'out_of_stock' &&
      (c.item_name.toLowerCase().trim() === def.name.toLowerCase().trim() ||
        def.aliases?.some((al) => c.item_name.toLowerCase().trim() === al.toLowerCase().trim()))
  );

  const missingSpices: string[] = [];
  const lowSpices: string[] = [];

  const componentStatuses = def.components.map((comp) => {
    const found = findCabinetSpiceMatch(comp.spiceName, cabinet);
    const status: StockStatus = directBlendItem
      ? directBlendItem.status
      : found
      ? found.status
      : 'out_of_stock';
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
  if (directBlendItem) {
    overallStatus = directBlendItem.status === 'low' ? 'low_stock' : 'ready';
  } else if (missingSpices.length > 0) {
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
