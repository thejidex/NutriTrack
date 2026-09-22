export const nutrientKeys = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'saturatedFat',
  'fiber',
  'sugar',
  'sodium',
] as const;
export type NutrientKey = (typeof nutrientKeys)[number];
export type Metric = 'calories' | 'protein' | 'carbs' | 'fat';
export type Nutrition = Record<NutrientKey, number>;
/** Units are user-facing data, not a closed business-logic enum. */
export type Unit = string;
export interface FoodUnit {
  id: string;
  foodId: string;
  unit: Unit;
  /** Quantity on the user-facing side of the conversion (normally 1). */
  amount: number;
  /** Equivalent quantity in the food's nutrition base unit. */
  baseAmount: number;
  baseUnit: Unit;
  isDefault: number;
  sortOrder: number;
}
export interface Food extends Omit<Nutrition, 'calories'> {
  id: string;
  name: string;
  brand: string;
  baseAmount: number;
  baseUnit: Unit;
  calories: number | null;
  defaultUnit: Unit;
  gramsPerUnit: number;
  gramsPerMl: number;
  units: FoodUnit[];
  isCustom: number;
  isFavorite: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MealType {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: number;
  deletedAt: string | null;
  createdAt: string;
}
export interface FoodEntry extends Nutrition {
  id: string;
  foodId: string;
  mealTypeId: string;
  date: string;
  amount: number;
  unit: Unit;
  calculatedGrams: number;
  equivalentBaseAmount: number | null;
  equivalentBaseUnit: Unit | null;
  foodName: string;
  foodSnapshot: string;
  calorieSource: 'provided' | 'estimated';
  createdAt: string;
  updatedAt: string;
}
export type Goals = Partial<Record<Metric, number>>;
export interface DayTotal extends Nutrition {
  date: string;
  count: number;
}
export type FoodFilter = 'all' | 'favorites' | 'recent' | 'custom';
export interface FoodSearchResult {
  food: Food;
  usageCount: number;
  lastUsedAt: string | null;
  /** The amount/unit from the latest FoodEntry, used to speed up repeat logging. */
  lastAmount: number | null;
  lastUnit: Unit | null;
}
export type ThemeMode = 'light' | 'dark' | 'system';
