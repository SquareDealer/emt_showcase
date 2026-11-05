import { demoId } from '../ids';
import { MINI_GENERATIONS } from '../data/generations';
import type { CatalogPlan, TaskCategory } from '../types';
import { overrideFor, partByKey, planCatalog, resolveTemplatePartsPlan, taskByKey } from './catalog';

const cat = planCatalog();

describe('catalog', () => {
  it('has the volumes from the spec', () => {
    expect(cat.tasks.length).toBeGreaterThanOrEqual(55);
    expect(cat.tasks.length).toBeLessThanOrEqual(65);
    expect(cat.parts.length).toBeGreaterThanOrEqual(140);
    expect(cat.parts.length).toBeLessThanOrEqual(160);
    expect(cat.links.length).toBeGreaterThanOrEqual(150);
    expect(cat.links.length).toBeLessThanOrEqual(210);
  });

  it('every part has a positive price and a unique catalog number and key', () => {
    expect(cat.parts.every((p) => p.default_price > 0)).toBe(true);
    expect(new Set(cat.parts.map((p) => p.catalog_number)).size).toBe(cat.parts.length);
    expect(new Set(cat.parts.map((p) => p.key)).size).toBe(cat.parts.length);
    expect(new Set(cat.tasks.map((t) => t.key)).size).toBe(cat.tasks.length);
  });

  it('ids are demoId of the key', () =>
    expect(taskByKey(cat, 'timing-chain-n14').id).toBe(demoId('task', 'timing-chain-n14')));

  it('has at least 3 works in every category', () => {
    const cats: TaskCategory[] = ['maintenance', 'oil', 'brakes', 'diagnostics', 'tires', 'suspension', 'timing', 'clutch', 'cooling', 'electrical', 'other'];
    for (const c of cats) expect(cat.tasks.filter((t) => t.category === c).length).toBeGreaterThanOrEqual(3);
  });

  it('has 8-10 perGeneration works and 5+ generation links, one without slot', () => {
    const n = cat.tasks.filter((t) => t.perGeneration).length;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(10);
    const gen = cat.links.filter((l) => l.generation);
    expect(gen.length).toBeGreaterThanOrEqual(5);
    expect(gen.every((l) => ['R56', 'F56', 'F60', 'F55', 'R60'].includes(l.generation!))).toBe(true);
    expect(gen.some((l) => l.slot === null)).toBe(true);
  });

  it('has the hero works', () => {
    expect(taskByKey(cat, 'timing-chain-n14')).toMatchObject({ name: 'Замена цепи ГРМ (R56/N14)', default_hours: 6, default_price: null });
    expect(taskByKey(cat, 'timing-chain-n14').perGeneration).toBeFalsy();
    expect(taskByKey(cat, 'engine-diagnostics')).toMatchObject({ name: 'Диагностика двигателя', default_hours: 1, default_price: null });
    for (const k of ['service-regular', 'brake-pads-front', 'brake-discs-front', 'stab-links-front', 'oil-change', 'spark-plugs']) taskByKey(cat, k);
    for (const k of ['tire-change', 'wheel-balance', 'tire-storage']) expect(taskByKey(cat, k).category).toBe('tires');
  });

  it('has the hero parts', () => {
    expect(partByKey(cat, 'chain-kit-n14')).toMatchObject({ name: 'Комплект цепи ГРМ N14', manufacturer: 'INA', default_price: 14900 });
    expect(partByKey(cat, 'chain-tensioner')).toMatchObject({ manufacturer: 'INA', default_price: 4200 });
    expect(partByKey(cat, 'chain-tensioner-r56')).toMatchObject({ name: 'Натяжитель цепи ГРМ, усиленный', default_price: 5600 });
    expect(partByKey(cat, 'valve-cover-gasket-n14')).toMatchObject({ manufacturer: 'Elring', default_price: 2300 });
    expect(partByKey(cat, 'crank-seal-front')).toMatchObject({ name: 'Сальник коленвала передний', default_price: 900 });
    expect(partByKey(cat, 'oil-5w30-1l')).toMatchObject({ name: 'Масло моторное 5W-30, 1 л', manufacturer: 'Liqui Moly', unit: 'l', default_price: 1200 });
  });

  it('prices the timing chain separately for R56 only', () => {
    expect(overrideFor(cat, 'timing-chain-n14', 'R56')).toMatchObject({ hours: 7, price: 18500 });
    expect(overrideFor(cat, 'timing-chain-n14', 'R55')).toBeNull();
  });

  it('derives rule overrides for every perGeneration work', () => {
    for (const t of cat.tasks.filter((x) => x.perGeneration))
      for (const g of ['R56', 'R55', 'R60', 'F56', 'F55', 'F60']) expect(overrideFor(cat, t.key, g)).not.toBeNull();
    const pads = taskByKey(cat, 'brake-pads-front');
    expect(overrideFor(cat, 'brake-pads-front', 'F60')).toMatchObject({ hours: Math.round(pads.default_hours! * 12) / 10, price: null });
    expect(new Set(cat.overrides.map((o) => o.id)).size).toBe(cat.overrides.length);
  });

  it('links reference known tasks, parts and generation codes, with no slot collisions', () => {
    const codes = new Set(MINI_GENERATIONS.map((g) => g.code));
    const seen = new Set<string>();
    for (const l of cat.links) {
      taskByKey(cat, l.task);
      partByKey(cat, l.part);
      if (l.generation) expect(codes.has(l.generation)).toBe(true);
      const k = `${l.task}|${l.generation ?? '*'}|${l.slot?.trim().toLowerCase() || 'part:' + l.part}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    expect(new Set(cat.links.map((l) => l.id)).size).toBe(cat.links.length);
  });

  it('a generation row never turns a default into a non-default', () => {
    const key = (l: { slot: string | null; part: string }) => l.slot?.trim().toLowerCase() || `part:${l.part}`;
    const bad = cat.links
      .filter((g) => g.generation && !g.is_default)
      .filter((g) => cat.links.some((u) => u.task === g.task && u.generation === null && u.is_default && key(u) === key(g)))
      .map((g) => `${g.task}:${g.part}:${g.generation}`);
    expect(bad).toEqual([]);
  });

  it('refrigerant is counted in pieces of 100 g', () => expect(partByKey(cat, 'refrigerant-r134a').unit).toBe('pcs'));

  it('R56 swaps the tensioner by slot and keeps the rest', () => {
    const keys = (g: string | null) => resolveTemplatePartsPlan(cat, 'timing-chain-n14', g).map((c) => c.part.key).sort();
    expect(keys('R56')).toEqual(['chain-kit-n14', 'chain-tensioner-r56', 'crank-seal-front', 'oil-5w30-1l', 'valve-cover-gasket-n14']);
    expect(keys('R55')).toEqual(['chain-kit-n14', 'chain-tensioner', 'crank-seal-front', 'oil-5w30-1l', 'valve-cover-gasket-n14']);
    expect(keys(null)).toEqual(keys('R55'));
    const oil = resolveTemplatePartsPlan(cat, 'timing-chain-n14', 'R56').find((c) => c.part.key === 'oil-5w30-1l')!;
    expect(oil).toMatchObject({ qty: 4.5, is_default: true, generation_specific: false });
    const t = resolveTemplatePartsPlan(cat, 'timing-chain-n14', 'R56').find((c) => c.part.key === 'chain-tensioner-r56')!;
    expect(t.generation_specific).toBe(true);
  });

  it('an unslotted generation row replaces only the same part', () => {
    const part = (key: string) => ({ id: key, key, name: key, manufacturer: 'm', catalog_number: key, unit: 'pcs' as const, default_price: 1 });
    const link = (part: string, generation: string | null, slot: string | null, qty: number | null) => ({ id: `${part}${generation}`, task: 't', part, generation, qty, is_default: true, slot });
    const mini: CatalogPlan = {
      tasks: [],
      parts: [part('a'), part('b')],
      links: [link('a', null, null, null), link('b', null, 'x', null), link('a', 'R56', null, 2)],
      overrides: [],
    };
    expect(resolveTemplatePartsPlan(mini, 't', 'R56').map((c) => [c.part.key, c.qty])).toEqual([['a', 2], ['b', 1]]);
  });

  it('is deterministic', () => expect(JSON.stringify(planCatalog())).toBe(JSON.stringify(planCatalog())));

  it('MINI_GENERATIONS mirrors the migration (19 codes)', () =>
    expect(MINI_GENERATIONS.map((g) => g.code)).toEqual(['R50','R53','R52','R56','R55','R57','R60','R58','R59','R61','F56','F55','F54','F57','F60','J01','U25','F66','F65']));
});
