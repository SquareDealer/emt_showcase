import { PriceResolutionService } from '../../../src/task-templates/price-resolution.service';
import { PricingService } from '../../../src/work-orders/pricing.service';
import { HERO } from '../hero';
import { demoId } from '../ids';
import { mskAt } from '../time';
import { planCatalog } from './catalog';
import { buildOrderLines } from './lines';

const cat = planCatalog();
const resolution = new PriceResolutionService();
const pricing = new PricingService();
const at = mskAt('2026-11-04', 10);
const r56 = buildOrderLines({ woId: 'wo-1', works: [{ taskKey: 'timing-chain-n14' }], generation: 'R56', catalog: cat, rate: 2200, createdAt: at, resolution });

it('R56 timing chain uses the generation price and the R56 tensioner', () => {
  expect(r56.labor).toEqual([expect.objectContaining({ template_id: HERO.templates.timingChain, hours: 7, price_override: 18500, rate_snapshot: 2200, group_sort: 1, sort: 0 })]);
  expect(r56.parts.map((p) => p.part_template_id)).toContain(HERO.parts.tensionerR56);
  expect(r56.parts.find((p) => p.part_template_id === HERO.parts.oil5w30)).toMatchObject({ qty: 4.5, unit: 'l', unit_price: 1200 });
  expect(pricing.computeTotal(r56.labor, r56.parts, null, null)).toBe(47600);
});

it('R55 falls back to base hours × rate and the universal tensioner', () => {
  const r55 = buildOrderLines({ woId: 'wo-2', works: [{ taskKey: 'timing-chain-n14' }], generation: 'R55', catalog: cat, rate: 2200, createdAt: at, resolution });
  expect(r55.labor[0]).toMatchObject({ hours: 6, price_override: null, rate_snapshot: 2200 });
  expect(pricing.computeTotal(r55.labor, r55.parts, null, null)).toBe(40900);
});

it('each work is one block with a deterministic key; sorts are sequential', () => {
  const two = buildOrderLines({ woId: 'wo-3', works: [{ taskKey: 'oil-change' }, { taskKey: 'spark-plugs', laborDiscountPct: 10 }], free: [{ name: 'Мойка двигателя', hours: 0.5 }], generation: 'F56', catalog: cat, rate: 2000, createdAt: at, resolution });
  expect(two.labor.map((l) => [l.group_key, l.group_sort, l.sort])).toEqual([[demoId('group', 'wo-3:1'), 1, 0], [demoId('group', 'wo-3:2'), 2, 1], [null, 0, 2]]);
  expect(two.labor[1]).toMatchObject({ discount_type: 'percent', discount_value: 10 });
  expect(two.parts.map((p) => p.sort)).toEqual(two.parts.map((_, i) => i));
  expect(new Set(two.parts.map((p) => p.group_key))).toEqual(new Set([demoId('group', 'wo-3:1'), demoId('group', 'wo-3:2')]));
});

it('no numeric field is undefined', () => {
  for (const l of r56.labor) expect(typeof l.rate_snapshot).toBe('number');
  for (const p of r56.parts) { expect(typeof p.qty).toBe('number'); expect(typeof p.unit_price).toBe('number'); }
});
