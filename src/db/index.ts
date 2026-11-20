import 'server-only';
import path from 'node:path';
import type {PgDatabase, PgQueryResultHKT} from 'drizzle-orm/pg-core';
import * as schema from './schema';
import {seedIfEmpty} from './seed';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * One database handle per server process.
 *
 * - With DATABASE_URL (Neon on Vercel, or local Postgres) data is persistent.
 * - Without it, an in-memory Postgres (PGlite) starts with demo data so a fresh
 *   deploy works before a database is attached. That data resets on restart.
 *
 * Migrations run on first use, so nobody has to run a migration command.
 */
const globalForDb = globalThis as unknown as {atgDb?: Promise<DB>};

export function getDb(): Promise<DB> {
  if (!globalForDb.atgDb) {
    globalForDb.atgDb = init().catch(err => {
      globalForDb.atgDb = undefined;
      throw err;
    });
  }
  return globalForDb.atgDb;
}

export const isDemoDatabase = !process.env.DATABASE_URL;

const migrationsFolder = path.join(process.cwd(), 'drizzle');

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  let db: DB;
  if (url) {
    const {Pool} = await import('pg');
    const {drizzle} = await import('drizzle-orm/node-postgres');
    const {migrate} = await import('drizzle-orm/node-postgres/migrator');
    const pool = new Pool({
      connectionString: url,
      max: 5,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : {rejectUnauthorized: false},
    });
    const nodeDb = drizzle(pool, {schema});
    // Serialize migrations across concurrent cold starts.
    const client = await pool.connect();
    try {
      await client.query('select pg_advisory_lock(424242)');
      await migrate(nodeDb, {migrationsFolder});
    } finally {
      await client.query('select pg_advisory_unlock(424242)');
      client.release();
    }
    db = nodeDb as unknown as DB;
  } else {
    const {PGlite} = await import('@electric-sql/pglite');
    const {drizzle} = await import('drizzle-orm/pglite');
    const {migrate} = await import('drizzle-orm/pglite/migrator');
    const client = new PGlite();
    const liteDb = drizzle(client, {schema});
    await migrate(liteDb, {migrationsFolder});
    db = liteDb as unknown as DB;
  }
  await seedIfEmpty(db);
  return db;
}

export {schema};
