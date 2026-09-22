import { FoodEntry, MealType } from '../types/models';
import { s } from '../i18n/zh-CN';
function escape(value: string | number): string {
  // Prevent spreadsheet formula injection in user-authored names.
  const text = String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function toCsv(entries: FoodEntry[], meals: MealType[]): string {
  const names = new Map(meals.map((m) => [m.id, m.name]));
  const header = [
    s.selectedDate,
    s.meal,
    s.foods,
    s.amount,
    s.unit,
    'kcal',
    `${s.protein} g`,
    `${s.carbs} g`,
    `${s.fat} g`,
  ];
  const rows = entries.map((e) => [
    e.date,
    names.get(e.mealTypeId) ?? e.mealTypeId,
    e.foodName,
    e.amount,
    e.unit,
    e.calories,
    e.protein,
    e.carbs,
    e.fat,
  ]);
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}
