import { buildDemoPlan } from './plan';
import { assignDocNumbers, toLaborRow, toPartRow, toWorkOrderRow } from './rows';
import { mskAt } from './time';

const wo = buildDemoPlan(mskAt('2026-11-04', 12)).workOrders.find((w) => w.status === 'closed')!;
it('work order row sets every NOT NULL numeric explicitly and drops plan-only fields', () => {
  const row = toWorkOrderRow(wo, 7) as Record<string, unknown>;
  expect(row).toMatchObject({ id: wo.id, doc_number: 7, total_cached: wo.total_cached, paid_amount: wo.paid_amount, total_frozen: wo.total_frozen, created_at: wo.created_at, updated_at: wo.updated_at, closed_at: wo.closed_at, order_doc_number: null });
  expect(Object.values(row).includes(undefined)).toBe(false);
  for (const k of ['labor', 'parts', 'client_id', 'odometer_km']) expect(k in row).toBe(false);
});
it('line rows carry rate_snapshot / unit_price / qty as numbers', () => {
  expect(typeof toLaborRow(wo.labor[0], wo.id).rate_snapshot).toBe('number');
  const p = toPartRow(wo.parts[0], wo.id);
  expect([typeof p.unit_price, typeof p.qty]).toEqual(['number', 'number']);
  expect(Object.values(p).includes(undefined)).toBe(false);
});
it('doc numbers follow closed_at, ties broken by id', () => {
  const m = assignDocNumbers([{ id: 'b', closed_at: new Date(2) }, { id: 'c', closed_at: new Date(1) }, { id: 'a', closed_at: new Date(2) }], [11, 12, 13]);
  expect([...m.entries()]).toEqual([['c', 11], ['a', 12], ['b', 13]]);
});
