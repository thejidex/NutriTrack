import { Food, FoodUnit, Unit } from '../types/models';

type Example = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  baseUnit?: Unit;
  defaultUnit?: Unit;
  conversions?: Array<[unit: Unit, baseAmount: number]>;
};

// Illustrative values only. Kept separate from logic so another dataset can replace them.
const examples: Example[] = [
  { name: '燕麦', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  {
    name: '鸡蛋（全蛋）',
    calories: 144,
    protein: 13.3,
    carbs: 2.8,
    fat: 8.8,
    defaultUnit: '个',
    conversions: [['个', 50]],
  },
  {
    name: '蛋清',
    calories: 48,
    protein: 11.6,
    carbs: 0.8,
    fat: 0.1,
    defaultUnit: '个',
    conversions: [['个', 30]],
  },
  {
    name: '纯牛奶',
    calories: 64,
    protein: 3.3,
    carbs: 4.8,
    fat: 3.6,
    baseUnit: 'ml',
    defaultUnit: 'ml',
    conversions: [['盒', 250]],
  },
  {
    name: '香蕉',
    calories: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
    defaultUnit: '根',
    conversions: [['根', 100]],
  },
  {
    name: '苹果',
    calories: 52,
    protein: 0.3,
    carbs: 13.8,
    fat: 0.2,
    defaultUnit: '个',
    conversions: [['个', 180]],
  },
  { name: '米饭（熟）', calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
  { name: '糙米饭（熟）', calories: 123, protein: 2.7, carbs: 25.6, fat: 1 },
  { name: '荞麦面（干）', calories: 337, protein: 12, carbs: 70, fat: 2.1 },
  { name: '鸡胸肉（生）', calories: 120, protein: 22.5, carbs: 0, fat: 2.6 },
  { name: '鸡腿（生）', calories: 181, protein: 18.2, carbs: 0, fat: 11.8 },
  { name: '鸭腿（生）', calories: 217, protein: 16.5, carbs: 0, fat: 17 },
  { name: '牛肉（瘦，生）', calories: 125, protein: 20.2, carbs: 1.2, fat: 4.2 },
  { name: '猪里脊（生）', calories: 143, protein: 20.3, carbs: 1.5, fat: 6.2 },
  { name: '西兰花', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  { name: '土豆', calories: 77, protein: 2, carbs: 17.5, fat: 0.1 },
  { name: '红薯', calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
  { name: '花生', calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2 },
  {
    name: '蛋白粉示例',
    calories: 400,
    protein: 75,
    carbs: 10,
    fat: 6.7,
    conversions: [['勺', 30]],
  },
  { name: '酸奶', calories: 72, protein: 2.5, carbs: 9.3, fat: 2.7, conversions: [['盒', 200]] },
];

function foodUnits(
  foodId: string,
  baseUnit: Unit,
  defaultUnit: Unit,
  conversions: Array<[Unit, number]>,
): FoodUnit[] {
  return [[baseUnit, 1] as [Unit, number], ...conversions]
    .filter(([unit], index, rows) => rows.findIndex(([candidate]) => candidate === unit) === index)
    .map(([unit, baseAmount], sortOrder) => ({
      id: `${foodId}:unit:${sortOrder}`,
      foodId,
      unit,
      amount: 1,
      baseAmount,
      baseUnit,
      isDefault: unit === defaultUnit ? 1 : 0,
      sortOrder,
    }));
}

export function seedFoods(now: string): Food[] {
  return examples.map((example, index) => {
    const id = `seed-${index + 1}`;
    const baseUnit = example.baseUnit ?? 'g';
    const defaultUnit = example.defaultUnit ?? baseUnit;
    const conversions = example.conversions ?? [];
    return {
      id,
      name: example.name,
      brand: '',
      baseAmount: 100,
      baseUnit,
      calories: example.calories,
      protein: example.protein,
      carbs: example.carbs,
      fat: example.fat,
      saturatedFat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      defaultUnit,
      // Legacy columns stay populated for old snapshots; new calculations use FoodUnit.
      gramsPerUnit: conversions.find(([unit]) => unit === defaultUnit)?.[1] ?? 100,
      gramsPerMl: 1,
      units: foodUnits(id, baseUnit, defaultUnit, conversions),
      isCustom: 0,
      isFavorite: 0,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}
