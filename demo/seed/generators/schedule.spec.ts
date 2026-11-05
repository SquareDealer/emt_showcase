import { heroSchedule } from '../hero';
import { makeFaker } from '../rng';
import { addDays, mskAt, mskDay, mskMinutes, weekdayOf } from '../time';
import { planStaff } from './people';
import { DayBoard, dailyCounts, planBlocks, windowStartDay } from './schedule';

const MS_MIN = 60_000;
function overlaps(aStart: Date, aDur: number, bStart: Date, bDur: number): boolean {
  const a0 = aStart.getTime();
  const b0 = bStart.getTime();
  return a0 < b0 + bDur * MS_MIN && b0 < a0 + aDur * MS_MIN;
}

const now = mskAt('2026-11-04', 12);
const counts = dailyCounts(now, 780);
const avg = (pred: (d: string) => boolean) => {
  const ds = [...counts.keys()].filter(pred);
  return ds.reduce((s, d) => s + counts.get(d)!, 0) / ds.length;
};
const past = (d: string) => d < '2026-11-04';
it('never emits a negative count or -0, and still sums exactly', () => {
  for (const day of ['2026-01-01', '2026-01-08', '2026-11-04', '2026-11-08', '2028-02-29']) {
    for (const total of [780, 786, 800]) {
      const c = dailyCounts(mskAt(day, 12), total);
      for (const n of c.values()) expect(n < 0 || Object.is(n, -0)).toBe(false);
      expect([...c.values()].reduce((s, n) => s + n, 0)).toBe(total);
    }
  }
});
it('sums exactly and spans the window', () => {
  expect([...counts.values()].reduce((s, n) => s + n, 0)).toBe(780);
  expect([...counts.keys()][0]).toBe(windowStartDay(now));
  expect([...counts.keys()].at(-1)).toBe('2026-11-18');
});
it('weekends are quieter', () =>
  expect(avg((d) => past(d) && [0, 6].includes(weekdayOf(d)))).toBeLessThanOrEqual(0.5 * avg((d) => past(d) && ![0, 6].includes(weekdayOf(d)))));
it('October is ~30% busier than September', () => {
  const r = avg((d) => d.startsWith('2026-10')) / avg((d) => d.startsWith('2026-09'));
  expect(r).toBeGreaterThanOrEqual(1.2);
  expect(r).toBeLessThanOrEqual(1.45);
});
it('bookings ahead thin out', () =>
  expect(avg((d) => d >= '2026-11-05' && d <= '2026-11-07')).toBeGreaterThan(avg((d) => d >= '2026-11-16')));
const staff = planStaff(makeFaker('staff', now));
const blocks = planBlocks(staff, now);
const { freeSlot } = heroSchedule(now);
it('blocks stay clear of the free slot and are valid', () => {
  for (const b of blocks) {
    expect(b.duration_min).toBeGreaterThanOrEqual(5);
    expect(b.duration_min).toBeLessThanOrEqual(43200);
    expect(overlaps(b.starts_at, b.duration_min, freeSlot.startsAt, freeSlot.durationMin)).toBe(false);
  }
  expect(blocks.some((b) => b.user_id === null && mskDay(b.starts_at) === '2026-11-04')).toBe(true);
});
it('DayBoard never double-books a master, never touches the free slot, respects personal blocks', () => {
  const board = new DayBoard(staff.filter((s) => s.role === 'master'), blocks, freeSlot);
  const placed: { masterId: string; start: Date; dur: number }[] = [];
  for (let i = 0; i < 400; i++) {
    const day = addDays('2026-11-02', i % 14);
    const dur = 30 * (1 + (i % 8));
    const p = board.place(day, dur);
    if (p) placed.push({ ...p, dur });
  }
  for (const a of placed) {
    expect(mskMinutes(a.start)).toBeGreaterThanOrEqual(8 * 60);
    expect(mskMinutes(a.start) + a.dur).toBeLessThanOrEqual(20 * 60);
    expect(overlaps(a.start, a.dur, freeSlot.startsAt, 120)).toBe(false);
    for (const b of placed) if (a !== b && a.masterId === b.masterId) expect(overlaps(a.start, a.dur, b.start, b.dur)).toBe(false);
    for (const bl of blocks) if (bl.user_id === a.masterId) expect(overlaps(a.start, a.dur, bl.starts_at, bl.duration_min)).toBe(false);
  }
  expect(board.place('2026-11-03', 13 * 60)).toBeNull();
});
