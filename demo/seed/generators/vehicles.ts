import type { Faker } from '@faker-js/faker';
import { HISTORY_DAYS, PLATE_LETTERS, VIN_CHARS } from '../config';
import { HATCH_CODES, HATCH_MODELS, MINI_GEN_WEIGHTS, OTHER_MAKES, OTHER_MAKE_WEIGHTS, PLATE_REGIONS } from '../data/vehicles';
import { MINI_GENERATIONS } from '../data/generations';
import { HERO } from '../hero';
import { demoId } from '../ids';
import { chance, weightedIndex } from '../rng';
import { addDays, mskAt, mskDay } from '../time';
import type { ClientPlan, VehiclePlan } from '../types';

const MS_YEAR = 365 * 86_400_000;
const MS_MIN = 60_000;
/** Odometer ceiling at DEMO_NOW. */
export const MAX_KM = 300_000;

function windowStart(demoNow: Date): Date {
  return mskAt(addDays(mskDay(demoNow), -HISTORY_DAYS), 0);
}

function roundKm(km: number): number {
  return Math.max(0, Math.round(km / 10) * 10);
}

export function makeVin(f: Faker, wmi: string): string {
  let s = wmi;
  while (s.length < 17) s += VIN_CHARS[f.number.int({ min: 0, max: VIN_CHARS.length - 1 })];
  return s;
}

export function makePlate(f: Faker): string {
  const L = () => PLATE_LETTERS[f.number.int({ min: 0, max: PLATE_LETTERS.length - 1 })];
  const digits = String(f.number.int({ min: 1, max: 999 })).padStart(3, '0');
  return `${L()}${digits}${L()}${L()} ${f.helpers.arrayElement(PLATE_REGIONS)}`;
}

export function makePhone(f: Faker): string {
  const n = (min: number, max: number, w: number) => String(f.number.int({ min, max })).padStart(w, '0');
  return `+7 (555) ${n(100, 999, 3)}-${n(0, 99, 2)}-${n(0, 99, 2)}`;
}

/** Odometer at `at`: baseKm at the window start, then linear annualKm; rounded to 10 km. */
export function odometerAt(v: VehiclePlan, at: Date, demoNow: Date): number {
  const years = (at.getTime() - windowStart(demoNow).getTime()) / MS_YEAR;
  return roundKm(v.baseKm + v.annualKm * years);
}

function parseYears(years: string, demoYear: number): [number, number] {
  const [a, b] = years.split('–');
  return [Number(a), b ? Number(b) : demoYear];
}

interface Slot {
  client: ClientPlan;
  index: number;
  fixed?: { mini: boolean; code?: string; model?: string | null; year?: number; make?: string; vin?: string; plate?: string; id: string; base?: number; annual?: number };
}

function slotsFor(c: ClientPlan): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < c.vehicleCount; i++) slots.push({ client: c, index: i });
  if (c.id === HERO.client.id) {
    slots[0].fixed = {
      id: HERO.r56.vehicleId, mini: true, code: 'R56', model: HERO.r56.model, year: HERO.r56.year,
      vin: HERO.r56.vin, plate: HERO.r56.plate, base: 121400, annual: 8000,
    };
    slots[1].fixed = { id: HERO.secondVehicleId, mini: false, make: 'Toyota', model: 'RAV4', year: 2019 };
  } else if (c.id === HERO.fleetClientId) {
    ['F55', 'F55', 'F56', 'F56', 'F60', 'F60'].forEach((code, i) => {
      slots[i].fixed = { id: demoId('vehicle', `hero-fleet-${i + 1}`), mini: true, code };
    });
  } else if (c.id === HERO.bigOrder.clientId) {
    slots[0].fixed = { id: HERO.bigOrder.vehicleId, mini: true, code: 'F60', model: 'Countryman', year: 2019 };
  }
  return slots;
}

export function planVehicles(f: Faker, clients: ClientPlan[], demoNow: Date): VehiclePlan[] {
  const demoYear = Number(mskDay(demoNow).slice(0, 4));
  const slots = clients.flatMap(slotsFor);

  // Exact MINI share over the free slots (keeps ~80% overall without binomial noise).
  const free = slots.filter((s) => !s.fixed);
  const fixedMini = slots.filter((s) => s.fixed?.mini).length;
  const miniTotal = Math.round(0.8 * slots.length);
  const miniFree = Math.max(0, Math.min(free.length, miniTotal - fixedMini));
  const flags = f.helpers.shuffle([...Array(free.length)].map((_, i) => i < miniFree));
  free.forEach((s, i) => (s.fixed = { id: demoId('vehicle', `${s.client.id}:${s.index}`), mini: flags[i] }));

  const vins = new Set<string>([HERO.r56.vin]);
  const plates = new Set<string>([HERO.r56.plate]);
  const unique = (set: Set<string>, gen: () => string) => {
    for (;;) {
      const v = gen();
      if (!set.has(v)) {
        set.add(v);
        return v;
      }
    }
  };
  const genWeights = Object.keys(MINI_GEN_WEIGHTS).map((c) => MINI_GEN_WEIGHTS[c]);
  const genCodes = Object.keys(MINI_GEN_WEIGHTS);
  const wsStart = windowStart(demoNow);

  const out: VehiclePlan[] = slots.map((s) => {
    const fx = s.fixed!;
    const created = new Date(
      Math.min(s.client.created_at.getTime() + f.number.int({ min: 0, max: 10 }) * MS_MIN, demoNow.getTime() - 60 * MS_MIN),
    );
    let make: string;
    let model: string | null;
    let code: string | null = null;
    let year: number;
    let wmi: string;
    if (fx.mini) {
      make = 'MINI';
      wmi = 'WMW';
      code = fx.code ?? genCodes[weightedIndex(f, genWeights)];
      const gen = MINI_GENERATIONS.find((g) => g.code === code)!;
      const [from, to] = parseYears(gen.years, demoYear);
      year = fx.year ?? f.number.int({ min: from, max: to });
      model = fx.model !== undefined ? fx.model : HATCH_CODES.includes(code) && chance(f, 0.5) ? f.helpers.arrayElement(HATCH_MODELS) : null;
    } else if (fx.make) {
      const m = OTHER_MAKES.find((x) => x.make === fx.make)!;
      make = m.make;
      wmi = m.wmi;
      model = fx.model ?? null;
      year = fx.year!;
    } else {
      const m = OTHER_MAKES[weightedIndex(f, OTHER_MAKE_WEIGHTS)];
      make = m.make;
      wmi = m.wmi;
      model = f.helpers.arrayElement(m.models);
      year = f.number.int({ min: 2008, max: Math.min(2024, demoYear) });
    }
    const drawnKm = Math.round(Math.min(22000, Math.max(4000, Math.exp(Math.log(12000) + 0.35 * f.number.float({ min: -2, max: 2 })))) / 100) * 100;
    const ageAtStart = Math.max(0.1, (wsStart.getTime() - mskAt(`${year}-07-01`, 0).getTime()) / MS_YEAR);
    // An old car is driven less: the odometer at DEMO_NOW stays within MAX_KM.
    const ageAtNow = ageAtStart + (demoNow.getTime() - wsStart.getTime()) / MS_YEAR;
    const annualKm = fx.annual ?? Math.min(drawnKm, Math.floor(MAX_KM / ageAtNow / 100) * 100);
    const baseKm = fx.base ?? roundKm(annualKm * ageAtStart);
    const v: VehiclePlan = {
      id: fx.id,
      client_id: s.client.id,
      make,
      model,
      generationCode: code,
      vin: fx.vin ?? unique(vins, () => makeVin(f, wmi)),
      plate: fx.plate ?? unique(plates, () => makePlate(f)),
      year,
      baseKm,
      annualKm,
      mileage: 0,
      created_at: created,
    };
    v.mileage = odometerAt(v, demoNow, demoNow);
    return v;
  });
  return out;
}
