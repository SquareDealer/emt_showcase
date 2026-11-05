import { basename } from 'path';
import { HERO, heroSchedule } from './hero';
import { demoId } from './ids';
import { mskAt } from './time';
import { importClosure } from './test-utils/import-closure';

it('hero.ts is importable without faker, nest, typeorm, src/ or Node built-ins (the Remotion bundle is webpack 5)', () => {
  const closure = importClosure(require.resolve('./hero'));
  expect(closure.filter((d) => /[\\/]src[\\/]|^typeorm|^@nestjs|^@faker-js/.test(d))).toEqual([]);
  // only demo/seed/{hero,time,config}.ts, no bare specifier at all (crypto, fs, path…)
  expect(closure.every((d) => d.startsWith('/') || /^[A-Za-z]:[\\/]/.test(d))).toBe(true);
  expect(closure.map((d) => basename(d)).filter((n) => !['hero.ts', 'time.ts', 'config.ts'].includes(n))).toEqual([]);
});

it('HERO id literals equal demoId(scope, key)', () => {
  expect({
    client: HERO.client.id,
    r56: HERO.r56.vehicleId,
    rav4: HERO.secondVehicleId,
    diagnostics: HERO.diagnosticsOrderId,
    big: HERO.bigOrder.id,
    f60: HERO.bigOrder.vehicleId,
    f60Owner: HERO.bigOrder.clientId,
    fleet: HERO.fleetClientId,
    pdf: HERO.pdfOrderId,
    master: HERO.masterId,
    timingChain: HERO.templates.timingChain,
    engineDiagnostics: HERO.templates.engineDiagnostics,
    oil5w30: HERO.parts.oil5w30,
    chainKit: HERO.parts.chainKit,
    tensioner: HERO.parts.tensioner,
    tensionerR56: HERO.parts.tensionerR56,
  }).toEqual({
    client: demoId('client', 'hero'),
    r56: demoId('vehicle', 'hero-r56'),
    rav4: demoId('vehicle', 'hero-rav4'),
    diagnostics: demoId('wo', 'hero-diagnostics'),
    big: demoId('wo', 'hero-big'),
    f60: demoId('vehicle', 'hero-f60'),
    f60Owner: demoId('client', 'hero-f60'),
    fleet: demoId('client', 'hero-fleet'),
    pdf: demoId('wo', 'hero-pdf'),
    master: demoId('user', 'master1'),
    timingChain: demoId('task', 'timing-chain-n14'),
    engineDiagnostics: demoId('task', 'engine-diagnostics'),
    oil5w30: demoId('part', 'oil-5w30-1l'),
    chainKit: demoId('part', 'chain-kit-n14'),
    tensioner: demoId('part', 'chain-tensioner'),
    tensionerR56: demoId('part', 'chain-tensioner-r56'),
  });
});

it('free slot is the next weekday after DEMO_NOW at 14:00 MSK', () => {
  expect(heroSchedule(mskAt('2026-11-04', 12))).toEqual({
    busyDay: '2026-11-04',
    freeSlot: { startsAt: mskAt('2026-11-05', 14), durationMin: 120 },
  });
  expect(heroSchedule(mskAt('2026-11-06', 12)).freeSlot.startsAt).toEqual(mskAt('2026-11-09', 14));
  expect(heroSchedule(mskAt('2026-11-08', 12)).freeSlot.startsAt).toEqual(mskAt('2026-11-09', 14));
});

it('HERO ids are valid and distinct', () => {
  const ids = [
    HERO.client.id, HERO.r56.vehicleId, HERO.secondVehicleId, HERO.diagnosticsOrderId, HERO.bigOrder.id,
    HERO.bigOrder.vehicleId, HERO.bigOrder.clientId, HERO.fleetClientId, HERO.pdfOrderId, HERO.masterId,
  ];
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((i) => /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(i))).toBe(true);
});
