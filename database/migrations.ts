import { Database, DatabaseQueue } from './driver';
import { seedFoods } from './seed';
import { s } from '../i18n/zh-CN';

export const migrations = [
  `CREATE TABLE Food (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', baseAmount REAL NOT NULL CHECK(baseAmount > 0),
    baseUnit TEXT NOT NULL, calories REAL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL,
    saturatedFat REAL NOT NULL DEFAULT 0, fiber REAL NOT NULL DEFAULT 0, sugar REAL NOT NULL DEFAULT 0, sodium REAL NOT NULL DEFAULT 0,
    defaultUnit TEXT NOT NULL, gramsPerUnit REAL NOT NULL CHECK(gramsPerUnit > 0), gramsPerMl REAL NOT NULL CHECK(gramsPerMl > 0),
    isCustom INTEGER NOT NULL DEFAULT 0, isFavorite INTEGER NOT NULL DEFAULT 0, deletedAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
  CREATE TABLE MealType (id TEXT PRIMARY KEY, name TEXT NOT NULL, sortOrder INTEGER NOT NULL, isDefault INTEGER NOT NULL DEFAULT 0, deletedAt TEXT, createdAt TEXT NOT NULL);
  CREATE TABLE FoodEntry (
    id TEXT PRIMARY KEY, foodId TEXT NOT NULL REFERENCES Food(id), mealTypeId TEXT NOT NULL REFERENCES MealType(id),
    date TEXT NOT NULL, amount REAL NOT NULL CHECK(amount > 0), unit TEXT NOT NULL, calculatedGrams REAL NOT NULL,
    foodName TEXT NOT NULL, foodSnapshot TEXT NOT NULL, calorieSource TEXT NOT NULL,
    calories REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL,
    saturatedFat REAL NOT NULL, fiber REAL NOT NULL, sugar REAL NOT NULL, sodium REAL NOT NULL,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
  CREATE TABLE NutritionGoal (id INTEGER PRIMARY KEY CHECK(id=1), calories REAL, protein REAL, carbs REAL, fat REAL, updatedAt TEXT NOT NULL);
  CREATE TABLE AppSettings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX entry_date ON FoodEntry(date);
  CREATE INDEX entry_food ON FoodEntry(foodId);
  CREATE INDEX entry_meal ON FoodEntry(mealTypeId);
  CREATE INDEX food_name ON Food(name);`,
  `CREATE INDEX entry_range_meal ON FoodEntry(date, mealTypeId);
   CREATE INDEX food_available ON Food(deletedAt, isCustom, isFavorite);`,
  `CREATE INDEX entry_food_created ON FoodEntry(foodId, createdAt DESC);`,
  `CREATE INDEX entry_food_latest ON FoodEntry(foodId, date DESC, createdAt DESC, id DESC);`,
  `CREATE TABLE FoodUnit (
    id TEXT PRIMARY KEY, foodId TEXT NOT NULL REFERENCES Food(id), unit TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0), baseAmount REAL NOT NULL CHECK(baseAmount > 0),
    baseUnit TEXT NOT NULL, isDefault INTEGER NOT NULL DEFAULT 0, sortOrder INTEGER NOT NULL DEFAULT 0,
    UNIQUE(foodId, unit));
   CREATE INDEX food_unit_food ON FoodUnit(foodId, sortOrder);
   ALTER TABLE FoodEntry ADD COLUMN equivalentBaseAmount REAL;
   ALTER TABLE FoodEntry ADD COLUMN equivalentBaseUnit TEXT;
   INSERT INTO FoodUnit (id,foodId,unit,amount,baseAmount,baseUnit,isDefault,sortOrder)
     SELECT id || ':unit:base',id,baseUnit,1,1,baseUnit,CASE WHEN defaultUnit=baseUnit THEN 1 ELSE 0 END,0 FROM Food;
   INSERT OR IGNORE INTO FoodUnit (id,foodId,unit,amount,baseAmount,baseUnit,isDefault,sortOrder)
     SELECT id || ':unit:default',id,defaultUnit,1,
       CASE
         WHEN baseUnit='g' THEN CASE WHEN defaultUnit='ml' THEN gramsPerMl ELSE gramsPerUnit END
         WHEN baseUnit='ml' THEN CASE WHEN defaultUnit='g' THEN 1/gramsPerMl ELSE gramsPerUnit/gramsPerMl END
         ELSE CASE WHEN defaultUnit='g' THEN 1/gramsPerUnit WHEN defaultUnit='ml' THEN gramsPerMl/gramsPerUnit ELSE 1 END
       END,
       baseUnit,1,1 FROM Food WHERE defaultUnit<>baseUnit;
   INSERT OR IGNORE INTO FoodUnit
     SELECT 'seed-4:unit:box','seed-4','盒',1,250,'ml',0,2 WHERE EXISTS (SELECT 1 FROM Food WHERE id='seed-4');
   INSERT OR IGNORE INTO FoodUnit
     SELECT 'seed-19:unit:scoop','seed-19','勺',1,30,'g',0,2 WHERE EXISTS (SELECT 1 FROM Food WHERE id='seed-19');
   INSERT OR IGNORE INTO FoodUnit
     SELECT 'seed-20:unit:box','seed-20','盒',1,200,'g',0,2 WHERE EXISTS (SELECT 1 FROM Food WHERE id='seed-20');
   UPDATE FoodEntry SET
     equivalentBaseUnit=COALESCE(json_extract(foodSnapshot,'$.baseUnit'),'g'),
     equivalentBaseAmount=CASE COALESCE(json_extract(foodSnapshot,'$.baseUnit'),'g')
       WHEN 'g' THEN calculatedGrams
       WHEN 'ml' THEN calculatedGrams/COALESCE(NULLIF(json_extract(foodSnapshot,'$.gramsPerMl'),0),1)
       ELSE calculatedGrams/COALESCE(NULLIF(json_extract(foodSnapshot,'$.gramsPerUnit'),0),1)
     END;`,
];
export async function insertObject(
  db: Database,
  table: 'Food' | 'FoodEntry' | 'MealType' | 'FoodUnit',
  row: object,
): Promise<void> {
  const entries = Object.entries(row) as [string, string | number | null][];
  await db.runAsync(
    `INSERT INTO ${table} (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`,
    ...entries.map(([, v]) => v),
  );
}
export async function migrate(queue: DatabaseQueue): Promise<void> {
  await queue.run((db) =>
    db.execAsync(
      'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;',
    ),
  );
  await queue.transaction(async (db) => {
    const version =
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    if (version > migrations.length) throw new Error('Database was created by a newer app.');
    for (let i = version; i < migrations.length; i++) {
      await db.execAsync(migrations[i]);
      if (i === 0) {
        const now = new Date().toISOString();
        for (const food of seedFoods(now)) {
          const { units: _units, ...row } = food;
          await insertObject(db, 'Food', row);
        }
        for (const [index, name] of s.defaultMeals.entries()) {
          await insertObject(db, 'MealType', {
            id: `meal-${index}`,
            name,
            sortOrder: index,
            isDefault: 1,
            deletedAt: null,
            createdAt: now,
          });
        }
      }
      await db.execAsync(`PRAGMA user_version = ${i + 1}`);
    }
  });
}
