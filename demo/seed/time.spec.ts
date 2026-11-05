import { addDays, mskAt, mskDay, subMonthsDay, todayMsk, weekdayOf } from './time';

it('mskAt is Moscow wall time', () => expect(mskAt('2026-11-04', 12).toISOString()).toBe('2026-11-04T09:00:00.000Z'));
it('mskDay reads the Moscow day', () => expect(mskDay(new Date('2026-11-04T21:30:00Z'))).toBe('2026-11-05'));
it('weekdayOf', () => expect(weekdayOf('2026-11-04')).toBe(3));
it('subMonthsDay clamps to month end', () => {
  expect(subMonthsDay('2027-05-31', 3)).toBe('2027-02-28');
  expect(subMonthsDay('2026-11-04', 3)).toBe('2026-08-04');
});
it('addDays crosses months and leap day', () => {
  expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
});
it('todayMsk', () => expect(todayMsk(new Date('2026-11-04T22:30:00Z'))).toBe('2026-11-05'));
