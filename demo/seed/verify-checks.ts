// seed:demo:verify — checks the seeded demo database against the app's own code. Loaded only after
// the guards in verify.ts have passed: this file pulls in src/ (and with it dotenv).
import { createHash } from 'crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClientsService } from '../../src/clients/clients.service';
import type { CreateWorkOrderDto } from '../../src/work-orders/dto/work-order.dto';
import { WorkOrderLinesService } from '../../src/work-orders/work-order-lines.service';
import { WorkOrdersCoreService } from '../../src/work-orders/work-orders-core.service';
import { WorkOrdersService } from '../../src/work-orders/work-orders.service';
import { VehiclesService } from '../../src/vehicles/vehicles.service';
import { DEMO_HOUR } from './config';
import { resolveTemplatePartsPlan } from './generators/catalog';
import { heroSchedule } from './hero';
import { buildDemoPlan } from './plan';
import { categoryShare, deseasonalizedGrowth, fullMonthsInWindow, geoMean, monthlyRevenue, paretoShare, ticketStats } from './stats';
import { monthKey, mskAt } from './time';
import type { WorkOrderPlan, WorkOrderStatus } from './types';

// ---------------------------------------------------------------- pure checks

const STATUSES = ['scheduled', 'in_progress', 'waiting', 'done', 'closed'];
const SHOW = 10;

/** «label: N — id1, id2, … (+k)»; null when there is nothing to report. */
function listed(label: string, ids: string[]): string | null {
  if (ids.length === 0) return null;
  const more = ids.length > SHOW ? ` (+${ids.length - SHOW})` : '';
  return `${label}: ${ids.length} — ${ids.slice(0, SHOW).join(', ')}${more}`;
}

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Closed orders carry 1..N without gaps, handed out in close order — (closed_at, id), the order
 * WorkOrdersCoreService would have used closing them one by one; open orders carry none.
 */
export function checkDocNumbers(
  rows: { id?: string; doc_number: number | null; closed_at: Date | null; status: string }[],
): string[] {
  const out: string[] = [];
  const name = (r: { id?: string; doc_number: number | null }) => r.id ?? `№${r.doc_number}`;
  const open = rows.filter((r) => r.status !== 'closed' && r.doc_number !== null);
  const o = listed('doc_number у незакрытых нарядов', open.map(name));
  if (o) out.push(o);

  const closed = rows.filter((r) => r.status === 'closed');
  const nums = closed.map((r) => r.doc_number).filter((n): n is number => n !== null).sort((a, b) => a - b);
  if (nums.length !== closed.length || nums.some((n, i) => n !== i + 1)) {
    const head = nums.slice(0, SHOW).join(', ');
    out.push(`doc_number закрытых не 1..${closed.length} подряд: ${nums.length} номеров (${head}${nums.length > SHOW ? ', …' : ''})`);
  }

  const seq = closed
    .filter((r) => r.doc_number !== null && r.closed_at !== null)
    .sort((a, b) => (a.closed_at as Date).getTime() - (b.closed_at as Date).getTime() || byCode(a.id ?? '', b.id ?? ''));
  const broken = seq.filter((r, i) => i > 0 && (r.doc_number as number) <= (seq[i - 1].doc_number as number));
  const b = listed('doc_number не растёт вместе с (closed_at, id)', broken.map(name));
  if (b) out.push(b);
  return out;
}

/** Closed: total_frozen = paid_amount = total_cached and closed_at set. Open: none of that. */
export function checkClosedTotals(
  rows: { id?: string; status: string; total_cached: number; total_frozen: number | null; paid_amount: number; closed_at: Date | null }[],
): string[] {
  const out: string[] = [];
  rows.forEach((r, i) => {
    const id = r.id ?? `#${i}`;
    if (r.status === 'closed') {
      if (r.total_frozen !== r.total_cached) out.push(`${id}: closed, total_frozen ${r.total_frozen} ≠ total_cached ${r.total_cached}`);
      if (r.paid_amount !== r.total_cached) out.push(`${id}: closed, paid_amount ${r.paid_amount} ≠ total_cached ${r.total_cached}`);
      if (r.closed_at === null) out.push(`${id}: closed без closed_at`);
    } else {
      if (r.total_frozen !== null) out.push(`${id}: ${r.status}, но total_frozen ${r.total_frozen}`);
      if (r.paid_amount !== 0) out.push(`${id}: ${r.status}, но paid_amount ${r.paid_amount}`);
      if (r.closed_at !== null) out.push(`${id}: ${r.status}, но closed_at ${r.closed_at.toISOString()}`);
    }
  });
  return out;
}

/** created ≤ scheduled, created ≤ updated ≤ DEMO_NOW; closed: scheduled ≤ closed_at ≤ updated. */
export function checkDates(
  rows: { id?: string; status: string; created_at: Date; scheduled_at: Date; closed_at: Date | null; updated_at: Date }[],
  demoNow: Date,
): string[] {
  const out: string[] = [];
  rows.forEach((r, i) => {
    const id = r.id ?? `#${i}`;
    if (r.created_at > r.scheduled_at) out.push(`${id}: created_at позже scheduled_at`);
    if (r.created_at > r.updated_at) out.push(`${id}: created_at позже updated_at`);
    if (r.updated_at > demoNow) out.push(`${id}: updated_at позже DEMO_NOW`);
    if (r.status !== 'closed') return;
    if (r.closed_at === null) out.push(`${id}: closed без closed_at`);
    else {
      if (r.closed_at < r.scheduled_at) out.push(`${id}: closed_at раньше scheduled_at`);
      if (r.closed_at > r.updated_at) out.push(`${id}: closed_at позже updated_at`);
    }
  });
  return out;
}

export interface PartRow {
  part_template_id: string;
  qty: number;
  is_default: boolean;
}

/** Compares as sets keyed by part_template_id; null when equal, else what is missing, extra or different. */
export function diffPartSets(expected: PartRow[], actual: PartRow[]): string | null {
  const exp = new Map(expected.map((p) => [p.part_template_id, p]));
  const act = new Map(actual.map((p) => [p.part_template_id, p]));
  const out: string[] = [];
  if (exp.size !== expected.length) out.push('план: деталь повторяется');
  if (act.size !== actual.length) out.push('приложение: деталь повторяется');
  for (const [id, e] of exp) {
    const a = act.get(id);
    if (!a) out.push(`нет ${id}`);
    else {
      if (a.qty !== e.qty) out.push(`${id} qty ${a.qty} ≠ ${e.qty}`);
      if (a.is_default !== e.is_default) out.push(`${id} is_default ${a.is_default} ≠ ${e.is_default}`);
    }
  }
  for (const id of act.keys()) if (!exp.has(id)) out.push(`лишняя ${id}`);
  return out.length ? out.join('; ') : null;
}

const money = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Every status (zeros included) and every month: orders by scheduled_at, revenue by closed_at (MSK). */
export function formatDistribution(
  byStatus: Record<string, number>,
  byMonth: { month: string; orders: number; revenue: number }[],
): string {
  const statuses = [...STATUSES, ...Object.keys(byStatus).filter((s) => !STATUSES.includes(s)).sort()];
  const lines = ['Наряды по статусам:'];
  for (const s of statuses) lines.push(`  ${s.padEnd(12)}${String(byStatus[s] ?? 0).padStart(6)}`);
  lines.push('По месяцам (MSK): наряды по scheduled_at, выручка — total_frozen по closed_at:');
  lines.push(`  ${'месяц'.padEnd(8)}${'наряды'.padStart(8)}${'выручка'.padStart(14)}`);
  for (const m of byMonth) lines.push(`  ${m.month.padEnd(8)}${String(m.orders).padStart(8)}${money(m.revenue).padStart(14)}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- fingerprint

const SEQUENCES = ['work_order_doc_number_seq', 'work_order_order_number_seq'];
const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * md5 per entity table (vehicle_generations included) plus both document-number sequences, read in
 * one READ ONLY snapshot with a fixed TimeZone/DateStyle so `row::text` does not depend on the session.
 * users.password_hash is left out: bcrypt salts it differently on every seed.
 */
export async function fingerprintParts(ds: DataSource): Promise<Record<string, string>> {
  const tables = [...new Set(ds.entityMetadatas.map((m) => m.tableName))].sort();
  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    await qr.startTransaction('REPEATABLE READ');
    await qr.query('SET TRANSACTION READ ONLY');
    await qr.query(`SET LOCAL TimeZone = 'UTC'`);
    await qr.query(`SET LOCAL DateStyle = 'ISO, YMD'`);
    const parts: Record<string, string> = {};
    for (const t of tables) {
      const cols = (await qr.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`,
        [t],
      )) as { column_name: string }[];
      const keep = cols.map((c) => c.column_name).filter((c) => !(t === 'users' && c === 'password_hash'));
      if (keep.length === 0) throw new Error(`fingerprint: таблица ${t} не найдена`);
      const [row] = (await qr.query(
        `SELECT count(*)::int AS n, md5(coalesce(string_agg(r::text, '|' ORDER BY r::text), '')) AS h
           FROM (SELECT ${keep.map(qi).join(', ')} FROM ${qi(t)}) r`,
      )) as { n: number; h: string }[];
      parts[t] = `${row.n} ${row.h}`;
    }
    for (const s of SEQUENCES) {
      const [row] = (await qr.query(`SELECT last_value::text AS v, is_called FROM ${qi(s)}`)) as { v: string; is_called: boolean }[];
      parts[`seq:${s}`] = `${row.v} ${row.is_called}`;
    }
    return parts;
  } finally {
    if (qr.isTransactionActive) await qr.rollbackTransaction();
    await qr.release();
  }
}

export function fingerprintOf(parts: Record<string, string>): string {
  const text = Object.keys(parts)
    .sort()
    .map((k) => `${k} ${parts[k]}`)
    .join('\n');
  return createHash('sha256').update(text).digest('hex');
}

export async function fingerprint(ds: DataSource): Promise<string> {
  return fingerprintOf(await fingerprintParts(ds));
}

// ---------------------------------------------------------------- runVerify

/** Tables whose row count must equal the plan rebuilt from settings.demo_now. */
const PLAN_TABLES = [
  'users',
  'clients',
  'vehicles',
  'work_orders',
  'labor_lines',
  'part_lines',
  'task_templates',
  'part_templates',
  'template_generation_prices',
  'task_template_parts',
  'calendar_blocks',
  'settings',
] as const;

const PROBE_PHONE = '+7 (555) 999-99-99';

interface OrderRow {
  id: string;
  status: WorkOrderStatus;
  client_id: string;
  assigned_master_id: string | null;
  scheduled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  total_cached: number;
  total_frozen: number | null;
  paid_amount: number;
  doc_number: number | null;
}

type Out = (line: string) => void;

export async function runVerify(
  app: INestApplicationContext,
  out: Out = (l) => process.stdout.write(`${l}\n`),
): Promise<{ errors: string[]; fingerprint: string }> {
  const ds = app.get(DataSource);
  const errors: string[] = [];

  const before = await fingerprintParts(ds);
  out(`fingerprint до проверок: ${fingerprintOf(before)}`);
  try {
    await runChecks(app, ds, errors, out);
  } finally {
    // Also when a check threw: the restores in `finally` blocks must have left the database as it was.
    const after = await fingerprintParts(ds);
    const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]);
    if (changed.length > 0) errors.push(`verify изменил базу: ${changed.join(', ')}`);
    out(`fingerprint после проверок: ${fingerprintOf(after)}`);
    if (changed.length > 0) out(`verify изменил базу: ${changed.join(', ')}`);
  }
  return { errors, fingerprint: fingerprintOf(before) };
}

async function runChecks(app: INestApplicationContext, ds: DataSource, errors: string[], out: Out): Promise<void> {
  const push = (xs: (string | null)[]) => xs.forEach((x) => x && errors.push(x));

  // 1. Exact counts against the plan rebuilt from the seeded day.
  const [nowRow] = (await ds.query(`SELECT value FROM settings WHERE key = 'demo_now'`)) as { value: string }[];
  if (!nowRow || !/^\d{4}-\d{2}-\d{2}$/.test(nowRow.value)) {
    errors.push(`settings.demo_now отсутствует или не дата: ${nowRow?.value ?? '—'}`);
    return;
  }
  const demoNow = mskAt(nowRow.value, DEMO_HOUR);
  out(`demo_now: ${nowRow.value}`);
  const plan = buildDemoPlan(demoNow);
  const expected: Record<(typeof PLAN_TABLES)[number], number> = {
    users: plan.staff.length,
    clients: plan.clients.length,
    vehicles: plan.vehicles.length,
    work_orders: plan.workOrders.length,
    labor_lines: plan.workOrders.reduce((s, w) => s + w.labor.length, 0),
    part_lines: plan.workOrders.reduce((s, w) => s + w.parts.length, 0),
    task_templates: plan.catalog.tasks.length,
    part_templates: plan.catalog.parts.length,
    template_generation_prices: plan.catalog.overrides.length,
    task_template_parts: plan.catalog.links.length,
    calendar_blocks: plan.blocks.length,
    settings: Object.keys(plan.settings).length,
  };
  out('Количества (база / план):');
  for (const t of PLAN_TABLES) {
    const [row] = (await ds.query(`SELECT count(*)::int AS n FROM ${qi(t)}`)) as { n: number }[];
    out(`  ${t.padEnd(28)}${String(row.n).padStart(6)} / ${expected[t]}`);
    if (row.n !== expected[t]) errors.push(`${t}: в базе ${row.n}, по плану ${expected[t]}`);
  }

  // 2. Orphans.
  const ids = async (sql: string) => ((await ds.query(sql)) as { id: string }[]).map((r) => r.id);
  push([
    listed('клиенты без машин', await ids(`SELECT c.id FROM clients c WHERE NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.client_id = c.id) ORDER BY c.id`)),
    listed(
      'наряды без строк',
      await ids(
        `SELECT w.id FROM work_orders w WHERE NOT EXISTS (SELECT 1 FROM labor_lines l WHERE l.work_order_id = w.id)
           AND NOT EXISTS (SELECT 1 FROM part_lines p WHERE p.work_order_id = w.id) ORDER BY w.id`,
      ),
    ),
    listed(
      'наряды без мастера или с мастером не в роли master',
      await ids(`SELECT w.id FROM work_orders w LEFT JOIN users u ON u.id = w.assigned_master_id WHERE u.id IS NULL OR u.role <> 'master' ORDER BY w.id`),
    ),
    listed(
      'строки деталей со ссылкой мимо каталога',
      await ids(
        `SELECT p.id FROM part_lines p WHERE p.part_template_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM part_templates t WHERE t.id = p.part_template_id) ORDER BY p.id`,
      ),
    ),
    listed(
      'строки работ со ссылкой мимо шаблонов',
      await ids(
        `SELECT l.id FROM labor_lines l WHERE l.template_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM task_templates t WHERE t.id = l.template_id) ORDER BY l.id`,
      ),
    ),
  ]);

  // 3. total_cached through the app's own recompute; both touched columns restored in one UPDATE.
  const core = app.get(WorkOrdersCoreService, { strict: false });
  const snap = (await ds.query(
    `SELECT id, total_cached::text AS total, updated_at::text AS updated FROM work_orders ORDER BY id`,
  )) as { id: string; total: string; updated: string }[];
  const mismatched: string[] = [];
  try {
    for (const r of snap) {
      const total = await core.recompute(r.id);
      if (total !== Number(r.total)) mismatched.push(`${r.id} (в базе ${r.total}, recompute ${total})`);
    }
  } finally {
    if (snap.length > 0) {
      const values = snap.map((_, i) => `($${3 * i + 1}::uuid, $${3 * i + 2}::numeric, $${3 * i + 3}::timestamptz)`).join(', ');
      const [, affected] = (await ds.query(
        `UPDATE work_orders AS w SET total_cached = x.total, updated_at = x.updated
           FROM (VALUES ${values}) AS x(id, total, updated) WHERE w.id = x.id`,
        snap.flatMap((r) => [r.id, r.total, r.updated]),
      )) as [unknown, number];
      if (affected !== snap.length) errors.push(`восстановление после recompute: ${affected} из ${snap.length} строк`);
    }
  }
  out(`recompute: ${snap.length} нарядов, расхождений ${mismatched.length}`);
  push([listed('total_cached ≠ WorkOrdersCoreService.recompute', mismatched)]);

  // 4. Frozen totals, document numbers, dates.
  const orders = (
    (await ds.query(
      `SELECT w.id, w.status, v.client_id, w.assigned_master_id, w.scheduled_at, w.created_at, w.updated_at, w.closed_at,
              w.total_cached::text AS total_cached, w.total_frozen::text AS total_frozen, w.paid_amount::text AS paid_amount, w.doc_number
         FROM work_orders w JOIN vehicles v ON v.id = w.vehicle_id ORDER BY w.id`,
    )) as (Omit<OrderRow, 'total_cached' | 'total_frozen' | 'paid_amount'> & { total_cached: string; total_frozen: string | null; paid_amount: string })[]
  ).map(
    (r): OrderRow => ({
      ...r,
      total_cached: Number(r.total_cached),
      total_frozen: r.total_frozen === null ? null : Number(r.total_frozen),
      paid_amount: Number(r.paid_amount),
      doc_number: r.doc_number === null ? null : Number(r.doc_number),
    }),
  );
  const noSchedule = orders.filter((o) => o.scheduled_at === null).map((o) => o.id);
  push([listed('наряды без scheduled_at', noSchedule)]);
  const scheduled = orders.filter((o): o is OrderRow & { scheduled_at: Date } => o.scheduled_at !== null);
  errors.push(...checkClosedTotals(orders), ...checkDocNumbers(orders), ...checkDates(scheduled, demoNow));

  // 5. The hero's free slot stays free.
  const { freeSlot } = heroSchedule(demoNow);
  const slotEnd = new Date(freeSlot.startsAt.getTime() + freeSlot.durationMin * 60_000);
  const inSlot = (
    (await ds.query(
      `SELECT id FROM work_orders WHERE scheduled_at IS NOT NULL
          AND tstzrange(scheduled_at, scheduled_at + coalesce(scheduled_duration_min, 0) * interval '1 minute') && tstzrange($1, $2)
       UNION ALL
       SELECT id FROM calendar_blocks WHERE tstzrange(starts_at, starts_at + duration_min * interval '1 minute') && tstzrange($1, $2)`,
      [freeSlot.startsAt, slotEnd],
    )) as { id: string }[]
  ).map((r) => r.id);
  out(`свободное окно ${freeSlot.startsAt.toISOString()}–${slotEnd.toISOString()}: занято ${inSlot.length}`);
  push([listed('свободное окно занято', inSlot)]);

  // 6. Template parts through the app's previewTemplate, for every generation and for none.
  errors.push(...(await checkTemplatePreviews(app, ds, plan, out)));

  // 7. Distribution and the statistics of Task 7.
  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  const revenue = monthlyRevenue(orders);
  const ordersByMonth = new Map<string, number>();
  for (const o of scheduled) ordersByMonth.set(monthKey(o.scheduled_at), (ordersByMonth.get(monthKey(o.scheduled_at)) ?? 0) + 1);
  const months = [...new Set([...ordersByMonth.keys(), ...revenue.keys()])].sort();
  out(formatDistribution(byStatus, months.map((m) => ({ month: m, orders: ordersByMonth.get(m) ?? 0, revenue: revenue.get(m) ?? 0 }))));
  errors.push(...(await checkStats(ds, plan, orders, scheduled, demoNow, nowRow.value, out)));
}

/**
 * A throwaway client, car and order made through the app's services; the car's generation_id is
 * switched by raw UPDATE. Removed by raw DELETE in `finally`; none of this touches a sequence.
 */
async function checkTemplatePreviews(app: INestApplicationContext, ds: DataSource, plan: ReturnType<typeof buildDemoPlan>, out: Out): Promise<string[]> {
  const owner = plan.staff.find((s) => s.role === 'owner');
  if (!owner) return ['план без owner'];
  const viewer = { id: owner.id, role: 'owner' as const };
  const lines = app.get(WorkOrderLinesService, { strict: false });
  const gens = (await ds.query(`SELECT id, code FROM vehicle_generations ORDER BY id`)) as { id: string; code: string | null }[];
  const tasks = (await ds.query(`SELECT id FROM task_templates ORDER BY id`)) as { id: string }[];
  const planTask = new Map(plan.catalog.tasks.map((t) => [t.id, t]));
  const diffs: string[] = [];
  let compared = 0;

  let clientId: string | null = null;
  let vehicleId: string | null = null;
  let woId: string | null = null;
  try {
    const client = await app.get(ClientsService, { strict: false }).create({ full_name: 'verify: пробный клиент', phone: PROBE_PHONE, source: 'manual' });
    clientId = client.id;
    const vehicle = await app.get(VehiclesService, { strict: false }).create({ client_id: client.id, make: 'MINI', generation_id: null });
    vehicleId = vehicle.id;
    const wo = await app.get(WorkOrdersService, { strict: false }).create({ vehicle_id: vehicle.id, title: 'verify: пробный наряд' } as CreateWorkOrderDto, viewer);
    woId = wo.id;

    for (const g of [{ id: null, code: null }, ...gens]) {
      await ds.query(`UPDATE vehicles SET generation_id = $1 WHERE id = $2`, [g.id, vehicle.id]);
      for (const t of tasks) {
        const task = planTask.get(t.id);
        if (!task) {
          diffs.push(`${t.id}: шаблона нет в плане`);
          continue;
        }
        const preview = await lines.previewTemplate(wo.id, t.id, viewer);
        const expected = resolveTemplatePartsPlan(plan.catalog, task.key, g.code).map((c) => ({ part_template_id: c.part.id, qty: c.qty, is_default: c.is_default }));
        const actual = preview.parts.map((p) => ({ part_template_id: p.part_template_id, qty: p.qty, is_default: p.is_default }));
        const d = diffPartSets(expected, actual);
        if (d) diffs.push(`${task.key} × ${g.code ?? 'без поколения'}: ${d}`);
        compared++;
      }
    }
  } finally {
    if (woId) await ds.query(`DELETE FROM work_orders WHERE id = $1`, [woId]);
    if (vehicleId) await ds.query(`DELETE FROM vehicles WHERE id = $1`, [vehicleId]);
    if (clientId) await ds.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
  }
  out(`previewTemplate: ${tasks.length} шаблонов × ${gens.length + 1} поколений (вкл. «без поколения») = ${compared} сравнений, расхождений ${diffs.length}`);
  const l = listed('детали шаблона ≠ previewTemplate', diffs);
  return l ? [l] : [];
}

/** The Task 7 thresholds (stats.spec.ts / sweep.spec.ts), measured on the database. */
async function checkStats(
  ds: DataSource,
  plan: ReturnType<typeof buildDemoPlan>,
  orders: OrderRow[],
  scheduled: (OrderRow & { scheduled_at: Date })[],
  demoNow: Date,
  demoDay: string,
  out: Out,
): Promise<string[]> {
  const errors: string[] = [];
  const f = (n: number) => n.toFixed(3);

  const months = fullMonthsInWindow(demoNow);
  const growth = deseasonalizedGrowth(monthlyRevenue(orders), months);
  const gm = growth.length ? geoMean(growth) : NaN;
  out(`Рост выручки м/м без сезона (${months.join(', ')}): ${growth.map(f).join(', ')}; среднее геом. ${f(gm)}`);
  // sweep.spec.ts asserts growth from the 5th on: earlier, the month just ended may still have unpaid
  // orders. On days 1–4 the thresholds apply when the rebuilt plan itself meets them (stats.spec.ts
  // pins 2026-11-04): the database must not do worse than the code that wrote it.
  const inBounds = (g: number[]) => g.length > 0 && geoMean(g) >= 1.03 && geoMean(g) <= 1.08 && g.every((r) => r >= 0.97 && r <= 1.15);
  if (Number(demoDay.slice(8, 10)) >= 5 || inBounds(deseasonalizedGrowth(monthlyRevenue(plan.workOrders), months))) {
    if (!(gm >= 1.03 && gm <= 1.08)) errors.push(`рост: среднее геом. ${f(gm)} вне [1.03, 1.08]`);
    growth.forEach((r, i) => {
      if (!(r >= 0.97 && r <= 1.15)) errors.push(`рост ${months[i]}→${months[i + 1]}: ${f(r)} вне [0.97, 1.15]`);
    });
  } else out('  (пороги роста не проверяются: начало месяца, и сам план их не выдерживает — как в sweep.spec.ts)');

  const pareto = paretoShare(orders, plan.clients.length);
  out(`Парето: топ-20% клиентов дают ${f(pareto)} нарядов`);
  if (!(pareto >= 0.45 && pareto <= 0.6)) errors.push(`Парето ${f(pareto)} вне [0.45, 0.6]`);

  const t = ticketStats(orders.map((o) => o.total_cached));
  out(`Чек: медиана ${money(t.median)}, среднее ${money(t.mean)}, p90 ${money(t.p90)}`);
  if (!(t.median / t.mean <= 0.8)) errors.push(`чек: медиана/среднее ${f(t.median / t.mean)} > 0.8`);
  if (!(t.p90 >= 2.5 * t.median)) errors.push(`чек: p90 ${t.p90} < 2.5 × медиана ${t.median}`);

  // categoryShare reads scheduled_at and labor[].template_id only.
  const labor = (await ds.query(`SELECT work_order_id, template_id FROM labor_lines`)) as { work_order_id: string; template_id: string | null }[];
  const byOrder = new Map<string, { template_id: string | null }[]>();
  for (const l of labor) byOrder.set(l.work_order_id, [...(byOrder.get(l.work_order_id) ?? []), { template_id: l.template_id }]);
  const withLabor = scheduled.map((o) => ({ scheduled_at: o.scheduled_at, labor: byOrder.get(o.id) ?? [] })) as unknown as WorkOrderPlan[];
  const oct = months.find((m) => m.endsWith('-10'));
  const jul = months.find((m) => m.endsWith('-07'));
  if (oct && jul) {
    const so = categoryShare(withLabor, oct, 'tires', plan.catalog);
    const sj = categoryShare(withLabor, jul, 'tires', plan.catalog);
    out(`Шины: доля работ ${oct} ${f(so)}, ${jul} ${f(sj)}`);
    if (!(so >= 3 * sj)) errors.push(`шины: ${oct} ${f(so)} < 3 × ${jul} ${f(sj)}`);
  }
  return errors;
}
