import { HERO, heroSchedule } from './hero';
import { mskAt } from './time';
import { importClosure } from './test-utils/import-closure';

it('hero.ts is importable without faker, nest, typeorm or src/', () => {
  expect(importClosure(require.resolve('./hero')).filter((d) => /[\\/]src[\\/]|^typeorm|^@nestjs|^@faker-js/.test(d))).toEqual([]);
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
