// Small SQL boundary: the production adapter is expo-sqlite; tests use real Node SQLite.
export type Bind = string | number | null;
export interface Database {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Bind[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: Bind[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: Bind[]): Promise<T | null>;
}
export class DatabaseQueue {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(readonly db: Database) {}
  run<T>(work: (db: Database) => Promise<T>): Promise<T> {
    const next = this.tail.then(() => work(this.db));
    this.tail = next.catch(() => undefined);
    return next;
  }
  transaction<T>(work: (db: Database) => Promise<T>): Promise<T> {
    return this.run(async (db) => {
      await db.execAsync('BEGIN IMMEDIATE');
      try {
        const result = await work(db);
        await db.execAsync('COMMIT');
        return result;
      } catch (error) {
        await db.execAsync('ROLLBACK');
        throw error;
      }
    });
  }
}
