import type { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CalendarBlocksService } from '../../src/calendar-blocks/calendar-blocks.service';
import { ClientsService } from '../../src/clients/clients.service';
import { LaborLine } from '../../src/entities/labor-line.entity';
import { PartLine } from '../../src/entities/part-line.entity';
import { WorkOrder } from '../../src/entities/work-order.entity';
import { PartTemplatesService } from '../../src/part-templates/part-templates.service';
import { SettingsService } from '../../src/settings/settings.service';
import { PriceListService } from '../../src/task-templates/price-list.service';
import { TaskTemplatesService } from '../../src/task-templates/task-templates.service';
import { UsersService } from '../../src/users/users.service';
import { VehiclesService } from '../../src/vehicles/vehicles.service';
import { MINI_GENERATIONS } from './data/generations';
import { partByKey, taskByKey } from './generators/catalog';
import { windowStartDay } from './generators/schedule';
import type { ProgressLog } from './log';
import type { DemoPlan } from './plan';
import { assignDocNumbers, toLaborRow, toPartRow, toWorkOrderRow } from './rows';
import { mskAt } from './time';

const ORDER_CHUNK = 200;
const LINE_CHUNK = 500;

/** Tables reported in the summary, in write order. */
const COUNTED = [
  'users',
  'settings',
  'task_templates',
  'part_templates',
  'template_generation_prices',
  'task_template_parts',
  'clients',
  'vehicles',
  'work_orders',
  'labor_lines',
  'part_lines',
  'calendar_blocks',
  'vehicle_generations',
];

/**
 * The services do not take an id; the plan's ids (demoId) are what HERO and the video refer to.
 * Raw SQL does not touch updated_at, and nothing references a row created a moment ago.
 */
async function rekey(ds: DataSource, table: string, from: string, to: string): Promise<void> {
  if (from === to) return;
  const [, affected] = (await ds.query(`UPDATE "${table}" SET id = $2 WHERE id = $1`, [from, to])) as [unknown, number];
  if (affected !== 1) throw new Error(`rekey ${table} ${from} → ${to}: ${affected} rows`);
}

function chunks<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** One `UPDATE … FROM (VALUES …)`; refuses if any row is missing. */
async function backdate(ds: DataSource, table: string, sets: string[], rows: [string, Date][]): Promise<void> {
  if (rows.length === 0) return;
  const values = rows.map((_, i) => `($${2 * i + 1}::uuid, $${2 * i + 2}::timestamptz)`).join(', ');
  const assign = sets.map((c) => `"${c}" = x.t`).join(', ');
  const [, affected] = (await ds.query(
    `UPDATE "${table}" AS r SET ${assign} FROM (VALUES ${values}) AS x(id, t) WHERE r.id = x.id`,
    rows.flatMap(([id, t]) => [id, t]),
  )) as [unknown, number];
  if (affected !== rows.length) throw new Error(`backdate ${table}: ${affected} of ${rows.length} rows`);
}

export async function writeDemoPlan(
  app: INestApplicationContext,
  plan: DemoPlan,
  password: string,
  log: ProgressLog,
): Promise<Record<string, number>> {
  const ds = app.get(DataSource);

  log.stage('staff');
  const users = app.get(UsersService);
  for (const s of plan.staff) {
    const saved = await users.createUser({ name: s.name, login: s.login, password, role: s.role });
    await rekey(ds, 'users', saved.id, s.id);
  }
  const owner = plan.staff.find((s) => s.role === 'owner');
  if (!owner) throw new Error('plan has no owner');

  log.stage('settings');
  const settings = app.get(SettingsService);
  for (const [key, value] of Object.entries(plan.settings)) await settings.set(key, value);

  log.stage('catalog');
  const genRows = (await ds.query(`SELECT id, code FROM vehicle_generations WHERE make = 'MINI'`)) as { id: string; code: string | null }[];
  const genId = new Map(genRows.filter((g) => g.code).map((g) => [g.code as string, g.id]));
  const missing = MINI_GENERATIONS.map((g) => g.code).filter((c) => !genId.has(c));
  if (missing.length > 0) throw new Error(`vehicle_generations: нет поколений MINI ${missing.join(', ')}`);
  const gen = (code: string): string => {
    const id = genId.get(code);
    if (!id) throw new Error(`unknown generation ${code}`);
    return id;
  };

  const templates = app.get(TaskTemplatesService);
  for (const t of plan.catalog.tasks) {
    await templates.create({ id: t.id, name: t.name, default_hours: t.default_hours, default_price: t.default_price, active: true });
  }
  const partTemplates = app.get(PartTemplatesService);
  for (const p of plan.catalog.parts) {
    const saved = await partTemplates.create({
      name: p.name,
      manufacturer: p.manufacturer,
      catalog_number: p.catalog_number,
      unit: p.unit,
      default_price: p.default_price,
      active: true,
    });
    await rekey(ds, 'part_templates', saved.id, p.id);
  }
  const priceList = app.get(PriceListService);
  for (const o of plan.catalog.overrides) {
    const saved = await priceList.setPrice(taskByKey(plan.catalog, o.task).id, gen(o.generation), { hours: o.hours, price: o.price });
    await rekey(ds, 'template_generation_prices', saved.id, o.id);
  }
  for (const l of plan.catalog.links) {
    const saved = await priceList.attachPart(taskByKey(plan.catalog, l.task).id, partByKey(plan.catalog, l.part).id, {
      generation_id: l.generation === null ? null : gen(l.generation),
      qty: l.qty,
      is_default: l.is_default,
      slot: l.slot,
    });
    await rekey(ds, 'task_template_parts', saved.id, l.id);
  }

  log.stage('clients');
  const clients = app.get(ClientsService);
  for (const c of plan.clients) {
    const saved = await clients.create({
      full_name: c.full_name,
      phone: c.phone,
      source: c.source,
      discount_default_pct: c.discount_default_pct,
      notes: c.notes,
      created_at: c.created_at,
      imported_deals_count: c.imported_deals_count,
      imported_deals_sum: c.imported_deals_sum,
    });
    await rekey(ds, 'clients', saved.id, c.id);
  }

  log.stage('vehicles');
  const vehicles = app.get(VehiclesService);
  for (const v of plan.vehicles) {
    const saved = await vehicles.create({
      client_id: v.client_id,
      vin: v.vin,
      make: v.make,
      model: v.model ?? undefined,
      generation_id: v.generationCode === null ? null : gen(v.generationCode),
      plate: v.plate,
      year: v.year,
      mileage: v.mileage,
    });
    await rekey(ds, 'vehicles', saved.id, v.id);
  }

  log.stage('orders');
  const orders = plan.workOrders;
  const laborRows = orders.flatMap((w) => w.labor.map((l) => toLaborRow(l, w.id)));
  const partRows = orders.flatMap((w) => w.parts.map((p) => toPartRow(p, w.id)));
  await ds.transaction(async (m) => {
    // Numbers come from the app's own sequence, one per close, in close order — as if each order had
    // been closed through WorkOrdersCoreService.applyFreezeTransition on its closed_at.
    const closed = orders.filter((w) => w.status === 'closed');
    const seq = (await m.query(`SELECT nextval('work_order_doc_number_seq') AS n FROM generate_series(1, $1)`, [
      closed.length,
    ])) as { n: string }[];
    const docs = assignDocNumbers(
      closed.map((w) => {
        if (!w.closed_at) throw new Error(`closed order ${w.id} without closed_at`);
        return { id: w.id, closed_at: w.closed_at };
      }),
      seq.map((r) => Number(r.n)),
    );
    let done = 0;
    for (const chunk of chunks(orders, ORDER_CHUNK)) {
      await m.insert(WorkOrder, chunk.map((w) => toWorkOrderRow(w, docs.get(w.id) ?? null)));
      done += chunk.length;
      log.progress('orders', done, orders.length);
    }
    done = 0;
    for (const chunk of chunks(laborRows, LINE_CHUNK)) {
      await m.insert(LaborLine, chunk);
      done += chunk.length;
      log.progress('labor_lines', done, laborRows.length);
    }
    done = 0;
    for (const chunk of chunks(partRows, LINE_CHUNK)) {
      await m.insert(PartLine, chunk);
      done += chunk.length;
      log.progress('part_lines', done, partRows.length);
    }
  });

  log.stage('blocks');
  const blocks = app.get(CalendarBlocksService);
  for (const b of plan.blocks) {
    const saved = await blocks.create(
      { title: b.title, starts_at: b.starts_at.toISOString(), duration_min: b.duration_min, user_id: b.user_id, notes: b.notes },
      { id: owner.id, role: 'owner' },
    );
    await rekey(ds, 'calendar_blocks', saved.id, b.id);
  }

  log.stage('backdate');
  await ds.query(`UPDATE "clients" SET updated_at = created_at`);
  await backdate(ds, 'vehicles', ['created_at', 'updated_at'], plan.vehicles.map((v) => [v.id, v.created_at]));
  await ds.query(`UPDATE "settings" SET updated_at = $1`, [mskAt(windowStartDay(plan.demoNow), 9)]);
  await backdate(ds, 'calendar_blocks', ['created_at'], plan.blocks.map((b) => [b.id, b.created_at]));

  const counts: Record<string, number> = {};
  for (const t of COUNTED) {
    const [row] = (await ds.query(`SELECT count(*)::int AS n FROM "${t}"`)) as { n: number }[];
    counts[t] = row.n;
  }
  return counts;
}
