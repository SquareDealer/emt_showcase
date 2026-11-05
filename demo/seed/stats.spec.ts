import { buildDemoPlan } from './plan';
import { categoryShare, deseasonalizedGrowth, fullMonthsInWindow, geoMean, monthlyRevenue, paretoShare, ticketStats, TIRE_PEAK_MIN_RATIO } from './stats';
import { monthKey, mskAt } from './time';

const now = mskAt('2026-11-04', 12);
const plan = buildDemoPlan(now);
const wos = plan.workOrders;

it('20% of clients bring ~50% of orders', () => {
  const s = paretoShare(wos, 150);
  expect(s).toBeGreaterThanOrEqual(0.45);
  expect(s).toBeLessThanOrEqual(0.6);
});
it('tickets are right-skewed', () => {
  const t = ticketStats(wos.map((w) => w.total_cached));
  expect(t.median / t.mean).toBeLessThanOrEqual(0.8);
  expect(t.p90).toBeGreaterThanOrEqual(2.5 * t.median);
});
it('revenue grows 3–8% m/m net of season', () => {
  const g = deseasonalizedGrowth(monthlyRevenue(wos), fullMonthsInWindow(now));
  expect(fullMonthsInWindow(now)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  expect(geoMean(g)).toBeGreaterThanOrEqual(1.03);
  expect(geoMean(g)).toBeLessThanOrEqual(1.08);
  for (const r of g) {
    expect(r).toBeGreaterThanOrEqual(0.97);
    expect(r).toBeLessThanOrEqual(1.15);
  }
});
it('tire work peaks in October', () =>
  expect(categoryShare(wos, '2026-10', 'tires', plan.catalog)).toBeGreaterThanOrEqual(TIRE_PEAK_MIN_RATIO * categoryShare(wos, '2026-07', 'tires', plan.catalog)));
it('tyres do not take over the autumn: about half of October orders have a tyre work (the ×6 boost gave 80%)', () => {
  const tires = new Set(plan.catalog.tasks.filter((t) => t.category === 'tires').map((t) => t.id));
  const oct = wos.filter((w) => monthKey(w.scheduled_at) === '2026-10');
  const share = oct.filter((w) => w.labor.some((l) => l.template_id && tires.has(l.template_id))).length / oct.length;
  expect(share).toBeGreaterThan(0.3);
  expect(share).toBeLessThan(0.55);
});

describe('helpers', () => {
  it('monthlyRevenue sums total_frozen of closed orders by the MSK month of closed_at', () => {
    const rev = monthlyRevenue([
      { status: 'closed', closed_at: mskAt('2026-10-31', 23, 30), total_frozen: 100 }, // 20:30Z, still October in MSK
      { status: 'closed', closed_at: mskAt('2026-11-01', 0, 30), total_frozen: 50 }, // 21:30Z on Oct 31, November in MSK
      { status: 'done', closed_at: null, total_frozen: null },
    ]);
    expect([...rev.entries()]).toEqual([['2026-10', 100], ['2026-11', 50]]);
  });
  it('fullMonthsInWindow excludes the current month, also on its last day', () => {
    expect(fullMonthsInWindow(mskAt('2027-03-31', 12)).at(-1)).toBe('2027-02');
    expect(fullMonthsInWindow(mskAt('2027-03-31', 12))[0]).toBe('2026-10');
  });
  it('geoMean, ticketStats, paretoShare', () => {
    expect(geoMean([1, 4])).toBeCloseTo(2);
    expect(ticketStats([1, 2, 3, 4, 100])).toMatchObject({ median: 3, mean: 22 });
    // 10 clients → top 2; client a has 3 of 5 orders, b has 1
    expect(paretoShare(['a', 'a', 'a', 'b', 'c'].map((client_id) => ({ client_id })), 10)).toBeCloseTo(0.8);
  });
  it('deseasonalizedGrowth removes the season and calendar effects', () => {
    // revenue = season × day weights × 1.05^i → growth exactly 1.05
    const months = ['2026-09', '2026-10', '2026-11'];
    // Sep 2026: 22 weekdays + 4 Sat + 4 Sun; Oct: 22 + 5 + 4; Nov: 21 + 4 + 5 (weights 1 / 0.5 / 0.2)
    const flat = deseasonalizedGrowth(new Map([['2026-09', 24.8], ['2026-10', 1.3 * 25.3 * 1.05], ['2026-11', 1.3 * 24 * 1.05 * 1.05]]), months);
    expect(flat).toHaveLength(2);
    expect(flat[0]).toBeCloseTo(1.05, 9);
    expect(flat[1]).toBeCloseTo(1.05, 9);
  });
});
