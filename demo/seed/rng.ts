import { Faker, base, en, ru } from '@faker-js/faker';
import { DEMO_SEED } from './config';

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** One independent stream per generator: editing one does not shift the others. */
export function makeFaker(stream: string, demoNow: Date): Faker {
  const f = new Faker({ locale: [ru, en, base] });
  f.seed([DEMO_SEED, fnv1a32(stream)]);
  f.setDefaultRefDate(demoNow);
  return f;
}

/** Inverse normal CDF, Acklam's rational approximation. */
export function probit(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pLow) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** n lognormal values via stratified quantiles (low variance), shuffled. */
export function stratifiedLognormal(f: Faker, n: number, median: number, sigma: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const q = (i + f.number.float()) / n;
    out.push(Math.exp(Math.log(median) + sigma * probit(q)));
  }
  return f.helpers.shuffle(out);
}

export function weightedIndex(f: Faker, weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = f.number.float({ min: 0, max: total });
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x < 0) return i;
  }
  return weights.length - 1;
}

export function chance(f: Faker, p: number): boolean {
  return f.number.float() < p;
}
