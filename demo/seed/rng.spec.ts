import { makeFaker, probit, stratifiedLognormal } from './rng';
import { mskAt } from './time';

const now = mskAt('2026-11-04', 12);
it('same stream gives the same sequence, another stream differs', () => {
  expect(makeFaker('clients', now).string.alphanumeric(12)).toBe(makeFaker('clients', now).string.alphanumeric(12));
  expect(makeFaker('clients', now).string.alphanumeric(12)).not.toBe(makeFaker('vehicles', now).string.alphanumeric(12));
});
it('probit', () => { expect(probit(0.5)).toBeCloseTo(0, 6); expect(probit(0.975)).toBeCloseTo(1.959964, 4); });
it('stratifiedLognormal has the requested median and right skew', () => {
  const xs = stratifiedLognormal(makeFaker('t', now), 1000, 7000, 0.85).sort((a, b) => a - b);
  expect(xs).toHaveLength(1000);
  expect(Math.abs(xs[500] / 7000 - 1)).toBeLessThan(0.02);
  expect(xs.reduce((s, x) => s + x, 0) / 1000).toBeGreaterThan(xs[500] * 1.25);
});
