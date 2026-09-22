import { Database, DatabaseQueue } from '../database/driver';
import { insertObject } from '../database/migrations';
import {
  DayTotal,
  Food,
  FoodEntry,
  Goals,
  MealType,
  ThemeMode,
  Unit,
  nutrientKeys,
} from '../types/models';
import {
  makeSnapshot,
  normalizeFood,
  resizeEntry,
  validateFoodUnits,
  validateGoals,
} from '../services/nutrition';
import { dateRange, parseDate, shiftDate } from '../utils/date';
import { attachFoodUnits, FoodDataProvider, LocalFoodProvider } from './FoodDataProvider';
import { s } from '../i18n/zh-CN';
const now = () => new Date().toISOString();
export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
type EntryPortion = Pick<FoodEntry, 'amount' | 'unit'>;

const latestEntryPortion = async (db: Database, foodId: string): Promise<EntryPortion | null> => {
  const row = await db.getFirstAsync<EntryPortion>(
    `SELECT amount, unit FROM FoodEntry
     WHERE foodId = ?
     ORDER BY date DESC, createdAt DESC, id DESC
     LIMIT 1`,
    foodId,
  );
  return row ? { amount: row.amount, unit: row.unit } : null;
};

function createEntry(
  food: Food,
  mealTypeId: string,
  date: string,
  amount: number,
  unit: Unit,
): FoodEntry {
  const stamp = now();
  return {
    ...makeSnapshot(food, amount, unit),
    id: newId(),
    mealTypeId,
    date,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export class AppRepository {
  readonly foods: FoodDataProvider;
  constructor(
    readonly queue: DatabaseQueue,
    foodProvider?: FoodDataProvider,
  ) {
    this.foods = foodProvider ?? new LocalFoodProvider(queue);
  }
  meals(includeArchived = false) {
    return this.queue.run((db) =>
      db.getAllAsync<MealType>(
        `SELECT * FROM MealType ${includeArchived ? '' : 'WHERE deletedAt IS NULL'} ORDER BY sortOrder, createdAt`,
      ),
    );
  }
  day(date: string) {
    parseDate(date);
    return this.queue.run((db) =>
      db.getAllAsync<FoodEntry>(
        'SELECT * FROM FoodEntry WHERE date = ? ORDER BY calories DESC, createdAt, id',
        date,
      ),
    );
  }
  entry(id: string) {
    return this.queue.run((db) =>
      db.getFirstAsync<FoodEntry>('SELECT * FROM FoodEntry WHERE id = ?', id),
    );
  }
  trend(start: string, end: string) {
    dateRange(start, end);
    return this.queue.run((db) =>
      db.getAllAsync<DayTotal>(
        `SELECT date, COUNT(*) count, ${nutrientKeys.map((k) => `SUM(${k}) ${k}`).join(',')} FROM FoodEntry WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
        start,
        end,
      ),
    );
  }
  async addEntry(food: Food, mealTypeId: string, date: string, amount: number, unit: Unit) {
    parseDate(date);
    const entry = createEntry(food, mealTypeId, date, amount, unit);
    await this.queue.transaction(async (db) => {
      const meal = await db.getFirstAsync<MealType>(
        'SELECT * FROM MealType WHERE id = ? AND deletedAt IS NULL',
        mealTypeId,
      );
      if (!meal) throw new Error(s.missing);
      await insertObject(db, 'FoodEntry', entry);
    });
    return entry;
  }
  latestEntryPortion(foodId: string): Promise<EntryPortion | null> {
    return this.queue.run((db) => latestEntryPortion(db, foodId));
  }
  async quickAddLatestEntry(
    foodId: string,
    mealTypeId: string,
    date: string,
  ): Promise<FoodEntry | null> {
    parseDate(date);
    return this.queue.transaction(async (db) => {
      const portion = await latestEntryPortion(db, foodId);
      if (!portion) return null;
      const foodRow = await db.getFirstAsync<Omit<Food, 'units'>>(
        'SELECT * FROM Food WHERE id = ? AND deletedAt IS NULL',
        foodId,
      );
      const meal = await db.getFirstAsync<MealType>(
        'SELECT * FROM MealType WHERE id = ? AND deletedAt IS NULL',
        mealTypeId,
      );
      if (!foodRow || !meal) throw new Error(s.missing);
      const food = (await attachFoodUnits(db, [foodRow]))[0];
      const entry = createEntry(food, mealTypeId, date, portion.amount, portion.unit);
      await insertObject(db, 'FoodEntry', entry);
      return entry;
    });
  }
  async updateEntry(entry: FoodEntry, amount: number, unit: Unit, mealTypeId: string) {
    const updated = { ...resizeEntry(entry, amount, unit), mealTypeId, updatedAt: now() };
    await this.queue.run(async (db) => {
      const fields = Object.entries(updated).filter(([key]) => key !== 'id');
      await db.runAsync(
        `UPDATE FoodEntry SET ${fields.map(([key]) => `${key}=?`).join(',')} WHERE id=?`,
        ...fields.map(([, value]) => value),
        entry.id,
      );
    });
  }
  deleteEntry(id: string) {
    return this.queue.run((db) => db.runAsync('DELETE FROM FoodEntry WHERE id=?', id));
  }
  async deleteMealEntries(date: string, mealTypeId: string) {
    parseDate(date);
    return this.queue.transaction(async (db) => {
      const rows = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM FoodEntry WHERE date=? AND mealTypeId=?',
        date,
        mealTypeId,
      );
      if (rows.length)
        await db.runAsync('DELETE FROM FoodEntry WHERE date=? AND mealTypeId=?', date, mealTypeId);
      return rows.length;
    });
  }
  copyPrevious(date: string) {
    const previous = shiftDate(date, -1);
    return this.queue.transaction(async (db) => {
      const rows = await db.getAllAsync<FoodEntry>(
        `SELECT e.* FROM FoodEntry e
         JOIN MealType m ON m.id=e.mealTypeId
         WHERE e.date=? AND m.deletedAt IS NULL ORDER BY e.createdAt`,
        previous,
      );
      for (const row of rows)
        await insertObject(db, 'FoodEntry', {
          ...row,
          id: newId(),
          date,
          createdAt: now(),
          updatedAt: now(),
        });
      return rows.length;
    });
  }
  copyPreviousMeal(date: string, mealTypeId: string) {
    const previous = shiftDate(date, -1);
    return this.queue.transaction(async (db) => {
      const active = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM MealType WHERE id=? AND deletedAt IS NULL',
        mealTypeId,
      );
      if (!active) return 0;
      const rows = await db.getAllAsync<FoodEntry>(
        'SELECT * FROM FoodEntry WHERE date=? AND mealTypeId=? ORDER BY createdAt, id',
        previous,
        mealTypeId,
      );
      const stamp = now();
      for (const row of rows)
        await insertObject(db, 'FoodEntry', {
          ...row,
          id: newId(),
          date,
          createdAt: stamp,
          updatedAt: stamp,
        });
      return rows.length;
    });
  }
  async saveFood(food: Food) {
    if (!food.name.trim()) throw new Error(s.requiredName);
    const normalized = validateFoodUnits(normalizeFood(food));
    makeSnapshot(normalized, 1, normalized.defaultUnit);
    return this.queue.transaction(async (db) => {
      const old = await db.getFirstAsync<Omit<Food, 'units'>>(
        'SELECT * FROM Food WHERE id=?',
        normalized.id,
      );
      const { units, ...foodRow } = normalized;
      const row = { ...foodRow, name: normalized.name.trim(), updatedAt: now() };
      if (!old) await insertObject(db, 'Food', row);
      else {
        const fields = Object.entries(row).filter(([key]) => key !== 'id');
        await db.runAsync(
          `UPDATE Food SET ${fields.map(([key]) => `${key}=?`).join(',')} WHERE id=?`,
          ...fields.map(([, value]) => value),
          normalized.id,
        );
      }
      await db.runAsync('DELETE FROM FoodUnit WHERE foodId=?', normalized.id);
      for (const [sortOrder, unit] of units.entries())
        await insertObject(db, 'FoodUnit', {
          ...unit,
          id: `${normalized.id}:unit:${sortOrder}`,
          foodId: normalized.id,
          isDefault: unit.unit === normalized.defaultUnit ? 1 : 0,
          sortOrder,
        });
    });
  }
  favorite(id: string) {
    return this.queue.run((db) =>
      db.runAsync('UPDATE Food SET isFavorite=1-isFavorite, updatedAt=? WHERE id=?', now(), id),
    );
  }
  deleteFood(id: string) {
    return this.queue.run((db) =>
      db.runAsync(
        'UPDATE Food SET deletedAt=?, updatedAt=? WHERE id=? AND deletedAt IS NULL',
        now(),
        now(),
        id,
      ),
    );
  }
  saveMeal(name: string, id?: string) {
    if (!name.trim()) throw new Error(s.newMeal);
    return this.queue.transaction(async (db) => {
      if (id) await db.runAsync('UPDATE MealType SET name=? WHERE id=?', name.trim(), id);
      else {
        const max = await db.getFirstAsync<{ n: number }>(
          'SELECT COALESCE(MAX(sortOrder), -1) n FROM MealType',
        );
        await insertObject(db, 'MealType', {
          id: newId(),
          name: name.trim(),
          sortOrder: (max?.n ?? -1) + 1,
          isDefault: 0,
          deletedAt: null,
          createdAt: now(),
        });
      }
    });
  }
  deleteMeal(id: string) {
    return this.queue.transaction(async (db) => {
      await db.runAsync(
        'UPDATE MealType SET deletedAt=? WHERE id=? AND deletedAt IS NULL',
        now(),
        id,
      );
      const active = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM MealType WHERE deletedAt IS NULL ORDER BY sortOrder,createdAt,id',
      );
      for (const [sortOrder, meal] of active.entries())
        await db.runAsync('UPDATE MealType SET sortOrder=? WHERE id=?', sortOrder, meal.id);
    });
  }
  reorder(ids: string[]) {
    return this.queue.transaction(async (db) => {
      for (const [i, id] of ids.entries())
        await db.runAsync('UPDATE MealType SET sortOrder=? WHERE id=?', i, id);
    });
  }
  async goals(): Promise<Goals> {
    return this.queue.run(async (db) => {
      const row = await db.getFirstAsync<Record<string, number | null>>(
        'SELECT calories,protein,carbs,fat FROM NutritionGoal WHERE id=1',
      );
      return Object.fromEntries(Object.entries(row ?? {}).filter(([, v]) => v !== null)) as Goals;
    });
  }
  setGoals(goals: Goals) {
    validateGoals(goals);
    return this.queue.run((db) =>
      db.runAsync(
        'INSERT OR REPLACE INTO NutritionGoal (id,calories,protein,carbs,fat,updatedAt) VALUES (1,?,?,?,?,?)',
        goals.calories ?? null,
        goals.protein ?? null,
        goals.carbs ?? null,
        goals.fat ?? null,
        now(),
      ),
    );
  }
  async setting(key: string): Promise<string | null> {
    return this.queue.run(
      async (db) =>
        (
          await db.getFirstAsync<{ value: string }>(
            'SELECT value FROM AppSettings WHERE key=?',
            key,
          )
        )?.value ?? null,
    );
  }
  setSetting(key: 'theme' | 'detail' | 'homeTitle', value: ThemeMode | string) {
    return this.queue.run((db) =>
      db.runAsync('INSERT OR REPLACE INTO AppSettings (key,value) VALUES (?,?)', key, value),
    );
  }
  exportData() {
    return this.queue.transaction(async (db) => ({
      schemaVersion: (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))
        ?.user_version,
      exportedAt: now(),
      foods: await db.getAllAsync<Food>('SELECT * FROM Food'),
      foodUnits: await db.getAllAsync('SELECT * FROM FoodUnit ORDER BY foodId,sortOrder,id'),
      meals: await db.getAllAsync<MealType>('SELECT * FROM MealType'),
      entries: await db.getAllAsync<FoodEntry>('SELECT * FROM FoodEntry ORDER BY date,createdAt'),
      goals: await db.getAllAsync('SELECT * FROM NutritionGoal'),
      settings: await db.getAllAsync('SELECT * FROM AppSettings'),
    }));
  }
}
