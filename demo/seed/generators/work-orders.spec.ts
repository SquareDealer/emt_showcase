import { PricingService } from '../../../src/work-orders/pricing.service';
import { HERO, heroSchedule } from '../hero';
import { buildDemoPlan } from '../plan';
import { allowedStatuses, overlaps, planViolations, staleDone } from '../test-utils/plan-checks';
import { mskAt, mskDay, mskMinutes } from '../time';
import type { WorkOrderPlan } from '../types';
import { formatKm, orderTitle, planSettings, rateAt } from './work-orders';

const now = mskAt('2026-11-04', 12);
const plan = buildDemoPlan(now);
const wos = plan.workOrders;
const pricing = new PricingService();

it('~800 orders', () => {
  expect(wos.length).toBeGreaterThanOrEqual(760);
  expect(wos.length).toBeLessThanOrEqual(840);
});
it('status follows the date rules', () => {
  for (const w of wos) expect(allowedStatuses(w, now)).toContain(w.status);
});
it('«Готово» is recent: past 14 days only a couple of unpaid stragglers', () => {
  expect(staleDone(wos, now).length).toBeGreaterThanOrEqual(1);
  expect(staleDone(wos, now).length).toBeLessThanOrEqual(3);
  const MS_DAY = 86_400_000;
  const old = wos.filter((w) => w.status !== 'closed' && now.getTime() - w.scheduled_at.getTime() > 15 * MS_DAY);
  expect(old.map((w) => w.status)).toEqual(old.map(() => 'done'));
  expect(staleDone(wos, now).every((w) => w.total_cached <= 7000)).toBe(true);
});
it('exactly two overdue scheduled orders', () =>
  expect(wos.filter((w) => w.status === 'scheduled' && w.scheduled_at < now)).toHaveLength(2));
it('created ≤ scheduled ≤ closed ≤ updated ≤ DEMO_NOW', () => {
  for (const w of wos) {
    expect(w.created_at <= w.scheduled_at).toBe(true);
    expect(w.created_at <= now && w.updated_at <= now && w.created_at <= w.updated_at).toBe(true);
    if (w.status === 'closed') expect(w.scheduled_at <= w.closed_at! && w.closed_at! <= w.updated_at).toBe(true);
  }
});
it('closed orders are frozen and paid; others are not', () => {
  for (const w of wos) {
    if (w.status === 'closed') expect([w.total_frozen, w.paid_amount]).toEqual([w.total_cached, w.total_cached]);
    else expect([w.total_frozen, w.closed_at, w.paid_amount]).toEqual([null, null, 0]);
  }
});
it('total_cached is the real PricingService total', () => {
  for (const w of wos) expect(w.total_cached).toBe(pricing.computeTotal(w.labor, w.parts, w.discount_type, w.discount_value));
});
it('rate snapshot is 2000 before the change and 2200 after', () => {
  const change = mskAt('2026-08-04', 0);
  for (const w of wos) for (const l of w.labor) expect(l.rate_snapshot).toBe(l.created_at < change ? 2000 : 2200);
  expect(plan.settings.labor_rate).toBe('2200');
  // both rates are actually in use
  const rates = new Set(wos.flatMap((w) => w.labor.map((l) => l.rate_snapshot)));
  expect([...rates].sort()).toEqual([2000, 2200]);
});
it('rateAt switches at 00:00 MSK three calendar months back', () => {
  expect(rateAt(now, mskAt('2026-08-03', 23, 59))).toBe(2000);
  expect(rateAt(now, mskAt('2026-08-04', 0))).toBe(2200);
  // month-end: 3 months before May 31 is Feb 28/29
  expect(rateAt(mskAt('2027-05-31', 12), mskAt('2027-02-27', 23))).toBe(2000);
  expect(rateAt(mskAt('2027-05-31', 12), mskAt('2027-02-28', 0))).toBe(2200);
});
it('every order has lines; car and client exist before the order', () => {
  const vehicles = new Map(plan.vehicles.map((v) => [v.id, v]));
  const clients = new Map(plan.clients.map((c) => [c.id, c]));
  for (const w of wos) {
    expect(w.labor.length + w.parts.length).toBeGreaterThan(0);
    const v = vehicles.get(w.vehicle_id)!;
    expect(v.client_id).toBe(w.client_id);
    expect(v.created_at <= w.created_at).toBe(true);
    expect(clients.get(w.client_id)!.created_at <= w.created_at).toBe(true);
  }
});
it('odometer never goes back per vehicle', () => {
  const vehicles = new Map(plan.vehicles.map((v) => [v.id, v]));
  const byVehicle = new Map<string, WorkOrderPlan[]>();
  for (const w of wos) byVehicle.set(w.vehicle_id, [...(byVehicle.get(w.vehicle_id) ?? []), w]);
  for (const [vid, list] of byVehicle) {
    const sorted = [...list].sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].odometer_km).toBeGreaterThanOrEqual(sorted[i - 1].odometer_km);
    for (const w of sorted) expect(w.odometer_km).toBeLessThanOrEqual(vehicles.get(vid)!.mileage);
  }
  for (const w of wos) {
    const m = /^Пробег при приёме: (\d{1,3}(?: \d{3})*) км$/m.exec(w.notes ?? '');
    expect(m && Number(m[1].replace(/ /g, ''))).toBe(w.odometer_km);
  }
  expect(formatKm(123450)).toBe('123 450');
  expect(formatKm(5000)).toBe('5 000');
  expect(formatKm(980)).toBe('980');
});
it('hero orders', () => {
  const big = wos.find((w) => w.id === HERO.bigOrder.id)!;
  expect(big).toMatchObject({ status: 'in_progress', vehicle_id: HERO.bigOrder.vehicleId, assigned_master_id: HERO.masterId, discount_type: 'percent', discount_value: 5 });
  expect(mskDay(big.scheduled_at)).toBe('2026-11-04');
  expect(big.labor.length + big.parts.length).toBeGreaterThanOrEqual(15);
  expect(new Set(big.labor.map((l) => l.group_key).filter(Boolean)).size).toBeGreaterThanOrEqual(4);
  expect(big.labor.filter((l) => l.discount_type === 'percent' && l.discount_value === 10).map((l) => l.name)).toEqual(['Замена передних тормозных дисков и колодок']);
  // discs come with pads: no separate pads work, every catalog part once
  expect(big.labor.map((l) => l.name)).toEqual([
    'ТО (регламент)', 'Замена передних тормозных дисков и колодок', 'Замена передних стоек стабилизатора', 'Замена тормозной жидкости', 'Мойка двигателя',
  ]);
  const ids = big.parts.map((p) => p.part_template_id);
  expect(new Set(ids).size).toBe(ids.length);
  // catalog work fits the 6-hour slot (± half an hour); the engine wash is on top
  const hours = big.labor.filter((l) => l.template_id).reduce((s, l) => s + (l.hours ?? 0), 0);
  expect(Math.abs(hours * 60 - big.scheduled_duration_min)).toBeLessThanOrEqual(30);
  expect(wos.find((w) => w.id === HERO.diagnosticsOrderId)).toMatchObject({ status: 'closed', vehicle_id: HERO.r56.vehicleId, recommendation: expect.stringContaining('цеп') });
  expect(wos.find((w) => w.id === HERO.pdfOrderId)).toMatchObject({ status: 'closed', discount_type: null });
  expect(wos.filter((w) => w.client_id === HERO.client.id)).toHaveLength(12);
});
it('hero details: times, masters, contents', () => {
  const byLogin = (l: string) => plan.staff.find((s) => s.login === l)!.id;
  const big = wos.find((w) => w.id === HERO.bigOrder.id)!;
  expect(big).toMatchObject({ scheduled_at: mskAt('2026-11-04', 9), scheduled_duration_min: 360, created_at: mskAt('2026-11-02', 15) });
  expect(big.labor.find((l) => l.group_key === null)).toMatchObject({ name: 'Мойка двигателя', hours: 0.5 });
  const diag = wos.find((w) => w.id === HERO.diagnosticsOrderId)!;
  expect(diag).toMatchObject({ scheduled_at: mskAt('2026-10-28', 10), scheduled_duration_min: 60, assigned_master_id: byLogin('master2'), complaint: 'Треск двигателя на холодную' });
  expect(diag.labor.map((l) => l.template_id)).toEqual([HERO.templates.engineDiagnostics]);
  const pdf = wos.find((w) => w.id === HERO.pdfOrderId)!;
  const pdfCar = plan.vehicles.find((v) => v.id === pdf.vehicle_id)!;
  expect(pdfCar.generationCode).toBe('F56');
  expect(plan.clients.find((c) => c.id === pdf.client_id)).toMatchObject({ kind: 'person' });
  expect([HERO.client.id, HERO.bigOrder.clientId, HERO.fleetClientId]).not.toContain(pdf.client_id);
  expect(pdf).toMatchObject({ scheduled_at: mskAt('2026-10-30', 11), scheduled_duration_min: 120, assigned_master_id: byLogin('master3'), paid_amount: pdf.total_cached, discount_value: null });
  expect(pdf.labor.every((l) => l.discount_type === null) && pdf.parts.every((p) => p.discount_type === null)).toBe(true);
  expect(new Set(pdf.labor.map((l) => l.group_name))).toEqual(new Set(['Замена масла в двигателе', 'Замена свечей зажигания']));
  const visits = wos.filter((w) => w.client_id === HERO.client.id && w.id !== HERO.diagnosticsOrderId);
  expect(visits.filter((w) => w.vehicle_id === HERO.r56.vehicleId)).toHaveLength(8);
  expect(visits.filter((w) => w.vehicle_id === HERO.secondVehicleId)).toHaveLength(3);
  for (const w of visits) {
    expect(w.status).toBe('closed');
    expect(w.scheduled_at < mskAt('2026-10-31', 0)).toBe(true);
    const tires = w.labor.some((l) => l.name === 'Шиномонтаж (сезонная замена)');
    expect(tires).toBe(['10', '11'].includes(mskDay(w.scheduled_at).slice(5, 7)));
  }
  for (const car of [HERO.r56.vehicleId, HERO.secondVehicleId]) {
    expect(visits.some((w) => w.vehicle_id === car && mskDay(w.scheduled_at) >= '2026-10-01')).toBe(true);
  }
});
it('busy day and a free slot on the next weekday', () => {
  const { busyDay, freeSlot } = heroSchedule(now);
  expect(wos.filter((w) => mskDay(w.scheduled_at) === busyDay).length).toBeGreaterThanOrEqual(9);
  const next = mskDay(freeSlot.startsAt);
  expect(wos.filter((w) => mskDay(w.scheduled_at) === next).length).toBeGreaterThanOrEqual(4);
  expect(wos.some((w) => overlaps(w.scheduled_at, w.scheduled_duration_min, freeSlot.startsAt, 120))).toBe(false);
});
it('no master is double-booked; titles, waiting notes, discounts', () => {
  expect(planViolations(plan)).toEqual([]);
  for (const w of wos) {
    expect(w.title).toBe(orderTitle(w.labor, w.parts));
    if (w.status === 'waiting') expect(w.notes).toMatch(/Ждёт запчасть: .+/);
  }
  const lines = wos.flatMap((w) => w.labor);
  const discounted = lines.filter((l) => l.discount_type === 'percent' && l.discount_value === 10).length / lines.length;
  expect(discounted).toBeGreaterThan(0.02);
  expect(discounted).toBeLessThan(0.07);
  expect(wos.filter((w) => w.complaint).length / wos.length).toBeGreaterThan(0.5);
  expect(wos.filter((w) => w.recommendation).length / wos.length).toBeGreaterThan(0.2);
  expect(wos.some((w) => w.discount_type === 'fixed')).toBe(true);
  // a client's default discount is honoured
  const withDefault = new Map(plan.clients.filter((c) => c.discount_default_pct).map((c) => [c.id, c.discount_default_pct]));
  const theirs = wos.filter((w) => withDefault.has(w.client_id) && w.id !== HERO.bigOrder.id);
  expect(theirs.length).toBeGreaterThan(0);
  for (const w of theirs) expect([w.discount_type, w.discount_value]).toEqual(['percent', withDefault.get(w.client_id)]);
});
it('start times are spread over the day, mostly in the morning', () => {
  const minutes = wos.map((w) => mskMinutes(w.scheduled_at));
  expect(minutes.filter((m) => m === 8 * 60).length / wos.length).toBeLessThan(0.15);
  expect(minutes.filter((m) => m < 13 * 60).length / wos.length).toBeGreaterThan(0.5);
  expect(minutes.filter((m) => m >= 14 * 60).length / wos.length).toBeGreaterThan(0.15);
  const hero = wos.filter((w) => w.client_id === HERO.client.id).map((w) => mskMinutes(w.scheduled_at));
  expect(hero.filter((m) => m === 8 * 60).length).toBeLessThan(hero.length / 2);
});
it('orders come out in date order', () => {
  for (let i = 1; i < wos.length; i++) expect(wos[i - 1].scheduled_at <= wos[i].scheduled_at).toBe(true);
});
it('title: the two dearest blocks, the dearer first', () => {
  const big = wos.find((w) => w.id === HERO.bigOrder.id)!;
  expect(big.title).toBe('Замена передних тормозных дисков и колодок, ТО (регламент)');
  const at = new Date(0);
  const lab = (key: string, sort: number, hours: number) => ({
    id: key, template_id: key, name: key, hours, rate_snapshot: 2000, price_override: null, discount_type: null, discount_value: null,
    group_key: key, group_name: key, group_sort: sort, sort, created_at: at,
  });
  const part = (key: string, price: number) => ({
    id: `${key}-p`, part_template_id: null, name: 'p', manufacturer: null, catalog_number: null, qty: 1, unit: 'pcs' as const, unit_price: price,
    discount_type: null, discount_value: null, group_key: key, group_name: key, group_sort: 0, sort: 0, created_at: at,
  });
  // a: 2000, b: 1000 + 5000 of parts, c: 4000 → «b, c»; a free line (no block) never names the order
  const free = { ...lab('free', 0, 9), group_key: null, group_name: null };
  expect(orderTitle([lab('a', 1, 1), lab('b', 2, 0.5), lab('c', 3, 2), free], [part('b', 5000)])).toBe('b, c');
  expect(orderTitle([lab('a', 1, 1), lab('b', 2, 1)], [])).toBe('a, b');
});
it('settings', () => {
  expect(planSettings(now)).toMatchObject({ labor_rate: '2200', vat_rate: '20', demo_now: '2026-11-04' });
});
