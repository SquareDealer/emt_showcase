import { resetDemoDb, tablesToTruncate } from './reset';

it('truncates every entity table except vehicle_generations and migrations', () =>
  expect(tablesToTruncate(['users', 'vehicle_generations', 'clients', 'migrations', 'work_orders'])).toEqual(['"clients"', '"users"', '"work_orders"']));
it('resetDemoDb issues one TRUNCATE … RESTART IDENTITY CASCADE and restarts both sequences', async () => {
  const sql: string[] = [];
  const ds = { entityMetadatas: [{ tableName: 'clients' }, { tableName: 'vehicle_generations' }], query: async (q: string) => { sql.push(q); } } as never;
  await resetDemoDb(ds);
  expect(sql).toEqual(['TRUNCATE TABLE "clients" RESTART IDENTITY CASCADE', 'ALTER SEQUENCE work_order_doc_number_seq RESTART WITH 1', 'ALTER SEQUENCE work_order_order_number_seq RESTART WITH 1']);
});
