import type { DataSource } from 'typeorm';

// vehicle_generations is reference data seeded by a migration (19 MINI rows); migrations is not an
// entity, but is filtered too in case a caller passes raw table names.
const KEEP = new Set(['vehicle_generations', 'migrations']);

export function tablesToTruncate(tableNames: string[]): string[] {
  return [...new Set(tableNames)]
    .filter((t) => !KEEP.has(t))
    .sort()
    .map((t) => `"${t.replace(/"/g, '""')}"`);
}

/** Wipes every entity table but the generations catalog, and restarts both document-number sequences. */
export async function resetDemoDb(ds: DataSource): Promise<void> {
  const tables = tablesToTruncate(ds.entityMetadatas.map((m) => m.tableName));
  if (tables.length > 0) await ds.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  await ds.query('ALTER SEQUENCE work_order_doc_number_seq RESTART WITH 1');
  await ds.query('ALTER SEQUENCE work_order_order_number_seq RESTART WITH 1');
}
