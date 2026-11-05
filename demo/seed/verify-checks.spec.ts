import { readFileSync } from 'fs';
import { OCCUPIED_SLOT_SQL, checkClosedTotals, checkDates, checkDocNumbers, diffPartSets, formatDistribution } from './verify-checks';

it('doc numbers must be contiguous and follow closed_at', () => {
  const c = (n: number, t: number) => ({ status: 'closed', doc_number: n, closed_at: new Date(t) });
  expect(checkDocNumbers([c(1, 1), c(2, 2), c(3, 3)])).toEqual([]);
  expect(checkDocNumbers([c(1, 1), c(3, 2)])).toHaveLength(1);
  expect(checkDocNumbers([c(2, 1), c(1, 2)])).toHaveLength(1);
  expect(checkDocNumbers([{ status: 'done', doc_number: 4, closed_at: null }])).toHaveLength(1);
});
it('doc numbers: ties on closed_at are broken by id, like the seed', () => {
  const t = new Date(5);
  expect(checkDocNumbers([{ id: 'b', status: 'closed', doc_number: 2, closed_at: t }, { id: 'a', status: 'closed', doc_number: 1, closed_at: t }])).toEqual([]);
  expect(checkDocNumbers([{ id: 'b', status: 'closed', doc_number: 1, closed_at: t }, { id: 'a', status: 'closed', doc_number: 2, closed_at: t }])).toHaveLength(1);
});
it('closed totals are frozen and paid', () => {
  expect(checkClosedTotals([{ status: 'closed', total_cached: 100, total_frozen: 100, paid_amount: 100, closed_at: new Date() }])).toEqual([]);
  expect(checkClosedTotals([{ status: 'closed', total_cached: 100, total_frozen: 99, paid_amount: 100, closed_at: new Date() }])).toHaveLength(1);
  expect(checkClosedTotals([{ status: 'waiting', total_cached: 100, total_frozen: 100, paid_amount: 0, closed_at: null }])).toHaveLength(1);
});
it('dates: closed before updated, nothing after DEMO_NOW', () => {
  const now = new Date('2026-11-04T09:00:00Z');
  const d = (iso: string) => new Date(`2026-11-${iso}Z`);
  const ok = { status: 'closed', created_at: d('01T08:00:00'), scheduled_at: d('02T08:00:00'), closed_at: d('02T12:00:00'), updated_at: d('02T12:00:00') };
  const open = { status: 'scheduled', created_at: d('01T08:00:00'), scheduled_at: d('10T08:00:00'), closed_at: null, updated_at: d('01T08:00:00') };
  expect(checkDates([ok, open], now)).toEqual([]);
  // one violation per rule → one error each
  expect(checkDates([{ ...ok, created_at: d('02T09:00:00') }], now)).toHaveLength(1); // created after scheduled
  expect(checkDates([{ ...open, updated_at: d('01T07:00:00') }], now)).toHaveLength(1); // updated before created
  expect(checkDates([{ ...open, updated_at: d('04T09:00:01') }], now)).toHaveLength(1); // updated after DEMO_NOW
  expect(checkDates([{ ...ok, closed_at: null }], now)).toHaveLength(1); // closed without closed_at
  expect(checkDates([{ ...ok, closed_at: d('02T07:00:00') }], now)).toHaveLength(1); // closed before scheduled
  expect(checkDates([{ ...ok, closed_at: d('02T13:00:00') }], now)).toHaveLength(1); // closed after updated
});
it('part sets compare as sets and report the difference', () => {
  const a = { part_template_id: 'p1', qty: 1, is_default: true }; const b = { part_template_id: 'p2', qty: 4.5, is_default: true };
  expect(diffPartSets([a, b], [b, a])).toBeNull();
  expect(diffPartSets([a, b], [a])).toContain('p2');
  expect(diffPartSets([a], [{ ...a, qty: 2 }])).toContain('qty');
});
it('part sets: is_default and extra parts are reported too', () => {
  const a = { part_template_id: 'p1', qty: 1, is_default: true };
  expect(diffPartSets([a], [{ ...a, is_default: false }])).toContain('is_default');
  expect(diffPartSets([a], [a, { part_template_id: 'p9', qty: 1, is_default: false }])).toContain('p9');
});
it('distribution table lists every status and month', () =>
  expect(formatDistribution({ closed: 700, scheduled: 40 }, [{ month: '2026-10', orders: 160, revenue: 1_500_000 }])).toMatch(/closed\s+700[\s\S]*2026-10\s+160/));
it('distribution table shows statuses that have no orders', () =>
  expect(formatDistribution({ closed: 1 }, [])).toMatch(/waiting\s+0/));

// Like demo-seed.ts: src/ (and dotenv with it) must not load before the guards have passed.
it('verify.ts imports only ./guards statically', () => {
  const src = readFileSync(require.resolve('./verify'), 'utf8');
  const statics = [...src.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  expect(statics).toEqual(['./guards']);
  expect(src).toMatch(/await import\('\.\/verify-checks'\)/);
});

it('free-slot query: order without a duration occupies default_appointment_min, not an empty range', () => {
  expect(OCCUPIED_SLOT_SQL).toMatch(/coalesce\(scheduled_duration_min,\s*\(SELECT value::int FROM settings WHERE key = 'default_appointment_min'/);
  expect(OCCUPIED_SLOT_SQL).not.toMatch(/coalesce\(scheduled_duration_min, 0\)/);
});
