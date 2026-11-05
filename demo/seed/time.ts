// Moscow is a fixed UTC+03:00 (no DST since 2014). Only UTC Date methods are used,
// so the host time zone never matters.
const MSK_OFFSET_MIN = 180;
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

function parseDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmtDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function shifted(d: Date): Date {
  return new Date(d.getTime() + MSK_OFFSET_MIN * MS_MIN);
}

export function mskAt(day: string, hh: number, mm = 0): Date {
  return new Date(parseDay(day) + (hh * 60 + mm - MSK_OFFSET_MIN) * MS_MIN);
}

export function mskDay(d: Date): string {
  return fmtDay(shifted(d).getTime());
}

export function mskMinutes(d: Date): number {
  const s = shifted(d);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
}

export function addDays(day: string, n: number): string {
  return fmtDay(parseDay(day) + n * MS_DAY);
}

export function weekdayOf(day: string): number {
  return new Date(parseDay(day)).getUTCDay();
}

export function isWorkday(day: string): boolean {
  const w = weekdayOf(day);
  return w >= 1 && w <= 5;
}

export function monthKey(d: Date | string): string {
  const day = typeof d === 'string' ? d : mskDay(d);
  return day.slice(0, 7);
}

export function subMonthsDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const idx = y * 12 + (m - 1) - n;
  const ty = Math.floor(idx / 12);
  const tm = idx % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fmtDay(Date.UTC(ty, tm, Math.min(d, last)));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / MS_DAY);
}

export function todayMsk(now: Date): string {
  return mskDay(now);
}
