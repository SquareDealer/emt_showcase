import { REGULAR_SHARE, SEASON_FACTOR, WEEKDAY_FACTOR } from './config';
import { windowStartDay } from './generators/schedule';
import { addDays, monthKey, mskDay, weekdayOf } from './time';
import type { CatalogPlan, TaskCategory, WorkOrderPlan } from './types';

/** Revenue (total_frozen of closed orders) by the Moscow month of closed_at, months in ascending order. */
export function monthlyRevenue(orders: Pick<WorkOrderPlan, 'status' | 'closed_at' | 'total_frozen'>[]): Map<string, number> {
  const by = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== 'closed' || !o.closed_at) continue;
    const m = monthKey(o.closed_at);
    by.set(m, (by.get(m) ?? 0) + (o.total_frozen ?? 0));
  }
  return new Map([...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

const nextMonth = (m: string): string => {
  const [y, mm] = m.split('-').map(Number);
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
};

/** Calendar months lying entirely inside [window start, DEMO_NOW): today's month is never full. */
export function fullMonthsInWindow(demoNow: Date): string[] {
  const start = windowStartDay(demoNow);
  const today = mskDay(demoNow);
  const out: string[] = [];
  for (let m = start.endsWith('-01') ? start.slice(0, 7) : nextMonth(start.slice(0, 7)); `${nextMonth(m)}-01` <= today; m = nextMonth(m)) {
    out.push(m);
  }
  return out;
}

/** Σ weekday factors × season factor of a month: the volume a flat business would see in it. */
function seasonalWeight(month: string): number {
  let w = 0;
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) w += WEEKDAY_FACTOR[weekdayOf(d)];
  return w * (SEASON_FACTOR[Number(month.slice(5, 7))] ?? 1);
}

/** Month-over-month revenue ratios net of season and calendar (number of weekdays/weekends). */
export function deseasonalizedGrowth(rev: Map<string, number>, months: string[]): number[] {
  const adj = months.map((m) => (rev.get(m) ?? 0) / seasonalWeight(m));
  return adj.slice(1).map((v, i) => v / adj[i]);
}

export function geoMean(xs: number[]): number {
  return Math.exp(xs.reduce((s, x) => s + Math.log(x), 0) / xs.length);
}

/** Share of orders brought by the top REGULAR_SHARE (20%) of all clients, clients without orders included. */
export function paretoShare(orders: { client_id: string }[], clientsTotal: number): number {
  const by = new Map<string, number>();
  for (const o of orders) by.set(o.client_id, (by.get(o.client_id) ?? 0) + 1);
  const top = [...by.values()].sort((a, b) => b - a).slice(0, Math.round(clientsTotal * REGULAR_SHARE));
  return top.reduce((s, n) => s + n, 0) / orders.length;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function ticketStats(totals: number[]): { median: number; mean: number; p90: number } {
  const s = [...totals].sort((a, b) => a - b);
  return { median: quantile(s, 0.5), mean: s.reduce((a, b) => a + b, 0) / s.length, p90: quantile(s, 0.9) };
}

/**
 * October's tyre share of labor lines over July's. Over the 60-date sweep it is 2.5–6.2 (median 3.5)
 * with the ×1.5 autumn boost; the former 3× sat just under the minimum of the old ×6 boost (3.5).
 */
export const TIRE_PEAK_MIN_RATIO = 2;

/** Share of catalog labor lines of one category among the catalog labor lines of orders scheduled in `month` (MSK). */
export function categoryShare(orders: WorkOrderPlan[], month: string, category: TaskCategory, catalog: CatalogPlan): number {
  const cat = new Map(catalog.tasks.map((t) => [t.id, t.category]));
  const lines = orders.filter((o) => monthKey(o.scheduled_at) === month).flatMap((o) => o.labor.filter((l) => l.template_id && cat.has(l.template_id)));
  if (!lines.length) return 0;
  return lines.filter((l) => cat.get(l.template_id as string) === category).length / lines.length;
}
