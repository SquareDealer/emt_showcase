import type { Faker } from '@faker-js/faker';
import { PriceResolutionService } from '../../../src/task-templates/price-resolution.service';
import { PricingService } from '../../../src/work-orders/pricing.service';
import {
  FUTURE_DAYS,
  LABOR_RATE_NEW,
  LABOR_RATE_OLD,
  MONTHLY_TICKET_GROWTH,
  ORDERS_TARGET,
  RATE_CHANGE_MONTHS_AGO,
  REGULAR_WEIGHT,
  SLOT_MIN,
  TICKET_MEDIAN,
  TICKET_SIGMA,
  WORK_END_HOUR,
  WORK_START_HOUR,
} from '../config';
import { COMPLAINTS, RECOMMENDATIONS } from '../data/texts';
import { HERO, heroSchedule } from '../hero';
import { demoId } from '../ids';
import { chance, stratifiedLognormal, weightedIndex } from '../rng';
import { addDays, daysBetween, isWorkday, mskAt, mskDay, subMonthsDay } from '../time';
import type {
  BlockPlan,
  CatalogPlan,
  ClientPlan,
  FreeLabor,
  LaborLinePlan,
  PartLinePlan,
  StaffPlan,
  TaskPlan,
  VehiclePlan,
  WorkOrderPlan,
  WorkOrderStatus,
  WorkPick,
} from '../types';
import { overrideFor, resolveTemplatePartsPlan, taskByKey } from './catalog';
import { buildOrderLines } from './lines';
import { DayBoard, dailyCounts, windowStartDay, type Interval } from './schedule';
import { odometerAt } from './vehicles';

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;
/** Days between booking and visit, 0..10: mostly 1–3. */
const LEAD_WEIGHTS = [1.5, 5, 5, 4, 2, 1.2, 1, 0.8, 0.6, 0.5, 0.4];
const MAX_PICKS = 6;
const TIRE_PEAK_MONTHS = [10, 11];
/**
 * The autumn swap: a tyre work is 1.5× as likely in October–November (on top of SEASON_FACTOR's +30% volume).
 * ×6 put a tyre work into 80% of October orders, ×2 still into 55–64%; ×1.5 gives ~50%, ~3.5× summer.
 */
const TIRE_PEAK_FACTOR = 1.5;
/** The seasonal swap (with its balancing and wheel storage) belongs to the swap seasons; off-season only the odd straggler. */
const SEASONAL_SWAP = new Set(['tire-change', 'wheel-balance', 'tire-storage']);
const SWAP_MONTHS = [4, 5, 10, 11];
const SWAP_OFF_SEASON_FACTOR = 0.15;
/**
 * Wanted start, per half hour from 08:00: most clients come in the morning, but not all at opening.
 * Only starts that end by closing time are drawn; when the wanted time is taken, the earliest free slot.
 */
const START_WEIGHTS = [3, 3, 4, 4, 4, 4, 3.5, 3.5, 3, 3, 2, 2, 2.5, 2.5, 2, 2, 1.5, 1.5, 1, 1, 0.5, 0.5];
const BUSY_DAY_MIN = 9;
const NEXT_DAY_MIN = 4;
const OVERDUE_COUNT = 2;
/** Past two weeks every order is paid and closed, but for a couple of forgotten «Готово» on the board. */
const STALE_DONE_DAYS = 14;
const STALE_DONE_COUNT = 2;
/** The hero F60 (the big order's car) is a regular, but ~20 visits in six months would look odd. */
const HERO_F60_BULK_MAX = 4;
/** Top-up works for the busy day and the next weekday: short enough to fit any remaining gap. */
const QUICK_MAX_MIN = 60;
/** A target above 8 × median (the top 0.7%) is out of reach of 6 works; the carry stays within ±4 × median. */
const TICKET_CAP_X = 8;
const OWED_LIMIT_X = 4;
/** Works tied to the N14 engine only make sense on the R-series. */
const R_SERIES_ONLY = new Set(['timing-chain-n14']);

/** Hero client's history: 8 × R56, 3 × RAV4 (the last visit is the RAV4 and the one before it the R56, so both cars land in the autumn). */
const HERO_VISITS: { car: 'r56' | 'rav4'; works: string[] }[] = [
  { car: 'r56', works: ['service-regular'] },
  { car: 'r56', works: ['brake-pads-front'] },
  { car: 'rav4', works: ['oil-change', 'cabin-filter'] },
  { car: 'r56', works: ['suspension-diagnostics', 'stab-links-front'] },
  { car: 'r56', works: ['oil-change'] },
  { car: 'r56', works: ['valve-cover-gasket'] },
  { car: 'rav4', works: ['service-regular', 'brake-fluid'] },
  { car: 'r56', works: ['coolant-change'] },
  { car: 'r56', works: ['computer-diagnostics', 'spark-plugs'] },
  { car: 'r56', works: ['oil-change'] },
  { car: 'rav4', works: ['wheel-alignment'] },
];

/**
 * Pick weight multiplier: tires peak in October–November, the seasonal swap is rare off-season. The peak
 * boosts only an order's first tire work: one swap per visit, so a big autumn order does not fill its six
 * works with cheap tire jobs and fall short of its ticket.
 */
function seasonFactor(t: TaskPlan, month: number, hasTires: boolean): number {
  if (t.category !== 'tires') return 1;
  if (TIRE_PEAK_MONTHS.includes(month)) return hasTires ? 1 : TIRE_PEAK_FACTOR;
  return SEASONAL_SWAP.has(t.key) && !SWAP_MONTHS.includes(month) ? SWAP_OFF_SEASON_FACTOR : 1;
}

export function rateAt(demoNow: Date, at: Date): number {
  const change = mskAt(subMonthsDay(mskDay(demoNow), RATE_CHANGE_MONTHS_AGO), 0);
  return at < change ? LABOR_RATE_OLD : LABOR_RATE_NEW;
}

export function planSettings(demoNow: Date): Record<string, string> {
  return {
    labor_rate: String(LABOR_RATE_NEW),
    company_name: 'ООО «Гараж»',
    // An empty INN is skipped on the PDF; a placeholder «0000000000» is not.
    company_inn: '',
    company_address: 'г. Москва, Промышленный проезд, д. 12, стр. 3',
    company_phone: '+7 (555) 000-00-00',
    vat_rate: '20',
    working_hours_start: '8',
    working_hours_end: '20',
    slot_minutes: String(SLOT_MIN),
    default_appointment_min: '60',
    demo_now: mskDay(demoNow),
  };
}

/** 123450 → «123 450» with plain spaces (no Intl: its group separator differs between ICU builds). */
export function formatKm(km: number): string {
  return String(km).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The part an order waits for: its dearest line (a hub bearing or a disc, not the drain plug washer). */
function awaitedPart(parts: PartLinePlan[]): string {
  const top = [...parts].sort((a, b) => b.qty * b.unit_price - a.qty * a.unit_price || a.sort - b.sort)[0];
  if (!top) throw new Error('a waiting order needs a part');
  return top.name;
}

/** The two most expensive blocks (labor + parts, before discounts), the dearer first; a tie goes to the earlier block. */
export function orderTitle(labor: LaborLinePlan[], parts: PartLinePlan[]): string {
  const blocks = new Map<string, { name: string; sort: number; cost: number }>();
  const add = (l: { group_key: string | null; group_name: string | null; group_sort: number }, cost: number) => {
    if (!l.group_key) return;
    const b = blocks.get(l.group_key) ?? { name: l.group_name ?? '', sort: l.group_sort, cost: 0 };
    b.cost += cost;
    blocks.set(l.group_key, b);
  };
  for (const l of labor) add(l, l.price_override ?? (l.hours ?? 0) * l.rate_snapshot);
  for (const p of parts) add(p, p.qty * p.unit_price);
  return [...blocks.values()]
    .sort((a, b) => b.cost - a.cost || a.sort - b.sort)
    .slice(0, 2)
    .map((b) => b.name)
    .join(', ');
}

export interface WorkOrdersContext {
  demoNow: Date;
  catalog: CatalogPlan;
  clients: ClientPlan[];
  vehicles: VehiclePlan[];
  staff: StaffPlan[];
  blocks: BlockPlan[];
}

/** A placed order before its status, lines and dates are settled. */
interface Draft {
  id: string;
  client: ClientPlan;
  vehicle: VehiclePlan;
  masterId: string;
  start: Date;
  duration: number;
  works: WorkPick[];
  free: FreeLabor[];
  createdAt: Date;
  discount: { type: 'percent' | 'fixed'; value: number } | null;
  /** Hero orders: the status is part of the story; `texts` null → drawn like any other order. */
  hero?: { status: WorkOrderStatus; texts: { complaint: string | null; recommendation: string | null } | null };
}

const lastWorkdayOnOrBefore = (day: string): string => {
  let d = day;
  while (!isWorkday(d)) d = addDays(d, -1);
  return d;
};
const nextWorkdayAfter = (day: string): string => {
  let d = addDays(day, 1);
  while (!isWorkday(d)) d = addDays(d, 1);
  return d;
};
const lastDayOfMonth = (day: string): string => {
  const [y, m] = day.split('-').map(Number);
  return addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
};
const monthOf = (day: string): number => Number(day.slice(5, 7));
const monthKeyOf = (d: Date): string => mskDay(d).slice(0, 7);
const roundUp30 = (min: number): number => Math.ceil(min / SLOT_MIN) * SLOT_MIN;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const earliest = (...ds: Date[]): Date => new Date(Math.min(...ds.map((d) => d.getTime())));
const latest = (...ds: Date[]): Date => new Date(Math.max(...ds.map((d) => d.getTime())));
const byDateThenId = (a: WorkOrderPlan, b: WorkOrderPlan): number =>
  a.scheduled_at.getTime() - b.scheduled_at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function planWorkOrders(f: Faker, ctx: WorkOrdersContext): WorkOrderPlan[] {
  const { demoNow, catalog, clients, vehicles, staff, blocks } = ctx;
  const resolution = new PriceResolutionService();
  const pricing = new PricingService();
  const nowMs = demoNow.getTime();
  const closeBy = nowMs - 30 * MS_MIN;
  const today = mskDay(demoNow);
  const windowStart = windowStartDay(demoNow);
  const windowEnd = addDays(today, FUTURE_DAYS);
  const { busyDay, freeSlot } = heroSchedule(demoNow);
  const masters = staff.filter((s) => s.role === 'master');
  const masterId = (login: string): string => {
    const m = masters.find((s) => s.login === login);
    if (!m) throw new Error(`no master ${login}`);
    return m.id;
  };
  const board = new DayBoard(masters, blocks, freeSlot);
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const carsOf = new Map<string, VehiclePlan[]>();
  for (const v of vehicles) carsOf.set(v.client_id, [...(carsOf.get(v.client_id) ?? []), v]);
  const must = <T>(x: T | undefined, what: string): T => {
    if (x === undefined) throw new Error(`missing ${what}`);
    return x;
  };

  // estimate = the work's price for the car's generation + its default parts (memoised: ~5k lookups).
  const estCache = new Map<string, number>();
  const estimate = (task: TaskPlan, gen: string | null, rate: number): number => {
    const k = `${task.key}|${gen ?? '-'}|${rate}`;
    let v = estCache.get(k);
    if (v === undefined) {
      const r = resolution.resolve(task, overrideFor(catalog, task.key, gen), rate);
      const labor = r.price_override ?? (r.hours ?? 0) * r.rate_snapshot;
      const parts = resolveTemplatePartsPlan(catalog, task.key, gen)
        .filter((c) => c.is_default)
        .reduce((s, c) => s + c.qty * c.part.default_price, 0);
      v = labor + parts;
      estCache.set(k, v);
    }
    return v;
  };
  const durationOf = (works: WorkPick[], gen: string | null): number => {
    const hours = works.reduce((s, w) => {
      const t = taskByKey(catalog, w.taskKey);
      return s + (resolution.resolve(t, overrideFor(catalog, t.key, gen), 0).hours ?? 0);
    }, 0);
    return clamp(roundUp30(hours * 60), 30, 480);
  };

  /** The day the order is booked: `lead` days before the visit (mostly 1–3), never after today. */
  const bookingDay = (day: string): string => {
    const lead = weightedIndex(f, LEAD_WEIGHTS);
    const d = addDays(day, -lead);
    return d <= today ? d : addDays(today, -f.number.int({ min: 0, max: 6 }));
  };
  /** created_at: 10:00–19:00 of the booking day, never after the visit or DEMO_NOW (15 min of slack for the line stamps). */
  const createdAtFor = (creationDay: string, start: Date): Date =>
    earliest(mskAt(creationDay, 0, f.number.int({ min: 10 * 60, max: 19 * 60 })), start, new Date(nowMs - 15 * MS_MIN));
  const lineDiscounts = (keys: string[]): WorkPick[] => keys.map((taskKey) => (chance(f, 0.04) ? { taskKey, laborDiscountPct: 10 } : { taskKey }));
  const orderDiscount = (client: ClientPlan): Draft['discount'] => {
    if (client.discount_default_pct) return { type: 'percent', value: client.discount_default_pct };
    const r = f.number.float();
    if (r < 0.08) return { type: 'percent', value: f.helpers.arrayElement([5, 10]) };
    if (r < 0.1) return { type: 'fixed', value: f.helpers.arrayElement([500, 1000]) };
    return null;
  };
  const endOf = (d: { start: Date; duration: number }) => d.start.getTime() + d.duration * MS_MIN;

  /** The status table: future → scheduled, running → in_progress, then by the age of `end`. */
  const statusByDate = (d: Draft): WorkOrderStatus => {
    const end = endOf(d);
    if (d.start.getTime() > nowMs) return 'scheduled';
    if (nowMs < end) return 'in_progress';
    const age = (nowMs - end) / MS_DAY;
    const table: [WorkOrderStatus, number][] =
      age <= 3
        ? [['closed', 30], ['done', 30], ['waiting', 20], ['in_progress', age <= 2 ? 20 : 0]]
        : age <= 7
          ? [['closed', 85], ['waiting', 10], ['done', 5]]
          : age <= STALE_DONE_DAYS
            ? [['closed', 96], ['done', 4]]
            : [['closed', 1]];
    const s = table[weightedIndex(f, table.map(([, w]) => w))][0];
    // A closing needs half an hour after the work; one that just ended is still «done».
    return s === 'closed' && end > closeBy ? 'done' : s;
  };

  /** Status, lines, total (real PricingService), dates and texts of one placed order. */
  const finalize = (d: Draft): WorkOrderPlan => {
    const drawn = d.hero?.status ?? statusByDate(d);
    const end = endOf(d);
    const rate = rateAt(demoNow, d.createdAt);
    const { labor, parts } = buildOrderLines({
      woId: d.id,
      works: d.works,
      free: d.free,
      generation: d.vehicle.generationCode,
      catalog,
      rate,
      createdAt: d.createdAt,
      resolution,
    });
    // Waiting for a part needs a part on the order: a labor-only order is just «done».
    const status: WorkOrderStatus = drawn === 'waiting' && !parts.length ? 'done' : drawn;
    // A fixed 500/1000 off a 700 ₽ puncture repair would zero the order: only on a sizeable one.
    const discount = d.discount?.type === 'fixed' && pricing.netSubtotal(labor, parts) < 4 * d.discount.value ? null : d.discount;
    const total = pricing.computeTotal(labor, parts, discount?.type ?? null, discount?.value ?? null);

    let closedAt: Date | null = null;
    if (status === 'closed') {
      // end + 0–2 days at 17:00–19:30, within the month the work ended in (revenue stays in its month).
      const endDay = mskDay(new Date(end));
      const plus = addDays(endDay, weightedIndex(f, [5, 3, 1]));
      const day = plus <= lastDayOfMonth(endDay) ? plus : lastDayOfMonth(endDay);
      const candidate = mskAt(day, 0, f.number.int({ min: 17 * 60, max: 19 * 60 + 30 }));
      closedAt = new Date(Math.min(latest(candidate, new Date(end)).getTime(), closeBy));
    }

    const category = taskByKey(catalog, d.works[0].taskKey).category;
    const texts = d.hero?.texts ?? {
      complaint: chance(f, 0.6) ? f.helpers.arrayElement(COMPLAINTS[category]) : null,
      // advice comes with finished work
      recommendation: (status === 'closed' || status === 'done') && chance(f, 0.3) ? f.helpers.arrayElement(RECOMMENDATIONS[category]) : null,
    };
    const odometer = odometerAt(d.vehicle, new Date(Math.min(d.start.getTime(), nowMs)), demoNow);
    const waitingFor = status === 'waiting' ? awaitedPart(parts) : null;
    const title = orderTitle(labor, parts);

    return {
      id: d.id,
      vehicle_id: d.vehicle.id,
      client_id: d.client.id,
      assigned_master_id: d.masterId,
      status,
      title,
      notes: [`Пробег при приёме: ${formatKm(odometer)} км`, ...(waitingFor ? [`Ждёт запчасть: ${waitingFor}`] : [])].join('\n'),
      complaint: texts.complaint,
      recommendation: texts.recommendation,
      scheduled_at: d.start,
      scheduled_duration_min: d.duration,
      discount_type: discount?.type ?? null,
      discount_value: discount?.value ?? null,
      total_cached: total,
      total_frozen: status === 'closed' ? total : null,
      paid_amount: status === 'closed' ? total : 0,
      created_at: d.createdAt,
      updated_at: closedAt ?? latest(d.createdAt, new Date(Math.min(d.start.getTime(), nowMs))),
      closed_at: closedAt,
      odometer_km: odometer,
      labor,
      parts,
    };
  };

  /**
   * A slot at a drawn start time (morning-weighted), else the earliest free one of the day. The busy day
   * (DEMO_NOW's) is booked solid from opening: its finished morning orders are also where the two overdue
   * «scheduled» come from (DEMO_NOW is 12:00, and on a Monday the weekend before it is nearly empty).
   */
  const placeSpread = (day: string, duration: number, avoid: Interval[] | undefined): ReturnType<DayBoard['place']> => {
    if (day === busyDay) return board.place(day, duration, { rng: f, avoid });
    const latestStart = WORK_END_HOUR * 60 - duration;
    const weights = START_WEIGHTS.map((w, i) => (WORK_START_HOUR * 60 + i * SLOT_MIN <= latestStart ? w : 0));
    const notBeforeMin = WORK_START_HOUR * 60 + SLOT_MIN * weightedIndex(f, weights);
    return board.place(day, duration, { rng: f, notBeforeMin, avoid }) ?? board.place(day, duration, { rng: f, avoid });
  };

  const out: WorkOrderPlan[] = [];
  // Each car's bookings: DayBoard guards the masters, this guards the car (never in two orders at once).
  const carBusy = new Map<string, Interval[]>();
  const bookCar = (vehicleId: string, start: Date, durationMin: number): void => {
    carBusy.set(vehicleId, [...(carBusy.get(vehicleId) ?? []), { from: start.getTime(), to: start.getTime() + durationMin * MS_MIN }]);
  };
  const carBusyIn = (vehicleId: string, from: number, to: number): boolean => (carBusy.get(vehicleId) ?? []).some((iv) => iv.from < to && from < iv.to);

  // ── 1. Hero pins: fixed time and master, occupied on the board before anything else ──
  const pin = (d: Omit<Draft, 'createdAt'>, createdAt: Date): void => {
    board.occupy(d.masterId, d.start, d.duration);
    bookCar(d.vehicle.id, d.start, d.duration);
    out.push(finalize({ ...d, createdAt }));
  };
  const heroClient = must(clientById.get(HERO.client.id), 'hero client');
  const r56 = must(vehicleById.get(HERO.r56.vehicleId), 'hero R56');
  const rav4 = must(vehicleById.get(HERO.secondVehicleId), 'hero RAV4');
  const f60 = must(vehicleById.get(HERO.bigOrder.vehicleId), 'hero F60');

  pin(
    {
      id: HERO.bigOrder.id,
      client: must(clientById.get(f60.client_id), 'F60 owner'),
      vehicle: f60,
      masterId: HERO.masterId,
      start: mskAt(busyDay, 9),
      duration: 360,
      // Discs come with pads (one block), so no separate pads work; 6.2 h of catalog work in the 6-hour slot.
      works: [{ taskKey: 'service-regular' }, { taskKey: 'brake-discs-front', laborDiscountPct: 10 }, { taskKey: 'stab-links-front' }, { taskKey: 'brake-fluid' }],
      free: [{ name: 'Мойка двигателя', hours: 0.5 }],
      discount: { type: 'percent', value: 5 },
      hero: { status: 'in_progress', texts: { complaint: 'Плановое ТО; скрип при торможении и стук спереди на неровностях', recommendation: null } },
    },
    mskAt(addDays(busyDay, -2), 15),
  );

  const diagStart = mskAt(lastWorkdayOnOrBefore(addDays(busyDay, -7)), 10);
  pin(
    {
      id: HERO.diagnosticsOrderId,
      client: heroClient,
      vehicle: r56,
      masterId: masterId('master2'),
      start: diagStart,
      duration: 60,
      works: [{ taskKey: 'engine-diagnostics' }],
      free: [],
      discount: null,
      hero: {
        status: 'closed',
        texts: { complaint: 'Треск двигателя на холодную', recommendation: 'Растяжение цепи ГРМ (N14) — рекомендована замена цепи и натяжителя' },
      },
    },
    createdAtFor(bookingDay(mskDay(diagStart)), diagStart),
  );

  const pdfStart = mskAt(lastWorkdayOnOrBefore(addDays(busyDay, -4)), 11);
  const pdfBooking = bookingDay(mskDay(pdfStart));
  const heroClients = new Set([HERO.client.id, HERO.bigOrder.clientId, HERO.fleetClientId]);
  const pdfCar = must(
    vehicles.find((v) => {
      const c = clientById.get(v.client_id);
      return v.generationCode === 'F56' && c?.kind === 'person' && !heroClients.has(c.id) && v.created_at <= mskAt(pdfBooking, 0);
    }),
    'an F56 of an ordinary client',
  );
  pin(
    {
      id: HERO.pdfOrderId,
      client: must(clientById.get(pdfCar.client_id), 'F56 owner'),
      vehicle: pdfCar,
      masterId: masterId('master3'),
      start: pdfStart,
      duration: 120,
      works: [{ taskKey: 'oil-change' }, { taskKey: 'spark-plugs' }],
      free: [],
      discount: null,
      hero: { status: 'closed', texts: { complaint: 'Плановое ТО: масло и свечи', recommendation: 'Следующая замена масла через 8 000 км' } },
    },
    createdAtFor(pdfBooking, pdfStart),
  );

  // ── 2. Hero client's visits: weekdays spread evenly over the window, not in the last 4 days ──
  const first = addDays(windowStart, 3);
  const last = addDays(busyDay, -5);
  const span = daysBetween(first, last);
  HERO_VISITS.forEach((visit, i) => {
    let day = lastWorkdayOnOrBefore(addDays(first, Math.round((i * span) / (HERO_VISITS.length - 1))));
    const car = visit.car === 'r56' ? r56 : rav4;
    const works = lineDiscounts(TIRE_PEAK_MONTHS.includes(monthOf(day)) ? [...visit.works, 'tire-change'] : visit.works);
    const duration = durationOf(works, car.generationCode);
    const creationDay = bookingDay(day);
    let slot = placeSpread(day, duration, carBusy.get(car.id));
    while (!slot && day < last) {
      day = nextWorkdayAfter(day);
      slot = placeSpread(day, duration, carBusy.get(car.id));
    }
    if (!slot) throw new Error(`no slot for hero visit ${i + 1}`);
    bookCar(car.id, slot.start, duration);
    out.push(
      finalize({
        id: demoId('wo', `hero-visit-${i + 1}`),
        client: heroClient,
        vehicle: car,
        masterId: slot.masterId,
        start: slot.start,
        duration,
        works,
        free: [],
        createdAt: createdAtFor(creationDay, slot.start),
        discount: orderDiscount(heroClient),
        hero: { status: 'closed', texts: null },
      }),
    );
  });

  // ── 3. Bulk: daily counts, a dense busy day, a bookable next weekday ──
  const counts = dailyCounts(demoNow, ORDERS_TARGET - out.length);
  const onDay = (d: string) => out.filter((w) => mskDay(w.scheduled_at) === d).length;
  counts.set(busyDay, Math.max(counts.get(busyDay) ?? 0, BUSY_DAY_MIN - onDay(busyDay)));
  const nextDay = mskDay(freeSlot.startsAt);
  counts.set(nextDay, Math.max(counts.get(nextDay) ?? 0, NEXT_DAY_MIN - onDay(nextDay)));

  // Target tickets: stratified lognormal per month, the median grows month over month.
  const [sy, sm] = windowStart.split('-').map(Number);
  const perMonth = new Map<string, number>();
  for (const [d, n] of counts) perMonth.set(d.slice(0, 7), (perMonth.get(d.slice(0, 7)) ?? 0) + n);
  const targets = new Map<string, number[]>();
  const medians = new Map<string, number>();
  for (const [m, n] of perMonth) {
    const [y, mm] = m.split('-').map(Number);
    const median = TICKET_MEDIAN * Math.pow(1 + MONTHLY_TICKET_GROWTH, (y - sy) * 12 + (mm - sm));
    medians.set(m, median);
    targets.set(m, stratifiedLognormal(f, n, median, TICKET_SIGMA).map((t) => Math.min(t, TICKET_CAP_X * median)));
  }
  // What the month still owes its targets (target − revenue). Discrete picks, the 6-work cap, discounts and
  // unpaid orders would otherwise make monthly revenue jitter by ±5%, hiding the 3–8% growth. Like the
  // rounding carry of dailyCounts, the gap is passed on to the month's next order (bounded, so one
  // unreachable target never snowballs into a run of oversized orders).
  // Hero orders come on top of the bulk targets: their revenue is already in its month.
  const owed = new Map<string, number>();
  for (const w of out) if (w.closed_at) owed.set(monthKeyOf(w.closed_at), (owed.get(monthKeyOf(w.closed_at)) ?? 0) - w.total_cached);

  const pickable = (gen: string | null) => catalog.tasks.filter((t) => !R_SERIES_ONLY.has(t.key) || (gen ?? '').startsWith('R'));
  // The default parts a work brings for a generation (memoised): an order never lists a part twice.
  const partsCache = new Map<string, string[]>();
  const defaultParts = (t: TaskPlan, gen: string | null): string[] => {
    const k = `${t.key}|${gen ?? '-'}`;
    let v = partsCache.get(k);
    if (!v) {
      v = resolveTemplatePartsPlan(catalog, t.key, gen).filter((c) => c.is_default).map((c) => c.part.id);
      partsCache.set(k, v);
    }
    return v;
  };
  /** `t` can join `picks`: not an alternative of a picked work and no part in common with one. */
  const compatible = (t: TaskPlan, picks: TaskPlan[], gen: string | null): boolean =>
    picks.every((p) => p !== t && (!t.exclusive || p.exclusive !== t.exclusive) && !defaultParts(p, gen).some((id) => defaultParts(t, gen).includes(id)));
  const bulkClients = clients.filter((c) => c.id !== HERO.client.id);
  const firstCar = new Map(bulkClients.map((c) => [c.id, Math.min(...(carsOf.get(c.id) ?? []).map((v) => v.created_at.getTime()))]));

  let seq = 0;
  let f60Bulk = 0;
  /** A car is free for a new order on `day` ([from, to)): not booked that day; the hero F60 sits out its busy day and is capped. */
  const carFree = (v: VehiclePlan, day: string, from: number, to: number): boolean =>
    !carBusyIn(v.id, from, to) && (v.id !== HERO.bigOrder.vehicleId || (day !== busyDay && f60Bulk < HERO_F60_BULK_MAX));

  /**
   * One ordinary order around `day`. Normal: works are drawn to the ticket target and the order moves to
   * the next weekday when the day is full. `quick`: one short work, and only on `day` (the top-up).
   */
  const bulkOrder = (day: string, target: number, quick: boolean): WorkOrderPlan | null => {
    const month = monthOf(day);
    const creationDay = bookingDay(day);
    // Client and car exist before the day the order is booked.
    const bound = mskAt(creationDay, 0).getTime();
    const dayFrom = mskAt(day, 0).getTime();
    const dayTo = dayFrom + MS_DAY;
    const free = new Map<string, VehiclePlan[]>();
    for (const c of bulkClients) {
      if ((firstCar.get(c.id) ?? Infinity) > bound) continue;
      const cars = (carsOf.get(c.id) ?? []).filter((v) => v.created_at.getTime() <= bound && carFree(v, day, dayFrom, dayTo));
      if (cars.length) free.set(c.id, cars);
    }
    const candidates = bulkClients.filter((c) => free.has(c.id));
    if (!candidates.length) return null;
    const client = candidates[weightedIndex(f, candidates.map((c) => (c.tier === 'regular' ? REGULAR_WEIGHT : 1)))];
    const vehicle = f.helpers.arrayElement(must(free.get(client.id), 'free car'));
    const gen = vehicle.generationCode;
    const rate = rateAt(demoNow, mskAt(creationDay, 12));

    const picks: TaskPlan[] = [];
    if (quick) {
      const short = pickable(gen).filter((t) => durationOf([{ taskKey: t.key }], gen) <= QUICK_MAX_MIN);
      picks.push(short[weightedIndex(f, short.map((o) => o.weight * seasonFactor(o, month, false)))]);
    } else {
      let sum = 0;
      while (sum < 0.9 * target && picks.length < MAX_PICKS) {
        const room = (target - sum) * 1.5 + 1000;
        const options = pickable(gen).filter((t) => compatible(t, picks, gen) && estimate(t, gen, rate) <= room);
        if (!options.length) break;
        const hasTires = picks.some((x) => x.category === 'tires');
        const t = options[weightedIndex(f, options.map((o) => o.weight * seasonFactor(o, month, hasTires)))];
        picks.push(t);
        sum += estimate(t, gen, rate);
      }
      if (!picks.length) {
        // the cheapest work, the more common one on a tie
        picks.push([...pickable(gen)].sort((a, b) => estimate(a, gen, rate) - estimate(b, gen, rate) || b.weight - a.weight)[0]);
      }
    }

    const works = lineDiscounts(picks.map((t) => t.key));
    const duration = durationOf(works, gen);
    const avoid = carBusy.get(vehicle.id);
    let at = day;
    let slot = placeSpread(at, duration, avoid);
    while (!slot && !quick) {
      at = nextWorkdayAfter(at);
      if (at > windowEnd) break;
      slot = placeSpread(at, duration, avoid);
    }
    if (!slot) return null;
    bookCar(vehicle.id, slot.start, duration);
    if (vehicle.id === HERO.bigOrder.vehicleId) f60Bulk++;
    seq++;
    return finalize({
      id: demoId('wo', seq),
      client,
      vehicle,
      masterId: slot.masterId,
      start: slot.start,
      duration,
      works,
      free: [],
      createdAt: createdAtFor(creationDay, slot.start),
      discount: orderDiscount(client),
    });
  };

  for (const [day, n] of counts) {
    const monthKey = day.slice(0, 7);
    const pool = must(targets.get(monthKey), `targets ${monthKey}`);
    const owedLimit = OWED_LIMIT_X * must(medians.get(monthKey), `median ${monthKey}`);
    for (let k = 0; k < n; k++) {
      const base = must(pool.shift(), `target ${day}`);
      const target = Math.max(0.3 * base, base + (owed.get(monthKey) ?? 0));
      const wo = bulkOrder(day, target, false);
      if (!wo) continue;
      // Recent and future orders will be paid; only an old «done» is revenue lost for good.
      const lost = wo.status === 'done' && nowMs - endOf({ start: wo.scheduled_at, duration: wo.scheduled_duration_min }) > 7 * MS_DAY;
      owed.set(monthKey, clamp(target - (lost ? 0 : wo.total_cached), -owedLimit, owedLimit));
      out.push(wo);
    }
  }

  // Quotas are not guarantees: a long order that does not fit moves on. Top the two showcase days up
  // with short works that fit the remaining gaps (the free slot itself stays free).
  for (const [day, min] of [[busyDay, BUSY_DAY_MIN], [nextDay, NEXT_DAY_MIN]] as const) {
    for (let tries = 0; onDay(day) < min; tries++) {
      if (tries >= 50) throw new Error(`cannot fill ${day} up to ${min} orders`);
      const wo = bulkOrder(day, 0, true);
      if (wo) out.push(wo);
    }
  }

  // ── 4. Exactly two bookings of the last two days nobody moved on: still «scheduled» ──
  // Only orders whose slot has already passed: a running one cannot still be waiting to start.
  const endMs = (w: WorkOrderPlan) => endOf({ start: w.scheduled_at, duration: w.scheduled_duration_min });
  const unpaid = (w: WorkOrderPlan, status: WorkOrderStatus): WorkOrderPlan => ({
    ...w,
    status,
    notes: w.notes?.split('\n').filter((l) => !l.startsWith('Ждёт запчасть')).join('\n') ?? null,
    recommendation: null,
    total_frozen: null,
    paid_amount: 0,
    closed_at: null,
    updated_at: latest(w.created_at, new Date(Math.min(w.scheduled_at.getTime(), nowMs))),
  });
  const ordinary = (w: WorkOrderPlan) => !heroClients.has(w.client_id);
  const finished = out.filter((w) => ordinary(w) && w.scheduled_at.getTime() >= nowMs - 2 * MS_DAY && endMs(w) <= nowMs);
  const overdue = new Set(f.helpers.arrayElements(finished, OVERDUE_COUNT).map((w) => w.id));
  if (overdue.size !== OVERDUE_COUNT) throw new Error(`need ${OVERDUE_COUNT} overdue candidates, have ${finished.length}`);
  // A couple of stragglers: small orders of 2–6 weeks ago the client never came to pay for.
  const pinned = new Set([HERO.bigOrder.id, HERO.diagnosticsOrderId, HERO.pdfOrderId]);
  const staleFrom = nowMs - 42 * MS_DAY;
  const staleTo = nowMs - (STALE_DONE_DAYS + 1) * MS_DAY;
  const strays = out.filter((w) => ordinary(w) && !pinned.has(w.id) && w.status === 'closed' && endMs(w) >= staleFrom && endMs(w) <= staleTo && w.total_cached <= TICKET_MEDIAN);
  const stale = new Set(f.helpers.arrayElements(strays, STALE_DONE_COUNT).map((w) => w.id));
  if (stale.size !== STALE_DONE_COUNT) throw new Error(`need ${STALE_DONE_COUNT} stale «done» candidates, have ${strays.length}`);
  let result = out.map((w) => (overdue.has(w.id) ? unpaid(w, 'scheduled') : stale.has(w.id) ? unpaid(w, 'done') : w));

  // At least one order waits for a part. If the status table drew none, the latest finished
  // order of the last week waits.
  if (!result.some((w) => w.status === 'waiting')) {
      const pick = result
      .filter((w) => ordinary(w) && !overdue.has(w.id) && !stale.has(w.id) && w.parts.length > 0 && endMs(w) <= nowMs && nowMs - endMs(w) <= 7 * MS_DAY)
      .sort((a, b) => endMs(b) - endMs(a) || (a.id < b.id ? -1 : 1))[0];
    if (!pick) throw new Error('no order can be waiting for a part');
    const part = awaitedPart(pick.parts);
    const waiting = unpaid(pick, 'waiting');
    result = result.map((w) => (w.id === pick.id ? { ...waiting, notes: `${waiting.notes}\nЖдёт запчасть: ${part}` } : w));
  }

  return result.sort(byDateThenId);
}
