import { DatabaseSync } from 'node:sqlite';
import { Database, DatabaseQueue, Bind } from '../database/driver';
import { migrate } from '../database/migrations';
import { AppRepository } from '../repositories/AppRepository';
export function adapter(native: DatabaseSync): Database {
  return {
    async execAsync(sql: string) {
      native.exec(sql);
    },
    async runAsync(sql: string, ...params: Bind[]) {
      return native.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, ...params: Bind[]) {
      return native.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: Bind[]) {
      return (native.prepare(sql).get(...params) as T) ?? null;
    },
  };
}
export async function testDb(filename = ':memory:') {
  const native = new DatabaseSync(filename);
  const queue = new DatabaseQueue(adapter(native));
  await migrate(queue);
  return { native, queue, repo: new AppRepository(queue) };
}
