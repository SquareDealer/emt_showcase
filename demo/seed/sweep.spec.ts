import { HERO, heroSchedule } from './hero';
import { buildDemoPlan } from './plan';
import { deseasonalizedGrowth, fullMonthsInWindow, geoMean, monthlyRevenue } from './stats';
import { planViolations } from './test-utils/plan-checks';
import { addDays, mskAt, mskDay } from './time';

/**
 * Every invariant over 60 consecutive `--now` dates (each weekday, month end, the turn of a month)
 * plus a leap day. Growth is asserted only from the 5th of the month on: in the first days the
 * month just ended still has unpaid recent orders (status table), so its closed_at revenue is low.
 */
const days = [...Array(60)].map((_, i) => addDays('2026-11-01', i)).concat(['2028-02-29']);

it.each(days)('--now=%s', (day) => {
  const now = mskAt(day, 12);
  const p = buildDemoPlan(now);
  expect(planViolations(p)).toEqual([]);
  const { busyDay, freeSlot } = heroSchedule(now);
  expect(p.workOrders.filter((w) => mskDay(w.scheduled_at) === busyDay).length).toBeGreaterThanOrEqual(9);
  expect(p.workOrders.filter((w) => mskDay(w.scheduled_at) === mskDay(freeSlot.startsAt)).length).toBeGreaterThanOrEqual(4);
  expect(p.workOrders.some((w) => w.status === 'waiting')).toBe(true);
  expect(p.workOrders.filter((w) => w.vehicle_id === HERO.bigOrder.vehicleId).length).toBeLessThanOrEqual(6);
  if (Number(day.slice(8, 10)) >= 5) {
    const g = deseasonalizedGrowth(monthlyRevenue(p.workOrders), fullMonthsInWindow(now));
    expect(geoMean(g)).toBeGreaterThanOrEqual(1.03);
    expect(geoMean(g)).toBeLessThanOrEqual(1.08);
    for (const r of g) {
      expect(r).toBeGreaterThanOrEqual(0.97);
      expect(r).toBeLessThanOrEqual(1.15);
    }
  }
});
