import type { Faker } from '@faker-js/faker';
import { FUTURE_DAYS, HISTORY_DAYS, MONTHLY_VOLUME_GROWTH, SEASON_FACTOR, SLOT_MIN, WEEKDAY_FACTOR, WORK_END_HOUR, WORK_START_HOUR } from '../config';
import { heroSchedule } from '../hero';
import { demoId } from '../ids';
import { weightedIndex } from '../rng';
import { addDays, daysBetween, isWorkday, mskAt, mskDay, weekdayOf } from '../time';
import type { BlockPlan, StaffPlan } from '../types';

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

export function windowStartDay(demoNow: Date): string {
  return addDays(mskDay(demoNow), -HISTORY_DAYS);
}

/** Orders per Moscow day: weekday x season x monthly growth, bookings ahead thin out. Deterministic, no rng. */
export function dailyCounts(demoNow: Date, total: number): Map<string, number> {
  const today = mskDay(demoNow);
  const start = windowStartDay(demoNow);
  const end = addDays(today, FUTURE_DAYS);
  const [sy, sm] = start.split('-').map(Number);
  const days: string[] = [];
  const weights: number[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const [y, m] = d.split('-').map(Number);
    const monthIndex = (y - sy) * 12 + (m - sm);
    let w = WEEKDAY_FACTOR[weekdayOf(d)] * (SEASON_FACTOR[m] ?? 1) * Math.pow(1 + MONTHLY_VOLUME_GROWTH, monthIndex);
    const ahead = daysBetween(today, d);
    if (ahead > 0) w *= Math.max(0.15, 1 - 0.06 * ahead);
    days.push(d);
    weights.push(w);
  }
  const scale = total / weights.reduce((s, w) => s + w, 0);
  const out = new Map<string, number>();
  let carry = 0;
  days.forEach((d, i) => {
    const v = weights[i] * scale + carry;
    // carry ∈ [-0.5, 0.5) and weights > 0, so v > -0.5: Math.round only yields -0 here, never a
    // negative integer. Normalising -0 to 0 leaves both the carry and the exact total unchanged.
    const n = Math.max(0, Math.round(v)) || 0;
    carry = v - n;
    out.set(d, n);
  });
  return out;
}

export function planBlocks(staff: StaffPlan[], demoNow: Date): BlockPlan[] {
  const { busyDay } = heroSchedule(demoNow);
  const masters = staff.filter((s) => s.role === 'master');
  let training = addDays(busyDay, 1);
  for (let n = 0; n < 2; ) {
    if (isWorkday(training)) n++;
    if (n < 2) training = addDays(training, 1);
  }
  const rows: [string, string, Date, number, string | null][] = [
    ['lift', 'Подъёмник №2 — обслуживание', mskAt(busyDay, 16), 120, null],
    ['training', 'Обучение: электрика F-серии', mskAt(training, 9), 240, masters[1]?.id ?? null],
    ['vacation', 'Отпуск', mskAt(addDays(busyDay, 7), 8), 4320, masters[2]?.id ?? null],
    ['equipment', 'Приёмка оборудования', mskAt(addDays(busyDay, -8), 8), 120, null],
  ];
  return rows.map(([key, title, starts_at, duration_min, user_id]) => ({
    id: demoId('block', key),
    title,
    starts_at,
    duration_min,
    user_id,
    notes: null,
    created_at: new Date(Math.min(starts_at.getTime() - 3 * MS_DAY, demoNow.getTime())),
  }));
}

interface Interval {
  from: number;
  to: number;
}

/** Per-master occupancy. A shared reserve (user_id null) does not block masters: one lift, the rest keep working. */
export class DayBoard {
  private readonly busy = new Map<string, Interval[]>();
  private readonly free: Interval;

  constructor(
    private readonly masters: StaffPlan[],
    blocks: BlockPlan[],
    freeSlot: { startsAt: Date; durationMin: number },
  ) {
    for (const m of masters) this.busy.set(m.id, []);
    for (const b of blocks) if (b.user_id && this.busy.has(b.user_id)) this.occupy(b.user_id, b.starts_at, b.duration_min);
    this.free = { from: freeSlot.startsAt.getTime(), to: freeSlot.startsAt.getTime() + freeSlot.durationMin * MS_MIN };
  }

  occupy(masterId: string, start: Date, durationMin: number): void {
    const list = this.busy.get(masterId);
    if (!list) throw new Error(`unknown master ${masterId}`);
    list.push({ from: start.getTime(), to: start.getTime() + durationMin * MS_MIN });
  }

  place(
    day: string,
    durationMin: number,
    opts: { masterId?: string; notBeforeMin?: number; rng?: Faker } = {},
  ): { masterId: string; start: Date } | null {
    const lo = Math.max(WORK_START_HOUR * 60, Math.ceil((opts.notBeforeMin ?? 0) / SLOT_MIN) * SLOT_MIN);
    const hi = WORK_END_HOUR * 60;
    for (const id of this.order(opts.masterId, opts.rng)) {
      const list = this.busy.get(id)!;
      for (let m = lo; m + durationMin <= hi; m += SLOT_MIN) {
        const start = mskAt(day, 0, m);
        const iv = { from: start.getTime(), to: start.getTime() + durationMin * MS_MIN };
        if (this.clash(iv, this.free) || list.some((o) => this.clash(iv, o))) continue;
        list.push(iv);
        return { masterId: id, start };
      }
    }
    return null;
  }

  private clash(a: Interval, b: Interval): boolean {
    return a.from < b.to && b.from < a.to;
  }

  private order(masterId: string | undefined, rng: Faker | undefined): string[] {
    if (masterId) return this.busy.has(masterId) ? [masterId] : [];
    const pool = [...this.masters];
    if (!rng) return pool.sort((a, b) => b.loadWeight - a.loadWeight).map((m) => m.id);
    const out: string[] = [];
    while (pool.length) {
      const i = weightedIndex(rng, pool.map((m) => m.loadWeight));
      out.push(pool.splice(i, 1)[0].id);
    }
    return out;
  }
}
