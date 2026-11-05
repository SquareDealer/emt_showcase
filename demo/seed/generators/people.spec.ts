import { HERO } from '../hero';
import { makeFaker } from '../rng';
import { mskAt } from '../time';
import { planClients, planStaff } from './people';

const now = mskAt('2026-11-04', 12);
const staff = planStaff(makeFaker('staff', now));

it('staff: 1 owner, 2 receptionists, 3 masters with fixed logins', () => {
  expect(staff.map((s) => s.login)).toEqual(['owner', 'reception1', 'reception2', 'master1', 'master2', 'master3']);
  expect(staff.map((s) => s.role)).toEqual(['owner', 'master_receptionist', 'master_receptionist', 'master', 'master', 'master']);
  expect(staff[3].id).toBe(HERO.masterId);
  expect(staff.map((s) => s.loadWeight)).toEqual([0, 0, 0, 0.4, 0.35, 0.25]);
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
