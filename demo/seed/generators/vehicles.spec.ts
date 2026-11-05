import { HERO } from '../hero';
import { MINI_GENERATIONS } from '../data/generations';
import { makeFaker } from '../rng';
import { mskAt, mskDay } from '../time';
import { planClients } from './people';
import { MAX_KM, odometerAt, planVehicles } from './vehicles';

const now = mskAt('2026-11-04', 12);
const clients = planClients(makeFaker('clients', now), now);
const vehicles = planVehicles(makeFaker('vehicles', now), clients, now);

it('~200 vehicles, ~80% MINI', () => {
  expect(vehicles.length).toBeGreaterThanOrEqual(185);
  expect(vehicles.length).toBeLessThanOrEqual(215);
  const mini = vehicles.filter((v) => v.make === 'MINI').length / vehicles.length;
  expect(mini).toBeGreaterThanOrEqual(0.77);
  expect(mini).toBeLessThanOrEqual(0.83);
});

it('VIN: 17 chars, no I/O/Q, WMW for MINI, unique', () => {
  expect(vehicles.every((v) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v.vin))).toBe(true);
  expect(vehicles.filter((v) => v.make === 'MINI').every((v) => v.vin.startsWith('WMW'))).toBe(true);
  expect(new Set(vehicles.map((v) => v.vin)).size).toBe(vehicles.length);
});

it('plates use only АВЕКМНОРСТУХ and are unique', () => {
  expect(vehicles.every((v) => /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2} \d{2,3}$/.test(v.plate) && !/^.000/.test(v.plate))).toBe(true);
  expect(new Set(vehicles.map((v) => v.plate)).size).toBe(vehicles.length);
});

it('MINI years fall inside the generation range; others 2008–2024', () => {
  for (const v of vehicles) {
    if (v.make === 'MINI') {
      const gen = MINI_GENERATIONS.find((g) => g.code === v.generationCode)!;
      const [a, b] = gen.years.split('–');
      expect(v.year).toBeGreaterThanOrEqual(Number(a));
      expect(v.year).toBeLessThanOrEqual(b ? Number(b) : Number(mskDay(now).slice(0, 4)));
    } else {
      expect(v.generationCode).toBeNull();
      expect(v.model).not.toBeNull();
      expect(v.year).toBeGreaterThanOrEqual(2008);
      expect(v.year).toBeLessThanOrEqual(2024);
    }
  }
});

it('hero cars', () => {
  expect(vehicles.find((v) => v.id === HERO.r56.vehicleId)).toMatchObject({
    client_id: HERO.client.id, generationCode: 'R56', vin: HERO.r56.vin, plate: HERO.r56.plate, model: 'Cooper S', year: 2011,
  });
  expect(vehicles.find((v) => v.id === HERO.secondVehicleId)).toMatchObject({ client_id: HERO.client.id, make: 'Toyota', model: 'RAV4', year: 2019 });
  expect(vehicles.filter((v) => v.client_id === HERO.client.id)).toHaveLength(2);
  const fleet = vehicles.filter((v) => v.client_id === HERO.fleetClientId);
  expect(fleet).toHaveLength(6);
  expect(fleet.every((v) => v.make === 'MINI')).toBe(true);
  expect(fleet.map((v) => v.generationCode).sort()).toEqual(['F55', 'F55', 'F56', 'F56', 'F60', 'F60']);
  expect(vehicles.find((v) => v.id === HERO.bigOrder.vehicleId)).toMatchObject({
    generationCode: 'F60', client_id: HERO.bigOrder.clientId, model: 'Countryman', year: 2019,
  });
});

it('hatch generations get an explicit model about half of the time', () => {
  const hatch = vehicles.filter((v) => v.make === 'MINI' && ['R50', 'R53', 'R56', 'F56', 'F55'].includes(v.generationCode!));
  const share = hatch.filter((v) => v.model !== null).length / hatch.length;
  expect(share).toBeGreaterThan(0.3);
  expect(share).toBeLessThan(0.75);
});

it('companies own 2–6 cars; every client owns ≥ 1', () => {
  for (const c of clients) {
    const n = vehicles.filter((v) => v.client_id === c.id).length;
    expect(n).toBe(c.vehicleCount);
    expect(n).toBeGreaterThanOrEqual(c.kind === 'company' ? 2 : 1);
    if (c.kind === 'company') expect(n).toBeLessThanOrEqual(6);
  }
});

it('vehicle is created after its client and mileage is plausible', () => {
  const byId = new Map(clients.map((c) => [c.id, c]));
  for (const v of vehicles) {
    const dt = v.created_at.getTime() - byId.get(v.client_id)!.created_at.getTime();
    expect(dt).toBeGreaterThanOrEqual(0);
    expect(v.created_at <= now).toBe(true);
    expect(v.mileage).toBe(odometerAt(v, now, now));
    expect(v.mileage / Math.max(1, Number(mskDay(now).slice(0, 4)) - v.year + 1)).toBeLessThanOrEqual(40000);
    expect(v.mileage).toBeLessThanOrEqual(MAX_KM);
  }
});

it('is deterministic', () => expect(planVehicles(makeFaker('vehicles', now), clients, now)).toEqual(vehicles));
