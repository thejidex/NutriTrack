import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { adapter, testDb } from './helpers';
import { DatabaseQueue } from '../database/driver';
import { migrate, migrations } from '../database/migrations';
import { toCsv } from '../services/export';

test('fresh initialization is idempotent and v1 upgrades to latest version', async () => {
  const { native, queue, repo } = await testDb();
  await migrate(queue);
  assert.equal((await repo.foods.search('')).length, 20);
  assert.equal((await repo.meals()).length, 5);
  native.close();
  const old = new DatabaseSync(':memory:');
  old.exec(migrations[0]);
  old.exec('PRAGMA user_version=1');
  await migrate(new DatabaseQueue(adapter(old)));
  assert.equal(old.prepare('PRAGMA user_version').get()?.user_version, migrations.length);
  old.close();
});
test('v4 migration keeps historical raw portions and backfills generalized base amounts', async () => {
  const old = new DatabaseSync(':memory:');
  old.exec(migrations.slice(0, 4).join('\n'));
  old.exec('PRAGMA user_version=4');
  const now = '2026-09-14T08:00:00.000Z';
  old
    .prepare(`INSERT INTO Food VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      'legacy-food',
      '旧牛奶',
      '',
      100,
      'g',
      64,
      3.3,
      4.8,
      3.6,
      0,
      0,
      0,
      0,
      'ml',
      100,
      1,
      1,
      0,
      null,
      now,
      now,
    );
  old
    .prepare(`INSERT INTO MealType VALUES (?,?,?,?,?,?)`)
    .run('legacy-meal', '早餐', 0, 1, null, now);
  const snapshot = JSON.stringify({
    id: 'legacy-food',
    name: '旧牛奶',
    baseAmount: 100,
    baseUnit: 'g',
    defaultUnit: 'ml',
    gramsPerUnit: 100,
    gramsPerMl: 1,
    calories: 64,
    protein: 3.3,
    carbs: 4.8,
    fat: 3.6,
    saturatedFat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });
  old
    .prepare(`INSERT INTO FoodEntry VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      'legacy-entry',
      'legacy-food',
      'legacy-meal',
      '2026-09-14',
      250,
      'ml',
      250,
      '旧牛奶',
      snapshot,
      'label',
      160,
      8.25,
      12,
      9,
      0,
      0,
      0,
      0,
      now,
      now,
    );

  await migrate(new DatabaseQueue(adapter(old)));
  const entry = old.prepare('SELECT * FROM FoodEntry WHERE id=?').get('legacy-entry');
  assert.equal(entry?.amount, 250);
  assert.equal(entry?.unit, 'ml');
  assert.equal(entry?.equivalentBaseAmount, 250);
  assert.equal(entry?.equivalentBaseUnit, 'g');
  assert.equal(
    old.prepare('SELECT COUNT(*) AS count FROM FoodUnit WHERE foodId=?').get('legacy-food')?.count,
    2,
  );
  old.close();
});
test('add, edit, move, delete, date isolation and copying preserve snapshots', async () => {
  const { native, repo } = await testDb();
  const f = (await repo.foods.get('seed-1'))!;
  const entry = await repo.addEntry(f, 'meal-0', '2026-09-13', 50, 'g');
  assert.equal((await repo.day('2026-09-13'))[0].calories, 194.5);
  assert.equal((await repo.day('2026-09-14')).length, 0);
  await repo.updateEntry(entry, 100, 'g', 'meal-1');
  const changed = (await repo.entry(entry.id))!;
  assert.equal(changed.calories, 389);
  assert.equal(changed.mealTypeId, 'meal-1');
  assert.equal(await repo.copyPrevious('2026-09-14'), 1);
  const copy = (await repo.day('2026-09-14'))[0];
  assert.notEqual(copy.id, entry.id);
  assert.equal(copy.foodSnapshot, changed.foodSnapshot);
  assert.equal((await repo.trend('2026-09-13', '2026-09-14')).length, 2);
  await repo.deleteEntry(entry.id);
  assert.equal((await repo.day('2026-09-13')).length, 0);
  assert.equal((await repo.day('2026-09-14')).length, 1);
  native.close();
});
test('same-meal copies append to the current day and meal clearing removes only that meal', async () => {
  const { native, repo } = await testDb();
  const oats = (await repo.foods.get('seed-1'))!;
  const egg = (await repo.foods.get('seed-2'))!;
  const milk = (await repo.foods.get('seed-4'))!;
  const breakfast = await repo.addEntry(oats, 'meal-0', '2026-09-13', 50, 'g');
  await repo.addEntry(milk, 'meal-1', '2026-09-13', 250, 'ml');
  const existing = await repo.addEntry(egg, 'meal-0', '2026-09-14', 3, '个');

  assert.equal(await repo.copyPreviousMeal('2026-09-14', 'meal-0'), 1);
  assert.equal(await repo.copyPreviousMeal('2026-09-14', 'meal-2'), 0);
  const copiedDay = await repo.day('2026-09-14');
  assert.deepEqual(
    copiedDay.map((entry) => entry.calories),
    [216, 194.5],
  );
  assert.deepEqual(
    copiedDay.map((entry) => entry.mealTypeId),
    ['meal-0', 'meal-0'],
  );
  const copied = copiedDay.find((entry) => entry.id !== existing.id)!;
  assert.notEqual(copied.id, breakfast.id);
  assert.equal(copied.foodSnapshot, breakfast.foodSnapshot);
  assert.equal(copied.amount, breakfast.amount);

  assert.equal(await repo.deleteMealEntries('2026-09-14', 'meal-0'), 2);
  assert.equal(await repo.deleteMealEntries('2026-09-14', 'meal-0'), 0);
  assert.equal((await repo.day('2026-09-14')).length, 0);
  assert.equal((await repo.day('2026-09-13')).length, 2);
  native.close();
});
test('custom food edit/deletion and archived meal never destroy history', async () => {
  const { native, repo } = await testDb();
  const f = { ...(await repo.foods.get('seed-1'))!, id: 'custom-1', isCustom: 1, name: '自制燕麦' };
  await repo.saveFood(f);
  await repo.saveMeal('夜宵');
  const meal = (await repo.meals()).find((m) => m.name === '夜宵')!;
  const entry = await repo.addEntry(f, meal.id, '2026-09-13', 50, 'g');
  await repo.saveFood({ ...f, calories: 999 });
  assert.equal((await repo.entry(entry.id))!.calories, 194.5);
  await repo.updateEntry(entry, 100, 'g', meal.id);
  assert.equal((await repo.entry(entry.id))!.calories, 389);
  await repo.deleteFood(f.id);
  await repo.deleteMeal(meal.id);
  assert.equal((await repo.foods.search('自制')).length, 0);
  assert.equal((await repo.day('2026-09-13')).length, 1);
  assert.equal((await repo.meals()).length, 5);
  assert.equal(await repo.copyPrevious('2026-09-14'), 0);
  assert.equal((await repo.day('2026-09-14')).length, 0);
  native.close();
});
test('default and custom meals both soft-delete, preserve entries, reorder and allow same-name recreation', async () => {
  const { native, repo } = await testDb();
  const oats = (await repo.foods.get('seed-1'))!;
  await repo.addEntry(oats, 'meal-0', '2026-09-14', 50, 'g');
  await repo.saveMeal('夜宵');
  const custom = (await repo.meals()).find((meal) => meal.name === '夜宵')!;
  await repo.deleteMeal(custom.id);
  assert.equal(
    (await repo.meals()).some((meal) => meal.id === custom.id),
    false,
  );

  await repo.deleteMeal('meal-0');
  assert.equal(
    (await repo.meals()).some((meal) => meal.id === 'meal-0'),
    false,
  );
  assert.equal((await repo.day('2026-09-14')).length, 1);
  assert.equal((await repo.meals(true)).find((meal) => meal.id === 'meal-0')!.name, '早餐');
  assert.deepEqual(
    (await repo.meals()).map((meal) => meal.sortOrder),
    [0, 1, 2, 3],
  );

  await repo.saveMeal('早餐');
  const activeBreakfast = (await repo.meals()).find((meal) => meal.name === '早餐')!;
  assert.notEqual(activeBreakfast.id, 'meal-0');
  for (const meal of await repo.meals()) await repo.deleteMeal(meal.id);
  assert.deepEqual(await repo.meals(), []);
  assert.equal((await repo.day('2026-09-14')).length, 1);
  native.close();
});
test('default foods can be edited and soft-deleted without losing entries', async () => {
  const { native, repo } = await testDb();
  const food = (await repo.foods.get('seed-1'))!;
  const entry = await repo.addEntry(food, 'meal-0', '2026-09-13', 50, 'g');
  await repo.saveFood({ ...food, name: '改名的示例食物', calories: 999 });
  assert.equal((await repo.foods.get(food.id))!.name, '改名的示例食物');
  assert.equal((await repo.entry(entry.id))!.calories, 194.5);
  await repo.deleteFood(food.id);
  assert.equal(await repo.foods.get(food.id), null);
  assert.equal((await repo.foods.search('改名的示例食物')).length, 0);
  assert.equal((await repo.day('2026-09-13')).length, 1);
  native.close();
});
test('search literal wildcards, favorite, recent, rename, order and goal persistence', async () => {
  const { native, repo } = await testDb();
  assert.equal((await repo.foods.search('%')).length, 0);
  assert.equal((await repo.foods.search('鸡蛋')).length, 1);
  await repo.favorite('seed-1');
  assert.equal((await repo.foods.search('', 'favorites'))[0].id, 'seed-1');
  await repo.addEntry((await repo.foods.get('seed-1'))!, 'meal-0', '2026-09-14', 50, 'g');
  assert.equal((await repo.foods.search('', 'recent')).length, 1);
  await repo.saveMeal('早午餐', 'meal-0');
  await repo.reorder(['meal-1', 'meal-0', 'meal-2', 'meal-3', 'meal-4']);
  assert.equal((await repo.meals())[0].id, 'meal-1');
  assert.equal((await repo.meals())[1].name, '早午餐');
  await repo.setGoals({ calories: 2200, protein: 150 });
  assert.deepEqual(await repo.goals(), { calories: 2200, protein: 150 });
  await repo.setGoals({});
  assert.deepEqual(await repo.goals(), {});
  native.close();
});
test('transaction rolls back partial writes, queue recovers, exports quote safely', async () => {
  const { native, queue, repo } = await testDb();
  await assert.rejects(
    queue.transaction(async (db) => {
      await db.runAsync('UPDATE Food SET name=? WHERE id=?', 'changed', 'seed-1');
      throw new Error('fail');
    }),
  );
  assert.equal((await repo.foods.get('seed-1'))!.name, '燕麦');
  const entry = await repo.addEntry(
    (await repo.foods.get('seed-1'))!,
    'meal-0',
    '2026-09-14',
    50,
    'g',
  );
  const data = await repo.exportData();
  assert.equal(data.entries.length, 1);
  const csv = toCsv([{ ...entry, foodName: '=SUM(1,2)"' }], data.meals);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=SUM"));
  assert.ok(csv.includes('""'));
  native.close();
});
test('data survives closing and reopening an actual database file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nutritrack-test-'));
  const file = join(dir, 'test.db');
  try {
    const first = await testDb(file);
    await first.repo.addEntry(
      (await first.repo.foods.get('seed-4'))!,
      'meal-0',
      '2026-09-14',
      250,
      'ml',
    );
    first.native.close();
    const second = await testDb(file);
    assert.equal((await second.repo.day('2026-09-14'))[0].calories, 160);
    second.native.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('all foods use SQL count, then latest recording, then name; favorites never boost all', async () => {
  const { native, repo } = await testDb();
  const a = (await repo.foods.get('seed-1'))!;
  const b = (await repo.foods.get('seed-4'))!;
  const c = (await repo.foods.get('seed-2'))!;
  const first = await repo.addEntry(a, 'meal-0', '2026-09-13', 1, 'g');
  const second = await repo.addEntry(a, 'meal-1', '2026-09-13', 1, 'g');
  const third = await repo.addEntry(b, 'meal-0', '2026-09-14', 1000, 'ml');
  const fourth = await repo.addEntry(c, 'meal-0', '2026-09-14', 3, '个');
  native.exec(
    "UPDATE Food SET name='A' WHERE id='seed-1'; UPDATE Food SET name='B' WHERE id='seed-4'; UPDATE Food SET name='C' WHERE id='seed-2'",
  );
  native.prepare('UPDATE FoodEntry SET createdAt=?').run('2026-09-13T08:00:00.000Z');
  native
    .prepare('UPDATE FoodEntry SET createdAt=? WHERE id=?')
    .run('2026-09-14T08:00:00.000Z', fourth.id);
  await repo.favorite('seed-5');
  let rows = await repo.foods.searchWithUsage('');
  assert.deepEqual(
    rows.slice(0, 3).map((r) => r.food.id),
    [a.id, c.id, b.id],
  );
  assert.equal(rows[0].usageCount, 2);
  assert.equal(rows.find((r) => r.food.id === 'seed-4')!.lastAmount, 1000);
  assert.equal(rows.find((r) => r.food.id === 'seed-4')!.lastUnit, 'ml');
  assert.equal(rows.find((r) => r.food.id === 'seed-5')!.usageCount, 0);
  const recentRows = await repo.foods.searchWithUsage('', 'recent');
  assert.equal(recentRows[0].food.id, c.id);
  assert.equal(recentRows[0].lastAmount, 3);
  assert.equal(recentRows[0].lastUnit, '个');
  await repo.updateEntry((await repo.entry(first.id))!, 999, 'g', 'meal-0');
  assert.equal((await repo.foods.searchWithUsage(''))[0].usageCount, 2);
  native
    .prepare('UPDATE FoodEntry SET createdAt=? WHERE id=?')
    .run('2026-09-14T08:00:00.000Z', third.id);
  rows = await repo.foods.searchWithUsage('');
  assert.deepEqual(
    rows.slice(0, 3).map((r) => r.food.id),
    [a.id, b.id, c.id],
  );
  await repo.deleteEntry(second.id);
  assert.equal((await repo.foods.searchWithUsage(''))[0].food.id, b.id);
  assert.equal(await repo.copyPrevious('2026-09-14'), 1);
  assert.equal((await repo.foods.searchWithUsage(''))[0].usageCount, 2);
  const plainFood = (await repo.foods.search(''))[0];
  assert.ok(!('usageCount' in plainFood));
  assert.ok(!('lastAmount' in plainFood));
  assert.ok(!('lastUnit' in plainFood));
  native.close();
});

test('latest migration is idempotent and preserves all diary tables and old appearance settings', async () => {
  const { native, repo, queue } = await testDb();
  await repo.addEntry((await repo.foods.get('seed-1'))!, 'meal-0', '2026-09-14', 50, 'g');
  await repo.setGoals({ calories: 2200 });
  await repo.setSetting('theme', 'dark');
  native.prepare('INSERT INTO AppSettings (key,value) VALUES (?,?)').run('accent', 'orange');
  const before = await repo.exportData();
  await migrate(queue);
  const after = await repo.exportData();
  for (const key of ['foods', 'meals', 'entries', 'goals', 'settings'] as const)
    assert.deepEqual(after[key], before[key]);
  assert.equal(after.schemaVersion, migrations.length);
  // Legacy color preferences remain in SQLite exports but are ignored by the current theme.
  assert.equal(await repo.setting('accent'), 'orange');
  assert.equal(await repo.setting('theme'), 'dark');
  native.close();
});

test('latest food-specific portion follows diary date and quick add preserves amount plus unit', async () => {
  const { native, repo } = await testDb();
  const protein = (await repo.foods.get('seed-19'))!;
  const olderDay = await repo.addEntry(protein, 'meal-0', '2026-09-13', 50, 'g');
  const newerDay = await repo.addEntry(protein, 'meal-0', '2026-09-14', 2, '勺');

  // Diary date wins even when an older day's row was created/imported later.
  native
    .prepare('UPDATE FoodEntry SET createdAt=? WHERE id=?')
    .run('2030-01-01T00:00:00.000Z', olderDay.id);
  native
    .prepare('UPDATE FoodEntry SET createdAt=? WHERE id=?')
    .run('2020-01-01T00:00:00.000Z', newerDay.id);
  assert.deepEqual(await repo.latestEntryPortion(protein.id), { amount: 2, unit: '勺' });

  // Within the same diary date, createdAt selects the most recently produced entry.
  const newestOnDay = await repo.addEntry(protein, 'meal-0', '2026-09-14', 3, '勺');
  native
    .prepare('UPDATE FoodEntry SET createdAt=? WHERE id=?')
    .run('2021-01-01T00:00:00.000Z', newestOnDay.id);
  assert.deepEqual(await repo.latestEntryPortion(protein.id), { amount: 3, unit: '勺' });

  const added = await repo.quickAddLatestEntry(protein.id, 'meal-1', '2026-09-15');
  assert.ok(added);
  assert.equal(added.amount, 3);
  assert.equal(added.unit, '勺');
  assert.equal(added.equivalentBaseAmount, 90);
  assert.equal(added.mealTypeId, 'meal-1');
  assert.equal(added.date, '2026-09-15');
  assert.deepEqual({ ...(await repo.entry(added.id))! }, added);

  const [first, second] = await Promise.all([
    repo.quickAddLatestEntry(protein.id, 'meal-2', '2026-09-15'),
    repo.quickAddLatestEntry(protein.id, 'meal-2', '2026-09-15'),
  ]);
  assert.ok(first && second);
  assert.notEqual(first.id, second.id);
  assert.equal((await repo.day('2026-09-15')).length, 3);

  const beforeUnused = (await repo.day('2026-09-15')).length;
  assert.equal(await repo.quickAddLatestEntry('seed-2', 'meal-0', '2026-09-15'), null);
  assert.equal((await repo.day('2026-09-15')).length, beforeUnused);

  const plan = native
    .prepare(
      `EXPLAIN QUERY PLAN SELECT amount, unit FROM FoodEntry
       WHERE foodId = ? ORDER BY date DESC, createdAt DESC, id DESC LIMIT 1`,
    )
    .all(protein.id)
    .map((row) => String(row.detail))
    .join(' ');
  assert.match(plan, /entry_food_latest/);
  native.close();
});
