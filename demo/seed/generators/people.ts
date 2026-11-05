import type { Faker } from '@faker-js/faker';
import { CLIENTS_TOTAL, COMPANIES_TOTAL, HISTORY_DAYS, REGULAR_SHARE, TICKET_MEDIAN } from '../config';
import { CLIENT_NOTES } from '../data/vehicles';
import { HERO } from '../hero';
import { demoId } from '../ids';
import { chance, stratifiedLognormal, weightedIndex } from '../rng';
import { addDays, mskAt, mskDay } from '../time';
import type { ClientPlan, StaffPlan } from '../types';
import { makePhone } from './vehicles';

const FLEET_NAME = 'ООО «Северный ветер»';
const MS_MIN = 60_000;

export function planStaff(f: Faker): StaffPlan[] {
  const rows: [string, StaffPlan['role'], number, 'male' | 'female'][] = [
    ['owner', 'owner', 0, 'male'],
    ['reception1', 'master_receptionist', 0, 'female'],
    ['reception2', 'master_receptionist', 0, 'male'],
    ['master1', 'master', 0.4, 'male'],
    ['master2', 'master', 0.35, 'male'],
    ['master3', 'master', 0.25, 'male'],
  ];
  return rows.map(([login, role, loadWeight, sex]) => ({
    id: demoId('user', login),
    name: personName(f, sex),
    login,
    role,
    loadWeight,
  }));
}

function personName(f: Faker, sex: 'male' | 'female'): string {
  return `${f.person.lastName(sex)} ${f.person.firstName(sex)} ${f.person.middleName(sex)}`;
}

export function planClients(f: Faker, demoNow: Date): ClientPlan[] {
  const today = mskDay(demoNow);
  const windowStart = mskAt(addDays(today, -HISTORY_DAYS), 0);
  const threeYearsAgo = mskAt(addDays(today, -1095), 0);
  const latest = demoNow.getTime() - 3 * 60 * MS_MIN;
  const regulars = Math.round(CLIENTS_TOTAL * REGULAR_SHARE);

  // Company positions: hero fleet at 1, the rest spread (more among regulars).
  const inRegular = f.helpers.shuffle(Array.from({ length: regulars - 3 }, (_, i) => i + 3)).slice(0, 8);
  const inOccasional = f.helpers
    .shuffle(Array.from({ length: CLIENTS_TOTAL - regulars }, (_, i) => i + regulars))
    .slice(0, COMPANIES_TOTAL - 1 - 8);
  const companyAt = new Set<number>([1, ...inRegular, ...inOccasional]);

  const tickets = stratifiedLognormal(f, CLIENTS_TOTAL, TICKET_MEDIAN, 0.5);
  const phones = new Set<string>([HERO.client.phone]);
  const names = new Set<string>([HERO.client.name, FLEET_NAME]);
  const unique = (set: Set<string>, gen: () => string) => {
    for (;;) {
      const v = gen();
      if (!set.has(v)) {
        set.add(v);
        return v;
      }
    }
  };
  const heroCreated: Record<number, Date> = {
    0: mskAt(addDays(today, -HISTORY_DAYS - 420), 10, 15),
    1: mskAt(addDays(today, -HISTORY_DAYS - 300), 11, 40),
    2: mskAt(addDays(today, -HISTORY_DAYS - 200), 15, 5),
  };

  const out: ClientPlan[] = [];
  for (let i = 0; i < CLIENTS_TOTAL; i++) {
    const company = companyAt.has(i);
    const tier = i < regulars ? 'regular' : 'occasional';

    let created: Date;
    if (heroCreated[i]) created = heroCreated[i];
    else if (chance(f, 0.7)) created = f.date.between({ from: threeYearsAgo, to: new Date(windowStart.getTime() - 1) });
    else created = f.date.between({ from: windowStart, to: new Date(latest) });
    created = new Date(Math.min(created.getTime(), latest));

    let id: string;
    let full_name: string;
    let phone: string;
    if (i === 0) {
      id = HERO.client.id;
      full_name = HERO.client.name;
      phone = HERO.client.phone;
    } else {
      id = i === 1 ? HERO.fleetClientId : i === 2 ? HERO.bigOrder.clientId : demoId('client', i);
      phone = unique(phones, () => makePhone(f));
      if (i === 1) full_name = FLEET_NAME;
      else if (i === 2) full_name = unique(names, () => personName(f, 'male'));
      else if (company) full_name = unique(names, () => f.company.name().replace(/^AO /, 'АО '));
      else full_name = unique(names, () => personName(f, f.person.sex() === 'female' ? 'female' : 'male'));
    }

    let vehicleCount: number;
    if (i === 0) vehicleCount = 2;
    else if (i === 1) vehicleCount = 6;
    else if (i === 2) vehicleCount = 1;
    else if (company) vehicleCount = 2 + weightedIndex(f, [4, 3, 2, 1, 1]);
    else vehicleCount = 1 + weightedIndex(f, [85, 13, 2]);

    const csv = i === 0 || (i > 2 && chance(f, 0.25));
    const deals = i === 0 ? 14 : csv ? f.number.int({ min: 1, max: 15 }) : 0;
    const sum = i === 0 ? 186400 : csv ? deals * Math.round(tickets[i] / 100) * 100 : 0;
    const discount = i > 2 && tier === 'regular' && chance(f, 0.4) ? 5 : null;

    out.push({
      id,
      full_name,
      phone,
      kind: company ? 'company' : 'person',
      tier,
      source: csv ? 'csv_import' : 'manual',
      discount_default_pct: discount,
      imported_deals_count: deals,
      imported_deals_sum: sum,
      notes: i > 2 && chance(f, 0.12) ? f.helpers.arrayElement(CLIENT_NOTES) : null,
      created_at: created,
      vehicleCount,
    });
  }
  return out;
}
