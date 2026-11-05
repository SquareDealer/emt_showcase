import { FEMALE_FIRST_NAMES, MALE_FIRST_NAMES, PATRONYMICS, STAFF_NAMES } from '../data/names';
import { HERO } from '../hero';
import { makeFaker } from '../rng';
import { mskAt } from '../time';
import { planClients, planStaff } from './people';

const now = mskAt('2026-11-04', 12);
const staff = planStaff();

it('staff: 1 owner, 2 receptionists, 3 masters with fixed logins', () => {
  expect(staff.map((s) => s.login)).toEqual(['owner', 'reception1', 'reception2', 'master1', 'master2', 'master3']);
  expect(staff.map((s) => s.role)).toEqual(['owner', 'master_receptionist', 'master_receptionist', 'master', 'master', 'master']);
  expect(staff[3].id).toBe(HERO.masterId);
  expect(staff.map((s) => s.loadWeight)).toEqual([0, 0, 0, 0.4, 0.35, 0.25]);
  expect(staff.map((s) => s.name)).toEqual(staff.map((s) => STAFF_NAMES[s.login]));
});

const clients = planClients(makeFaker('clients', now), now);

it('150 clients, 15 companies, 30 regulars', () => {
  expect(clients).toHaveLength(150);
  expect(clients.filter((c) => c.kind === 'company')).toHaveLength(15);
  expect(clients.filter((c) => c.tier === 'regular')).toHaveLength(30);
});

it('phones are unique +7 (555)', () => {
  expect(clients.every((c) => /^\+7 \(555\) \d{3}-\d{2}-\d{2}$/.test(c.phone))).toBe(true);
  expect(new Set(clients.map((c) => c.phone)).size).toBe(150);
});

it('hero client is a csv_import regular with deal history', () =>
  expect(clients[0]).toMatchObject({
    id: HERO.client.id, full_name: HERO.client.name, phone: HERO.client.phone,
    source: 'csv_import', imported_deals_count: 14, imported_deals_sum: 186400, tier: 'regular',
  }));

it('indices 1 and 2 are the fleet and the F60 owner', () => {
  expect(clients[1]).toMatchObject({ id: HERO.fleetClientId, kind: 'company', full_name: 'ООО «Северный ветер»', vehicleCount: 6 });
  expect(clients[2]).toMatchObject({ id: HERO.bigOrder.clientId, kind: 'person' });
});

it('imported deals are consistent with the source', () => {
  for (const c of clients) {
    if (c.source === 'csv_import') expect(c.imported_deals_count).toBeGreaterThanOrEqual(1);
    else expect([c.imported_deals_count, c.imported_deals_sum]).toEqual([0, 0]);
  }
  const share = clients.filter((c) => c.source === 'csv_import').length / clients.length;
  expect(share).toBeGreaterThan(0.15);
  expect(share).toBeLessThan(0.35);
});

it('nobody is created after DEMO_NOW', () => expect(clients.every((c) => c.created_at <= now)).toBe(true));

it('is deterministic', () => expect(planClients(makeFaker('clients', now), now)).toEqual(clients));

describe('company names', () => {
  const names = clients.filter((c) => c.kind === 'company').map((c) => c.full_name);
  it('are hand-written ООО «…» or ИП Фамилия И. О., without state/housing forms', () => {
    for (const n of names) {
      expect(n).toMatch(/^(ООО «[^«»]+»|ИП [А-ЯЁ][а-яё]+ [А-ЯЁ]\. [А-ЯЁ]\.)$/);
      expect(n).not.toMatch(/ГУП|МУП|ФГУП|ТСЖ|ЗАО|ОАО/);
    }
  });
  it('are unique and include the hero fleet once', () => {
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n === 'ООО «Северный ветер»')).toHaveLength(1);
  });
});

describe('person names', () => {
  const male = new Set(MALE_FIRST_NAMES);
  const female = new Set(FEMALE_FIRST_NAMES);
  const pm = new Set(PATRONYMICS.map((p) => p.male));
  const pf = new Set(PATRONYMICS.map((p) => p.female));
  const people = [...staff.map((s) => s.name), ...clients.filter((c) => c.kind === 'person').map((c) => c.full_name)];

  it('first name and patronymic come from the modern pools, same gender', () => {
    expect(people.length).toBe(6 + 135);
    for (const n of people) {
      const [, first, middle] = n.split(' ');
      const isMale = male.has(first) && pm.has(middle);
      const isFemale = female.has(first) && pf.has(middle);
      expect([n, isMale || isFemale]).toEqual([n, true]);
      // the faker surname agrees: Иванов… / Иванова…
      expect([n, /^[А-ЯЁ][а-яё-]+(а|я|ая)$/.test(n.split(' ')[0])]).toEqual([n, isFemale]);
    }
  });
  it('both genders are present; ИП initials come from the pools', () => {
    expect(people.some((n) => female.has(n.split(' ')[1]))).toBe(true);
    expect(people.some((n) => male.has(n.split(' ')[1]))).toBe(true);
    for (const c of clients.filter((x) => x.full_name.startsWith('ИП '))) {
      const [, , i, o] = c.full_name.split(' ');
      expect(MALE_FIRST_NAMES.some((x) => x[0] === i[0])).toBe(true);
      expect(PATRONYMICS.some((x) => x.male[0] === o[0])).toBe(true);
    }
  });
  it('pool patronymics have the right endings', () => {
    for (const p of PATRONYMICS) {
      expect(p.male).toMatch(/(ович|евич|ич)$/);
      expect(p.female).toMatch(/(овна|евна|инична|ична)$/);
      expect(p.female.slice(0, 4)).toBe(p.male.slice(0, 4));
    }
  });
});
