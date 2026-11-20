import 'server-only';
import {getDb, schema} from '@/db';

/** The tax copy of the software is the same code deployed with TAX_MODE=1. */
export const isTaxMode = process.env.TAX_MODE === '1';

/** Feature on/off map: missing key = on. */
export async function getToggles(): Promise<Record<string, boolean>> {
  const db = await getDb();
  const rows = await db.select().from(schema.featureToggles);
  return Object.fromEntries(rows.map(r => [r.feature, r.enabled]));
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
