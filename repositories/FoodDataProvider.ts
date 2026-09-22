import { Food, FoodFilter, FoodSearchResult, FoodUnit, Unit } from '../types/models';
import { Database, DatabaseQueue } from '../database/driver';
import { normalizeFood } from '../services/nutrition';

type FoodRow = Omit<Food, 'units'>;

export async function attachFoodUnits(db: Database, rows: FoodRow[]): Promise<Food[]> {
  if (!rows.length) return [];
  const placeholders = rows.map(() => '?').join(',');
  const units = await db.getAllAsync<FoodUnit>(
    `SELECT * FROM FoodUnit WHERE foodId IN (${placeholders}) ORDER BY sortOrder,id`,
    ...rows.map((food) => food.id),
  );
  const byFood = new Map<string, FoodUnit[]>();
  for (const unit of units) {
    const list = byFood.get(unit.foodId);
    if (list) list.push(unit);
    else byFood.set(unit.foodId, [unit]);
  }
  return rows.map((food) => normalizeFood({ ...food, units: byFood.get(food.id) ?? [] }));
}
export interface FoodDataProvider {
  search(query: string, filter?: FoodFilter, offset?: number): Promise<Food[]>;
  searchWithUsage(query: string, filter?: FoodFilter, offset?: number): Promise<FoodSearchResult[]>;
  get(id: string): Promise<Food | null>;
}
export class LocalFoodProvider implements FoodDataProvider {
  constructor(private queue: DatabaseQueue) {}
  get(id: string) {
    return this.queue.run(async (db) => {
      const row = await db.getFirstAsync<FoodRow>(
        'SELECT * FROM Food WHERE id = ? AND deletedAt IS NULL',
        id,
      );
      return row ? (await attachFoodUnits(db, [row]))[0] : null;
    });
  }
  async search(query: string, filter: FoodFilter = 'all', offset = 0): Promise<Food[]> {
    return (await this.searchWithUsage(query, filter, offset)).map((result) => result.food);
  }
  async searchWithUsage(
    query: string,
    filter: FoodFilter = 'all',
    offset = 0,
  ): Promise<FoodSearchResult[]> {
    const match = `%${query.replace(/[!%_]/g, '!$&')}%`;
    const filterSql =
      filter === 'favorites'
        ? 'AND f.isFavorite = 1'
        : filter === 'custom'
          ? 'AND f.isCustom = 1'
          : filter === 'recent'
            ? 'AND r.usageCount > 0'
            : '';
    // Count entries, never weights. Editing doesn't change createdAt; copying creates a use.
    const order =
      filter === 'all'
        ? 'usageCount DESC, latest.date DESC, latest.createdAt DESC,'
        : filter === 'recent'
          ? 'latest.date DESC, latest.createdAt DESC,'
          : '';
    const rows = await this.queue.run((db) =>
      db.getAllAsync<
        FoodRow & {
          usageCount: number;
          lastUsedAt: string | null;
          lastAmount: number | null;
          lastUnit: Unit | null;
        }
      >(
        `SELECT f.*, COALESCE(r.usageCount, 0) usageCount, latest.createdAt lastUsedAt,
        latest.amount lastAmount, latest.unit lastUnit FROM Food f
      LEFT JOIN (SELECT foodId, COUNT(*) usageCount FROM FoodEntry GROUP BY foodId) r ON r.foodId=f.id
      LEFT JOIN FoodEntry latest ON latest.id = (SELECT e.id FROM FoodEntry e WHERE e.foodId=f.id ORDER BY e.date DESC, e.createdAt DESC, e.id DESC LIMIT 1)
      WHERE f.deletedAt IS NULL AND (f.name LIKE ? ESCAPE '!' OR f.brand LIKE ? ESCAPE '!') ${filterSql}
      ORDER BY ${order} f.name COLLATE NOCASE, f.id LIMIT 40 OFFSET ?`,
        match,
        match,
        offset,
      ),
    );
    // Query metadata must not leak into Food snapshots or writable columns.
    const metadata = rows.map(({ usageCount, lastUsedAt, lastAmount, lastUnit }) => ({
      usageCount,
      lastUsedAt,
      lastAmount,
      lastUnit,
    }));
    const foods = await this.queue.run((db) =>
      attachFoodUnits(
        db,
        rows.map(
          ({
            usageCount: _count,
            lastUsedAt: _at,
            lastAmount: _amount,
            lastUnit: _unit,
            ...food
          }) => food,
        ),
      ),
    );
    return foods.map((food, index) => ({ food, ...metadata[index] }));
  }
}
