import test from 'node:test';
import assert from 'node:assert/strict';
import { seedFoods } from '../database/seed';
import {
  calculate,
  format,
  isOverLimit,
  makeSnapshot,
  numeric,
  progress,
  resizeEntry,
  sumNutrition,
} from '../services/nutrition';
import { chartSegments, summarize, trendDays } from '../services/statistics';
import { dateKey, dateRange, shiftDate } from '../utils/date';
import { FoodEntry } from '../types/models';
const foods = seedFoods('2026-09-14');
test('50 g oats is half of a 100 g nutrition label', () => {
  const n = calculate(foods[0], 50, 'g');
  assert.equal(n.calories, 194.5);
  assert.equal(n.protein, 8.45);
  assert.equal(format(n.calories), '195');
  assert.equal(format(n.protein, 'protein'), '8.4');
});
test('food-specific ml and piece conversions calculate against the nutrition base', () => {
  assert.equal(calculate(foods[3], 250, 'ml').calories, 160);
  assert.equal(calculate(foods[1], 3, '个').calories, 216);
  assert.throws(() => calculate(foods[0], 1, '盒'));
});
test('package nutrition can be direct or converted without requiring grams', () => {
  const instantNoodles = {
    ...foods[0],
    id: 'noodles',
    baseAmount: 1,
    baseUnit: '包',
    defaultUnit: '包',
    calories: 500,
    units: [
      {
        id: 'noodles-package',
        foodId: 'noodles',
        unit: '包',
        amount: 1,
        baseAmount: 1,
        baseUnit: '包',
        isDefault: 1,
        sortOrder: 0,
      },
    ],
  };
  assert.equal(calculate(instantNoodles, 2, '包').calories, 1000);
  const yogurt = {
    ...instantNoodles,
    id: 'yogurt',
    name: '某品牌酸奶',
    baseUnit: '盒',
    defaultUnit: '盒',
    calories: 180,
    units: [
      {
        id: 'yogurt-box',
        foodId: 'yogurt',
        unit: '盒',
        amount: 1,
        baseAmount: 1,
        baseUnit: '盒',
        isDefault: 1,
        sortOrder: 0,
      },
    ],
  };
  assert.equal(calculate(yogurt, 2, '盒').calories, 360);
});
test('spoons convert to the food base while entries keep the selected unit', () => {
  const result = makeSnapshot(foods[18], 2, '勺');
  assert.equal(result.equivalentBaseAmount, 60);
  assert.equal(result.equivalentBaseUnit, 'g');
  assert.equal(result.calories, 240);
  assert.equal(result.amount, 2);
  assert.equal(result.unit, '勺');
});
test('provided calories including zero win; missing calories use 4/4/9', () => {
  assert.equal(calculate({ ...foods[0], calories: 0 }, 100, 'g').calories, 0);
  const n = calculate({ ...foods[0], calories: null, protein: 10, carbs: 20, fat: 5 }, 100, 'g');
  assert.equal(n.calories, 165);
  assert.equal(n.calorieSource, 'estimated');
});
test('invalid amounts and nutrition inputs are rejected', () => {
  for (const amount of [0, -1, NaN, Infinity])
    assert.throws(() => calculate(foods[0], amount, 'g'));
  for (const input of ['', '-1', 'abc', 'Infinity', '1e2']) assert.throws(() => numeric(input));
  assert.equal(numeric('', true), null);
  assert.equal(numeric('0'), 0);
});
test('daily sum retains precision; goals clamp only visual progress', () => {
  const total = sumNutrition([
    calculate(foods[0], 50, 'g'),
    calculate(foods[3], 250, 'ml'),
    calculate(foods[1], 3, '个'),
  ]);
  assert.equal(total.calories, 570.5);
  assert.equal(progress(50, 100), 0.5);
  assert.equal(progress(120, 100), 1);
  assert.equal(progress(10), null);
  assert.equal(isOverLimit(120, 100), false);
  assert.equal(isOverLimit(120.0001, 100), true);
  assert.equal(isOverLimit(2160, 1800), false);
  assert.equal(isOverLimit(2161, 1800), true);
  assert.equal(isOverLimit(100, 0), false);
  assert.equal(isOverLimit(100), false);
});
test('snapshot and resize are independent from changed food', () => {
  const f = { ...foods[0] };
  const snap = makeSnapshot(f, 50, 'g');
  f.calories = 999;
  const entry = {
    ...snap,
    id: '1',
    mealTypeId: 'm',
    date: '2026-09-14',
    createdAt: '',
    updatedAt: '',
  } as FoodEntry;
  assert.equal(snap.calories, 194.5);
  assert.equal(resizeEntry(entry, 100, 'g').calories, 389);
});
test('local calendar boundaries, leap days and bounded ranges', () => {
  assert.equal(dateKey(new Date(2026, 8, 14, 0, 1)), '2026-09-14');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDate('2024-02-28', 1), '2024-02-29');
  assert.equal(dateRange('2026-09-01', '2026-09-07').length, 7);
  assert.throws(() => dateRange('2026-02-30', '2026-03-01'));
  assert.throws(() => dateRange('2026-09-02', '2026-09-01'));
  assert.throws(() => dateRange('2025-01-01', '2026-09-14'));
});
test('trend gaps, recorded zero, averages, min/max and chart segments', () => {
  const n = calculate(foods[0], 100, 'g');
  const rows = trendDays('2026-09-01', '2026-09-03', [
    { ...n, date: '2026-09-01', count: 1 },
    { ...n, calories: 0, date: '2026-09-03', count: 1 },
  ]);
  const stats = summarize(rows);
  assert.equal(rows[1].count, 0);
  assert.equal(stats.count, 2);
  assert.equal(stats.average.calories, 194.5);
  assert.equal(stats.min, 0);
  assert.equal(stats.max, 389);
  assert.equal(chartSegments(rows, 'calories', 300, 220).segments.length, 2);
  assert.equal(summarize([]).min, null);
});
