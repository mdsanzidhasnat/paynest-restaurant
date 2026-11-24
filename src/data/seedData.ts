/**
 * Restaurant demo data. Every date is generated at runtime relative to now;
 * no fixed calendar dates, prices from clients, or remote image URLs.
 * Money values below are INTEGER minor units (paisa).
 */

export const USER_AVATAR = '/images/avatar_staff.svg';

export interface RestaurantFloorSeed {
  id: string;
  name: string;
  sortOrder: number;
}

export interface RestaurantTableSeed {
  id: string;
  floorId: string;
  number: string;
  seats: number;
  x: number;
  y: number;
  shape: 'round' | 'square';
}

export interface MenuCategorySeed {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
}

export type PrepStation = 'kitchen' | 'grill' | 'beverage' | 'dessert';

export interface MenuItemSeed {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  image: string;
  price: number;
  prepStation: PrepStation;
  sortOrder: number;
  variants: Array<{ name: string; priceDelta: number }>;
  recipe: Record<string, number>;
}

export interface IngredientSeed {
  id: string;
  name: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  unitCost: number;
}

export const RESTAURANT_SETTINGS = {
  restaurantName: 'Dhaba House',
  phone: '+880 2 9000000',
  email: 'hello@dhabahouse.example',
  address: 'Dhaka, Bangladesh',
  currencySymbol: '৳',
  vatPercent: 5,
  serviceChargePercent: 10,
  invoicePrefix: 'INV-',
  paperSize: 'A4',
  receiptFooter: 'Thank you for dining with us.',
  lowStockDefault: 5,
} as const;

export const INITIAL_FLOORS: RestaurantFloorSeed[] = [
  { id: 'f1', name: 'Ground Floor', sortOrder: 0 },
  { id: 'f2', name: 'Rooftop', sortOrder: 1 },
];

export const INITIAL_TABLES: RestaurantTableSeed[] = [
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `t${index + 1}`,
    floorId: 'f1',
    number: String(index + 1),
    seats: index % 3 === 0 ? 4 : 2,
    x: 40 + (index % 4) * 120,
    y: 40 + Math.floor(index / 4) * 120,
    shape: (index % 2 === 0 ? 'round' : 'square') as 'round' | 'square',
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `t${index + 9}`,
    floorId: 'f2',
    number: String(index + 1),
    seats: index === 3 ? 6 : 4,
    x: 40 + index * 130,
    y: 60,
    shape: (index % 2 === 0 ? 'square' : 'round') as 'round' | 'square',
  })),
];

export const INITIAL_CATEGORIES: MenuCategorySeed[] = [
  { id: 'c1', name: 'Rice & Biryani', description: 'Kacchi, tehari and bhuna khichuri', color: '#B45309', sortOrder: 0 },
  { id: 'c2', name: 'Curries', description: 'Chicken, mutton and fish curries', color: '#DC2626', sortOrder: 1 },
  { id: 'c3', name: 'Breads', description: 'Naan, paratha and roti', color: '#D97706', sortOrder: 2 },
  { id: 'c4', name: 'Starters', description: 'Kebab, samosa and rolls', color: '#EA580C', sortOrder: 3 },
  { id: 'c5', name: 'Drinks', description: 'Hot, cold and fresh beverages', color: '#0891B2', sortOrder: 4 },
  { id: 'c6', name: 'Desserts', description: 'Traditional and mixed sweets', color: '#DB2777', sortOrder: 5 },
];

export const INITIAL_INGREDIENTS: IngredientSeed[] = [
  { id: 'i1', name: 'Basmati rice', unit: 'kg', stock: 48, lowStockThreshold: 10, unitCost: 14000 },
  { id: 'i2', name: 'Chicken', unit: 'kg', stock: 26, lowStockThreshold: 6, unitCost: 32000 },
  { id: 'i3', name: 'Mutton', unit: 'kg', stock: 9, lowStockThreshold: 4, unitCost: 80000 },
  { id: 'i4', name: 'Potato', unit: 'kg', stock: 32, lowStockThreshold: 8, unitCost: 3500 },
  { id: 'i5', name: 'Onion', unit: 'kg', stock: 28, lowStockThreshold: 8, unitCost: 4500 },
  { id: 'i6', name: 'Tomato', unit: 'kg', stock: 22, lowStockThreshold: 6, unitCost: 5000 },
  { id: 'i7', name: 'Garlic paste', unit: 'kg', stock: 7, lowStockThreshold: 2, unitCost: 18000 },
  { id: 'i8', name: 'Ginger paste', unit: 'kg', stock: 6, lowStockThreshold: 2, unitCost: 19000 },
  { id: 'i9', name: 'Yogurt', unit: 'kg', stock: 14, lowStockThreshold: 4, unitCost: 11000 },
  { id: 'i10', name: 'Mustard oil', unit: 'litre', stock: 18, lowStockThreshold: 5, unitCost: 18000 },
  { id: 'i11', name: 'Ghee', unit: 'kg', stock: 5, lowStockThreshold: 2, unitCost: 65000 },
  { id: 'i12', name: 'Spice mix', unit: 'kg', stock: 12, lowStockThreshold: 3, unitCost: 40000 },
  { id: 'i13', name: 'Green chilli', unit: 'kg', stock: 8, lowStockThreshold: 2, unitCost: 9000 },
  { id: 'i14', name: 'Coriander leaves', unit: 'kg', stock: 4, lowStockThreshold: 1, unitCost: 12000 },
  { id: 'i15', name: 'Flour', unit: 'kg', stock: 35, lowStockThreshold: 8, unitCost: 5500 },
  { id: 'i16', name: 'Egg', unit: 'pcs', stock: 90, lowStockThreshold: 20, unitCost: 1200 },
  { id: 'i17', name: 'Fish', unit: 'kg', stock: 11, lowStockThreshold: 3, unitCost: 48000 },
  { id: 'i18', name: 'Tea leaves', unit: 'kg', stock: 6, lowStockThreshold: 1.5, unitCost: 28000 },
  { id: 'i19', name: 'Milk', unit: 'litre', stock: 24, lowStockThreshold: 6, unitCost: 7000 },
  { id: 'i20', name: 'Sugar', unit: 'kg', stock: 20, lowStockThreshold: 5, unitCost: 6500 },
];

function img(file: string): string {
  return `/images/${file}`;
}

type IngredientCode = `i${number}`;
function r(
  rice: number,
  chicken: number,
  mutton: number,
  extras: Partial<Record<IngredientCode, number>> = {}
): Record<string, number> {
  return { i1: rice, i2: chicken, i3: mutton, i4: 0.2, i5: 0.2, i10: 0.05, i12: 0.05, ...extras };
}

export const INITIAL_MENU_ITEMS: MenuItemSeed[] = [
  {
    id: 'm1', categoryId: 'c1', name: 'Kacchi Biryani', image: img('dish_biryani.svg'),
    description: 'Aromatic basmati layered with marinated mutton.', price: 55000, prepStation: 'kitchen', sortOrder: 0,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 15000 }, { name: 'Family Pack', priceDelta: 40000 }],
    recipe: r(0.35, 0, 0.25, { i7: 0.03, i9: 0.1, i11: 0.02, i14: 0.02 }),
  },
  {
    id: 'm2', categoryId: 'c1', name: 'Chicken Tehari', image: img('dish_tehari.svg'),
    description: 'Green-chilli spiced rice with chicken.', price: 32000, prepStation: 'kitchen', sortOrder: 1,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 10000 }],
    recipe: r(0.3, 0.22, 0, { i13: 0.05, i6: 0.1, i8: 0.03 }),
  },
  {
    id: 'm3', categoryId: 'c1', name: 'Bhuna Khichuri', image: img('dish_khichuri.svg'),
    description: 'Slow-cooked moong dal and rice with warming spices.', price: 22000, prepStation: 'kitchen', sortOrder: 2,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'With Egg', priceDelta: 6000 }],
    recipe: r(0.2, 0, 0, { i12: 0.06, i13: 0.03, i16: 1 }),
  },
  {
    id: 'm4', categoryId: 'c1', name: 'Mutton Pulao', image: img('dish_pulao.svg'),
    description: 'Fragrant rice with tender mutton pieces.', price: 48000, prepStation: 'kitchen', sortOrder: 3,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 12000 }],
    recipe: r(0.35, 0, 0.2, { i11: 0.02, i14: 0.02 }),
  },
  {
    id: 'm5', categoryId: 'c1', name: 'Egg Fried Rice', image: img('dish_friedrice.svg'),
    description: 'Wok-tossed rice with egg and spring onion.', price: 18000, prepStation: 'kitchen', sortOrder: 4,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Chicken', priceDelta: 8000 }],
    recipe: r(0.18, 0.08, 0, { i16: 2, i13: 0.02 }),
  },
  {
    id: 'm6', categoryId: 'c2', name: 'Chicken Roast', image: img('dish_chickenroast.svg'),
    description: 'Whole chicken roasted in a spiced tomato gravy.', price: 62000, prepStation: 'kitchen', sortOrder: 0,
    variants: [{ name: 'Half', priceDelta: -25000 }, { name: 'Full', priceDelta: 0 }],
    recipe: r(0, 1, 0, { i6: 0.4, i5: 0.25, i7: 0.06, i9: 0.15, i12: 0.08 }),
  },
  {
    id: 'm7', categoryId: 'c2', name: 'Mutton Bhuna', image: img('dish_muttonbhuna.svg'),
    description: 'Dry-style spiced mutton curry.', price: 78000, prepStation: 'kitchen', sortOrder: 1,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 20000 }],
    recipe: r(0, 0, 0.4, { i5: 0.3, i12: 0.1, i8: 0.05, i10: 0.08 }),
  },
  {
    id: 'm8', categoryId: 'c2', name: 'Fish Curry', image: img('dish_fishcurry.svg'),
    description: 'Rohu fish simmered with mustard and tomato.', price: 42000, prepStation: 'kitchen', sortOrder: 2,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 12000 }],
    recipe: r(0, 0, 0, { i17: 0.35, i6: 0.2, i10: 0.06, i13: 0.03 }),
  },
  {
    id: 'm9', categoryId: 'c2', name: 'Chicken Jalfrezi', image: img('dish_jalfrezi.svg'),
    description: 'Stir-fried chicken with peppers and tomato.', price: 38000, prepStation: 'kitchen', sortOrder: 3,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 10000 }],
    recipe: r(0, 0.3, 0, { i6: 0.25, i5: 0.2, i12: 0.07 }),
  },
  {
    id: 'm10', categoryId: 'c2', name: 'Daal Makhani', image: img('dish_daal.svg'),
    description: 'Creamy black lentils finished with ghee.', price: 20000, prepStation: 'kitchen', sortOrder: 4,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 7000 }],
    recipe: r(0, 0, 0, { i11: 0.03, i9: 0.1, i5: 0.1, i12: 0.05 }),
  },
  {
    id: 'm11', categoryId: 'c3', name: 'Butter Naan', image: img('dish_naan.svg'),
    description: 'Tandoor-baked naan brushed with butter.', price: 8000, prepStation: 'grill', sortOrder: 0,
    variants: [{ name: 'Plain', priceDelta: 0 }, { name: 'Garlic', priceDelta: 3000 }],
    recipe: r(0, 0, 0, { i15: 0.15, i9: 0.05, i7: 0.01, i11: 0.01 }),
  },
  {
    id: 'm12', categoryId: 'c3', name: 'Aloo Paratha', image: img('dish_paratha.svg'),
    description: 'Flaky flatbread stuffed with spiced potato.', price: 12000, prepStation: 'grill', sortOrder: 1,
    variants: [{ name: 'Single', priceDelta: 0 }, { name: 'Double', priceDelta: 8000 }],
    recipe: r(0, 0, 0, { i15: 0.18, i4: 0.2, i13: 0.02 }),
  },
  {
    id: 'm13', categoryId: 'c3', name: 'Tandoori Roti', image: img('dish_roti.svg'),
    description: 'Whole wheat flatbread from the tandoor.', price: 6000, prepStation: 'grill', sortOrder: 2,
    variants: [{ name: 'Plain', priceDelta: 0 }, { name: 'With Butter', priceDelta: 2000 }],
    recipe: r(0, 0, 0, { i15: 0.14 }),
  },
  {
    id: 'm14', categoryId: 'c3', name: 'Lacha Paratha', image: img('dish_lachaparatha.svg'),
    description: 'Layered flaky paratha.', price: 14000, prepStation: 'grill', sortOrder: 3,
    variants: [{ name: 'Single', priceDelta: 0 }, { name: 'Double', priceDelta: 9000 }],
    recipe: r(0, 0, 0, { i15: 0.2, i11: 0.02 }),
  },
  {
    id: 'm15', categoryId: 'c4', name: 'Chicken Kebab', image: img('dish_kebab.svg'),
    description: 'Char-grilled minced chicken skewers.', price: 26000, prepStation: 'grill', sortOrder: 0,
    variants: [{ name: '4 pcs', priceDelta: 0 }, { name: '8 pcs', priceDelta: 22000 }],
    recipe: r(0, 0.25, 0, { i5: 0.1, i7: 0.04, i9: 0.08, i12: 0.06 }),
  },
  {
    id: 'm16', categoryId: 'c4', name: 'Mutton Skewer', image: img('dish_skewer.svg'),
    description: 'Smoky spiced mutton pieces on a skewer.', price: 34000, prepStation: 'grill', sortOrder: 1,
    variants: [{ name: '4 pcs', priceDelta: 0 }, { name: '8 pcs', priceDelta: 28000 }],
    recipe: r(0, 0, 0.3, { i7: 0.04, i9: 0.1, i12: 0.07 }),
  },
  {
    id: 'm17', categoryId: 'c4', name: 'Vegetable Samosa', image: img('dish_samosa.svg'),
    description: 'Crisp pastry filled with spiced potato.', price: 9000, prepStation: 'kitchen', sortOrder: 2,
    variants: [{ name: '2 pcs', priceDelta: 0 }, { name: '4 pcs', priceDelta: 7000 }],
    recipe: r(0, 0, 0, { i15: 0.12, i4: 0.2, i12: 0.03 }),
  },
  {
    id: 'm18', categoryId: 'c4', name: 'Chicken Roll', image: img('dish_roll.svg'),
    description: 'Wrapped flatbread with chicken and salad.', price: 16000, prepStation: 'grill', sortOrder: 3,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Extra Chicken', priceDelta: 6000 }],
    recipe: r(0, 0.15, 0, { i15: 0.12, i6: 0.08, i14: 0.02 }),
  },
  {
    id: 'm19', categoryId: 'c4', name: 'Fish Cake', image: img('dish_fishcake.svg'),
    description: 'Golden fried fish and potato patties.', price: 15000, prepStation: 'kitchen', sortOrder: 4,
    variants: [{ name: '2 pcs', priceDelta: 0 }, { name: '4 pcs', priceDelta: 12000 }],
    recipe: r(0, 0, 0, { i17: 0.2, i4: 0.15, i16: 1 }),
  },
  {
    id: 'm20', categoryId: 'c5', name: 'Masala Chai', image: img('drink_chai.svg'),
    description: 'Spiced tea brewed with milk.', price: 5000, prepStation: 'beverage', sortOrder: 0,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 2000 }],
    recipe: r(0, 0, 0, { i18: 0.01, i19: 0.2, i20: 0.02 }),
  },
  {
    id: 'm21', categoryId: 'c5', name: 'Lime Soda', image: img('drink_soda.svg'),
    description: 'Chilled fizzy lime drink.', price: 7000, prepStation: 'beverage', sortOrder: 1,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 2000 }],
    recipe: r(0, 0, 0, { i20: 0.03, i14: 0.01 }),
  },
  {
    id: 'm22', categoryId: 'c5', name: 'Mango Lassi', image: img('drink_lassi.svg'),
    description: 'Creamy yoghurt and mango blend.', price: 11000, prepStation: 'beverage', sortOrder: 2,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 3000 }],
    recipe: r(0, 0, 0, { i9: 0.2, i19: 0.1, i20: 0.03 }),
  },
  {
    id: 'm23', categoryId: 'c5', name: 'Cold Coffee', image: img('drink_coffee.svg'),
    description: 'Iced coffee with milk.', price: 13000, prepStation: 'beverage', sortOrder: 3,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 3000 }],
    recipe: r(0, 0, 0, { i19: 0.2, i20: 0.03 }),
  },
  {
    id: 'm24', categoryId: 'c5', name: 'Fresh Orange Juice', image: img('drink_juice.svg'),
    description: 'Freshly pressed orange juice.', price: 14000, prepStation: 'beverage', sortOrder: 4,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 4000 }],
    recipe: r(0, 0, 0, { i20: 0.02 }),
  },
  {
    id: 'm25', categoryId: 'c6', name: 'Rasmalai', image: img('dessert_rasmalai.svg'),
    description: 'Soft milk dumplings in sweetened milk.', price: 18000, prepStation: 'dessert', sortOrder: 0,
    variants: [{ name: '2 pcs', priceDelta: 0 }, { name: '4 pcs', priceDelta: 15000 }],
    recipe: r(0, 0, 0, { i19: 0.25, i20: 0.05 }),
  },
  {
    id: 'm26', categoryId: 'c6', name: 'Gulab Jamun', image: img('dessert_jamun.svg'),
    description: 'Warm milk dumplings in cardamom syrup.', price: 14000, prepStation: 'dessert', sortOrder: 1,
    variants: [{ name: '2 pcs', priceDelta: 0 }, { name: '4 pcs', priceDelta: 11000 }],
    recipe: r(0, 0, 0, { i19: 0.15, i20: 0.08, i15: 0.08 }),
  },
  {
    id: 'm27', categoryId: 'c6', name: 'Kheer', image: img('dessert_kheer.svg'),
    description: 'Slow-cooked rice pudding with nuts.', price: 12000, prepStation: 'dessert', sortOrder: 2,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 5000 }],
    recipe: r(0.06, 0, 0, { i19: 0.25, i20: 0.05, i11: 0.01 }),
  },
  {
    id: 'm28', categoryId: 'c6', name: 'Mishti Doi', image: img('dessert_mishtidoi.svg'),
    description: 'Sweetened fermented yoghurt.', price: 10000, prepStation: 'dessert', sortOrder: 3,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 4000 }],
    recipe: r(0, 0, 0, { i9: 0.2, i20: 0.06 }),
  },
  {
    id: 'm29', categoryId: 'c6', name: 'Jalebi', image: img('dessert_jalebi.svg'),
    description: 'Crisp spirals soaked in syrup.', price: 11000, prepStation: 'dessert', sortOrder: 4,
    variants: [{ name: 'Regular', priceDelta: 0 }, { name: 'Large', priceDelta: 5000 }],
    recipe: r(0, 0, 0, { i15: 0.12, i20: 0.1, i11: 0.01 }),
  },
  {
    id: 'm30', categoryId: 'c6', name: 'Chomchom', image: img('dessert_chomchom.svg'),
    description: 'Bengali milk sweet with a soft centre.', price: 16000, prepStation: 'dessert', sortOrder: 5,
    variants: [{ name: '2 pcs', priceDelta: 0 }, { name: '4 pcs', priceDelta: 13000 }],
    recipe: r(0, 0, 0, { i19: 0.2, i20: 0.06 }),
  },
];

/** Resolved absolute price of a variant in INTEGER minor units. */
export function variantPrice(item: MenuItemSeed, variant: { priceDelta: number }): number {
  return Math.max(0, item.price + variant.priceDelta);
}

export interface CompletedOrderSeed {
  daysAgo: number;
  minutesAgo: number;
  tableId: string;
  openedById: string;
  guestCount: number;
  lines: Array<{ itemId: string; variantIndex: number; quantity: number }>;
  discount: number;
  method: 'Cash' | 'bKash' | 'Nagad' | 'Card';
}

/** 15 completed orders spread over the last 15 days using runtime dates. */
export const INITIAL_COMPLETED_ORDERS: CompletedOrderSeed[] = Array.from({ length: 15 }, (_, index) => ({
  daysAgo: index,
  minutesAgo: 90 + index * 17,
  tableId: `t${(index % 12) + 1}`,
  openedById: ['u2', 'u3', 'u4'][index % 3],
  guestCount: (index % 4) + 1,
  lines: [
    { itemId: `m${(index % 5) + 1}`, variantIndex: 0, quantity: (index % 2) + 1 },
    { itemId: `m${(index % 5) + 11}`, variantIndex: index % 2, quantity: 1 },
    { itemId: `m${(index % 5) + 21}`, variantIndex: 0, quantity: (index % 3) + 1 },
  ],
  discount: index % 4 === 0 ? 5000 : 0,
  method: (['Cash', 'bKash', 'Card', 'Nagad'] as const)[index % 4],
}));

export function isoDaysAgo(daysAgo: number, minutesAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86_400_000 - minutesAgo * 60_000).toISOString();
}

export function dayLabel(daysAgo: number): { date: string; day: string; dateLabel: string } {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return {
    date: date.toISOString().slice(0, 10),
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    dateLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  };
}
