import {
  Food,
  FoodEntry,
  FoodUnit,
  Goals,
  Metric,
  Nutrition,
  Unit,
  nutrientKeys,
} from '../types/models';
import { s } from '../i18n/zh-CN';

export const zeroNutrition = (): Nutrition => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  saturatedFat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
});
export function positive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(s.invalidAmount);
  return value;
}
export function numeric(text: string, optional = false): number | null {
  if (!text.trim()) {
    if (optional) return null;
    throw new Error(s.invalidNumber);
  }
  if (!/^\d*\.?\d+$/.test(text.trim())) throw new Error(s.invalidNumber);
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) throw new Error(s.invalidNumber);
  return n;
}
function legacyUnit(food: Food, unit: Unit, sortOrder: number): FoodUnit {
  let baseAmount = 1;
  if (unit !== food.baseUnit) {
    const grams = unit === 'g' ? 1 : unit === 'ml' ? food.gramsPerMl : food.gramsPerUnit;
    baseAmount =
      food.baseUnit === 'g'
        ? grams
        : food.baseUnit === 'ml'
          ? grams / food.gramsPerMl
          : grams / food.gramsPerUnit;
  }
  return {
    id: `${food.id}:legacy:${unit}`,
    foodId: food.id,
    unit,
    amount: 1,
    baseAmount,
    baseUnit: food.baseUnit,
    isDefault: unit === food.defaultUnit ? 1 : 0,
    sortOrder,
  };
}
export function normalizeFood(food: Food): Food {
  if (food.units?.length) return food;
  const names = [...new Set([food.baseUnit, food.defaultUnit])];
  return { ...food, units: names.map((unit, index) => legacyUnit(food, unit, index)) };
}
export function validateFoodUnits(food: Food): Food {
  const normalized = normalizeFood(food);
  if (!normalized.baseUnit.trim() || !normalized.defaultUnit.trim()) throw new Error(s.invalidUnit);
  const names = new Set<string>();
  for (const conversion of normalized.units) {
    if (!conversion.unit.trim() || names.has(conversion.unit)) throw new Error(s.invalidUnit);
    names.add(conversion.unit);
    positive(conversion.amount);
    positive(conversion.baseAmount);
    if (conversion.baseUnit !== normalized.baseUnit) throw new Error(s.invalidUnit);
  }
  if (!names.has(normalized.baseUnit) || !names.has(normalized.defaultUnit))
    throw new Error(s.invalidUnit);
  return normalized;
}
export function equivalentBaseAmount(food: Food, amount: number, unit: Unit): number {
  positive(amount);
  const normalized = validateFoodUnits(food);
  const conversion = normalized.units.find((candidate) => candidate.unit === unit);
  if (!conversion) throw new Error(s.unsupportedUnit);
  return (amount / conversion.amount) * conversion.baseAmount;
}
export function calculate(
  food: Food,
  amount: number,
  unit: Unit,
): Nutrition & {
  calculatedGrams: number;
  equivalentBaseAmount: number;
  equivalentBaseUnit: Unit;
  calorieSource: 'provided' | 'estimated';
} {
  const normalized = validateFoodUnits(food);
  const equivalentAmount = equivalentBaseAmount(normalized, amount, unit);
  const factor = equivalentAmount / positive(normalized.baseAmount);
  const result = zeroNutrition();
  for (const key of nutrientKeys) {
    const value =
      key === 'calories'
        ? (normalized.calories ??
          normalized.protein * 4 + normalized.carbs * 4 + normalized.fat * 9)
        : normalized[key];
    result[key] = value * factor;
    if (!Number.isFinite(result[key]) || result[key] < 0) throw new Error(s.invalidNumber);
  }
  return {
    ...result,
    calculatedGrams: normalized.baseUnit === 'g' ? equivalentAmount : 0,
    equivalentBaseAmount: equivalentAmount,
    equivalentBaseUnit: normalized.baseUnit,
    calorieSource: normalized.calories === null ? 'estimated' : 'provided',
  };
}
export function sumNutrition(rows: readonly Nutrition[]): Nutrition {
  return rows.reduce((total, row) => {
    for (const k of nutrientKeys) total[k] += row[k];
    return total;
  }, zeroNutrition());
}
export function makeSnapshot(food: Food, amount: number, unit: Unit) {
  return {
    ...calculate(food, amount, unit),
    amount,
    unit,
    foodId: food.id,
    foodName: food.name,
    foodSnapshot: JSON.stringify(normalizeFood(food)),
  };
}
export function resizeEntry(entry: FoodEntry, amount: number, unit: Unit): FoodEntry {
  return {
    ...entry,
    ...makeSnapshot(normalizeFood(JSON.parse(entry.foodSnapshot) as Food), amount, unit),
  };
}
export function progress(intake: number, target?: number): number | null {
  return target && target > 0 ? Math.max(0, Math.min(1, intake / target)) : null;
}
export function isOverLimit(actual: number, target?: number): boolean {
  return !!target && target > 0 && actual > target * 1.2;
}
export function validateGoals(goals: Goals): void {
  for (const v of Object.values(goals)) positive(v);
}
export function format(value: number, key: Metric | string = 'calories'): string {
  return value.toFixed(key === 'calories' || key === 'sodium' ? 0 : 1);
}
