// `npm run fixtures` — exports what the Remotion scenes need from the running demo API (over the seeded
// demo database) into src/fixtures/*.json and public/docs/*.png. Deterministic: two exports of the same
// seed (`--now`) give byte-identical files (`npm run fixtures:check`). Nothing here reads the real clock
// into the output: «now» is settings.demo_now at 12:00 MSK.
//
// Env: DEMO_API_URL (e.g. http://127.0.0.1:3000/api), DEMO_PASSWORD (all demo logins), DATABASE_URL
// (the demo database: dashboard aggregates, and putting the database back after the hero copy).
// TZ must be Europe/Moscow (the npm script sets it): dayRangeIso builds the week in local time, as the
// calendar page does in the browser.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { HERO, heroSchedule } from '../../demo/seed/hero';
import { DEMO_HOUR, DEMO_SEED } from '../../demo/seed/config';
import { mskAt } from '../../demo/seed/time';
import { dayRangeIso } from '../../client/src/lib/schedule';
import type {
  LaborLine,
  PartLine,
  PriceListRow,
  TemplatePreview,
  VehicleGeneration,
  WorkOrder,
  WorkOrderStatus,
} from '../../client/src/lib/types';
import type { DashboardData } from '../../client/src/features/dashboard/types';

const ROOT = join(__dirname, '..');
const REPO = join(ROOT, '..');
const FIX = join(ROOT, 'src/fixtures');
const DOCS = join(ROOT, 'public/docs');

const SEQUENCES = ['work_order_doc_number_seq', 'work_order_order_number_seq'] as const;
const PRICE_GENERATIONS = ['R56', 'F56', 'F60'] as const;
const BOARD_CLOSED_KEEP = 6;
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH_LONG = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const API = env('DEMO_API_URL').replace(/\/+$/, '');
const PASSWORD = env('DEMO_PASSWORD');
const DATABASE_URL = env('DATABASE_URL');
// The exporter writes to this database (the hero copy) — same guard as the seed.
if (!/demo/i.test(new URL(DATABASE_URL).pathname)) throw new Error('DATABASE_URL must point at a *demo* database');

// ---------------------------------------------------------------- io

const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

function write(rel: string, data: unknown): void {
  const file = join(FIX, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function call<T>(token: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function pdf(token: string, path: string): Promise<Buffer> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function login(login: string): Promise<string> {
  const r = await call<{ access_token: string }>(null, 'POST', '/auth/login', { login, password: PASSWORD });
  return r.access_token;
}

/** PDF → one PNG at 200 dpi (first page), via poppler's pdftoppm. */
function pdfToPng(buf: Buffer, outPng: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'fixtures-pdf-'));
  try {
    const src = join(dir, 'doc.pdf');
    writeFileSync(src, buf);
    execFileSync('pdftoppm', ['-r', '200', '-png', '-singlefile', src, join(dir, 'page')]);
    mkdirSync(DOCS, { recursive: true });
    writeFileSync(outPng, readFileSync(join(dir, 'page.png')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- stable order

const cmp = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : 1;
};
const ts = (s: string | null | undefined) => (s ? new Date(s).getTime() : null);

/** The API's own order (scheduled_at, created_at) with id as the tie-break Postgres doesn't promise. */
const bySchedule = (a: WorkOrder, b: WorkOrder) =>
  cmp(ts(a.scheduled_at), ts(b.scheduled_at)) || cmp(ts(a.created_at), ts(b.created_at)) || cmp(a.id, b.id);

function trimBoard(board: Record<WorkOrderStatus, WorkOrder[]>): Record<WorkOrderStatus, WorkOrder[]> {
  const out = {} as Record<WorkOrderStatus, WorkOrder[]>;
  for (const [status, list] of Object.entries(board) as [WorkOrderStatus, WorkOrder[]][]) {
    out[status] =
      status === 'closed'
        ? [...list].sort((a, b) => cmp(ts(b.closed_at), ts(a.closed_at)) || cmp(a.id, b.id)).slice(0, BOARD_CLOSED_KEEP)
        : [...list].sort(bySchedule);
  }
  return out;
}

// ---------------------------------------------------------------- hero copy normalisation

type Line = (LaborLine | PartLine) & { created_at?: string };

/**
 * Stable names for the copy's database ids: `hero-copy`, `hero-line-<n>` (numbered as lines first
 * appear, by group_sort, labor before parts, sort — kept across snapshots), `hero-group-<n>` (apply-template draws a random
 * group_key). created_at/updated_at of the copy and its lines → DEMO_NOW.
 */
class HeroNormaliser {
  private readonly lines = new Map<string, string>();
  private readonly groups = new Map<string, string>();
  constructor(
    private readonly copyId: string,
    private readonly nowIso: string,
  ) {}

  private group(key: string | null): string | null {
    if (key == null) return null;
    if (!this.groups.has(key)) this.groups.set(key, `hero-group-${this.groups.size + 1}`);
    return this.groups.get(key)!;
  }

  apply(wo: WorkOrder): WorkOrder {
    const labor = (wo.labor_lines ?? []) as Line[];
    const parts = (wo.part_lines ?? []) as Line[];
    const fresh = [...labor.map((l) => ['l', l] as const), ...parts.map((p) => ['p', p] as const)]
      .filter(([, l]) => !this.lines.has(l.id))
      .sort(([ka, a], [kb, b]) => a.group_sort - b.group_sort || cmp(ka, kb) || a.sort - b.sort || cmp(ts(a.created_at), ts(b.created_at)));
    for (const [, l] of fresh) this.lines.set(l.id, `hero-line-${this.lines.size + 1}`);
    // Group names in order of block position, not of first sight in the arrays.
    for (const l of [...labor, ...parts].sort((a, b) => a.group_sort - b.group_sort)) this.group(l.group_key);

    const line = <T extends Line>(l: T): T => ({
      ...l,
      id: this.lines.get(l.id)!,
      work_order_id: 'hero-copy',
      group_key: this.group(l.group_key),
      ...('created_at' in l ? { created_at: this.nowIso } : {}),
    });
    const out = {
      ...wo,
      id: 'hero-copy',
      created_at: this.nowIso,
      ...('updated_at' in wo ? { updated_at: this.nowIso } : {}),
      labor_lines: (wo.labor_lines ?? []).map(line),
      part_lines: (wo.part_lines ?? []).map(line),
    } as WorkOrder;
    this.assertClean(out);
    return out;
  }

  /** No database id of the copy may leak into a fixture. */
  assertClean(x: unknown): void {
    const text = JSON.stringify(x);
    for (const raw of [this.copyId, ...this.lines.keys(), ...this.groups.keys()]) {
      if (text.includes(raw)) throw new Error(`hero fixture still contains ${raw}`);
    }
  }
}

// ---------------------------------------------------------------- dashboard

function dashboardQueries(): Record<string, string> {
  const sql = readFileSync(join(ROOT, 'scripts/dashboard.sql'), 'utf8');
  const out: Record<string, string> = {};
  for (const chunk of sql.split(/^-- name: /m).slice(1)) {
    const nl = chunk.indexOf('\n');
    out[chunk.slice(0, nl).trim()] = chunk.slice(nl + 1);
  }
  return out;
}

async function buildDashboard(db: pg.Client, demoNow: Date): Promise<DashboardData> {
  const q = dashboardQueries();
  const run = async <R>(name: string) => (await db.query(q[name], [demoNow])).rows as R[];
  const months = await run<{ month: string; revenue: string }>('revenue_by_month');
  const [kpi] = await run<{ month: string; revenue: string; orders: number; prev_revenue: string }>('kpi');
  const load = await run<{ name: string; hours: string; capacity_hours: number }>('master_load');
  const top = await run<{ name: string; count: number; revenue: string }>('top_works');

  // The report month is the last full one (kpi.month); the chart's last point is the current month to date.
  const [y, m] = kpi.month.split('-').map(Number);
  if (months.at(-2)?.month !== kpi.month) throw new Error(`dashboard: report month ${kpi.month} is not the chart's second-to-last`);
  const revenue = round2(Number(kpi.revenue));
  const prev = Number(kpi.prev_revenue);
  return {
    month: `${MONTH_LONG[m - 1]} ${y}`,
    kpi: {
      revenue,
      orders: kpi.orders,
      avgTicket: kpi.orders > 0 ? Math.round(revenue / kpi.orders) : 0,
      revenueDeltaPct: prev > 0 ? round1(((revenue - prev) / prev) * 100) : 0,
    },
    revenueByMonth: months.map((r) => ({ month: MONTH_SHORT[Number(r.month.slice(5, 7)) - 1], revenue: round2(Number(r.revenue)) })),
    partialLast: true,
    masterLoad: load.map((r) => ({ name: r.name, hours: round1(Number(r.hours)), capacityHours: r.capacity_hours })),
    topWorks: top.map((r) => ({ name: r.name, count: r.count, revenue: round2(Number(r.revenue)) })),
  };
}

// ---------------------------------------------------------------- main

async function readSequences(db: pg.Client): Promise<Record<string, { v: string; called: boolean }>> {
  const out: Record<string, { v: string; called: boolean }> = {};
  for (const s of SEQUENCES) {
    const { rows } = await db.query(`SELECT last_value::text AS v, is_called FROM ${s}`);
    out[s] = { v: rows[0].v, called: rows[0].is_called };
  }
  return out;
}

function upstreamSha(): string {
  const rev = () => execFileSync('git', ['rev-parse', 'upstream/main'], { cwd: REPO, encoding: 'utf8' }).trim();
  try {
    return rev();
  } catch {
    execFileSync('git', ['fetch', 'upstream', 'main'], { cwd: REPO, stdio: 'ignore' });
    return rev();
  }
}

/** Drop every exported JSON (index.ts and the spec are sources and stay), so nothing stale survives. */
function clearExports(): void {
  rmSync(join(FIX, 'search'), { recursive: true, force: true });
  mkdirSync(FIX, { recursive: true });
  for (const f of readdirSync(FIX)) if (f.endsWith('.json')) rmSync(join(FIX, f));
}

/** Mon..Sun of DEMO_NOW's week as local midnights — what CalendarPage feeds dayRangeIso. */
function weekDays(now: Date): Date[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

async function main(): Promise<void> {
  const db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query(`SELECT value FROM settings WHERE key = 'demo_now'`);
    const day = rows[0]?.value as string | undefined;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`settings.demo_now missing: is the demo database seeded?`);
    const demoNow = mskAt(day, DEMO_HOUR);
    if (demoNow.getTimezoneOffset() !== -180) throw new Error(`run with TZ=Europe/Moscow (got offset ${demoNow.getTimezoneOffset()})`);
    const nowIso = demoNow.toISOString();

    clearExports();

    write('meta.json', { demoNow: nowIso, seed: DEMO_SEED, upstreamSha: upstreamSha(), exportedAt: nowIso });

    const owner = await login(HERO.logins.owner);
    const master = await login(HERO.logins.master);
    const get = <T>(path: string, token = owner) => call<T>(token, 'GET', path);

    write('settings.json', await get('/settings'));
    write('users.json', await get('/users'));
    const generations = await get<VehicleGeneration[]>('/vehicle-generations');
    write('generations.json', generations);
    write('templates.json', await get('/task-templates'));

    const { from, to } = dayRangeIso(weekDays(demoNow));
    const range = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const calendar = (await get<WorkOrder[]>(`/work-orders/calendar?${range}`)).sort(bySchedule);
    write('calendar.week.json', calendar);
    const blocks = (await get<{ id: string; starts_at: string }[]>(`/calendar-blocks?${range}`)).sort(
      (a, b) => cmp(ts(a.starts_at), ts(b.starts_at)) || cmp(a.id, b.id),
    );
    write('blocks.week.json', blocks);

    const boardOwner = trimBoard(await get('/work-orders/board'));
    const boardMaster = trimBoard(await get('/work-orders/board', master));
    write('board.owner.json', boardOwner);
    write('board.master.json', boardMaster);

    write('price-list.base.json', await get<PriceListRow[]>('/price-list'));
    for (const code of PRICE_GENERATIONS) {
      const gen = generations.find((g) => g.code === code);
      if (!gen) throw new Error(`generation ${code} not in /vehicle-generations`);
      write(`price-list.${code}.json`, await get<PriceListRow[]>(`/price-list?generation_id=${gen.id}`));
    }

    const all = await get<WorkOrder[]>('/work-orders');
    write('client-hero.json', {
      client: await get(`/clients/${HERO.client.id}`),
      vehicles: await get(`/clients/${HERO.client.id}/vehicles`),
      orders: all
        .filter((w) => w.vehicle?.client?.id === HERO.client.id)
        .sort((a, b) => cmp(ts(b.created_at), ts(a.created_at)) || cmp(a.id, b.id)),
    });

    for (let n = 1; n <= 7; n++) {
      const prefix = HERO.r56.vin.slice(0, n);
      write(`search/${prefix}.json`, await get(`/search?q=${encodeURIComponent(prefix)}`));
    }

    write('dashboard.json', await buildDashboard(db, demoNow));

    // ---- hero: real mutations on a copy of the closed diagnostics order, then put the database back.
    const seqBefore = await readSequences(db);
    const { freeSlot } = heroSchedule(demoNow);
    let copyId: string | null = null;
    try {
      const copy = await call<WorkOrder>(owner, 'POST', `/work-orders/${HERO.diagnosticsOrderId}/duplicate`, {});
      copyId = copy.id;
      // The API clock is real time; the order PDF prints created_at as the document date.
      await db.query(`UPDATE work_orders SET created_at = $2 WHERE id = $1`, [copyId, demoNow]);
      const norm = new HeroNormaliser(copyId, nowIso);
      const path = `/work-orders/${copyId}`;
      const snap = async (i: number) => {
        const wo = await get<WorkOrder>(path);
        write(`wo-hero.${i}.json`, norm.apply(wo));
        return wo;
      };

      await call(owner, 'PATCH', path, {
        title: 'Замена цепи ГРМ',
        scheduled_at: freeSlot.startsAt.toISOString(),
        scheduled_duration_min: freeSlot.durationMin,
        assigned_master_id: HERO.masterId,
      });
      await snap(0);

      const preview = await get<TemplatePreview>(`${path}/template-preview?template_id=${HERO.templates.timingChain}`);
      if (!preview.parts.some((p) => p.part_template_id === HERO.parts.oil5w30 && p.is_default)) {
        throw new Error('template preview: oil 5W-30 is not a default part — the scene unticks it');
      }
      norm.assertClean(preview);
      write('template-preview.json', preview);

      // What the modal sends after unticking the oil: the default parts minus HERO.parts.oil5w30.
      const picked = preview.parts.filter((p) => p.is_default && p.part_template_id !== HERO.parts.oil5w30);
      await call(owner, 'POST', `${path}/apply-template`, {
        template_id: HERO.templates.timingChain,
        part_template_ids: picked.map((p) => p.part_template_id),
      });
      const w1 = await snap(1);
      const got = (w1.part_lines ?? []).map((p) => p.part_template_id).sort();
      const want = picked.map((p) => p.part_template_id).sort();
      if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`wo-hero.1 parts ${got} ≠ picked ${want}`);

      const kit = (w1.part_lines ?? []).find((p) => p.part_template_id === HERO.parts.chainKit);
      if (!kit) throw new Error('chain kit line missing after apply-template');
      await call(owner, 'PATCH', `${path}/parts/${kit.id}`, { discount_type: 'percent', discount_value: 10 });
      await snap(2);

      await call(owner, 'PATCH', path, { discount_type: 'percent', discount_value: 5 });
      await snap(3);

      await call(owner, 'PATCH', `${path}/status`, { status: 'in_progress' });
      await snap(4);

      pdfToPng(await pdf(owner, `${path}/order-pdf`), join(DOCS, 'order-pdf.png'));

      // The estimate of the SAME order (the Docs scene fans it out behind the order PDF): close the
      // copy (freezes the total, draws doc_number from work_order_doc_number_seq — given back below),
      // pin the API-clock closed_at to DEMO_NOW, render, and let `finally` delete the copy.
      await call(owner, 'POST', `${path}/close`, {});
      await db.query(`UPDATE work_orders SET closed_at = $2 WHERE id = $1`, [copyId, demoNow]);
      pdfToPng(await pdf(owner, `${path}/pdf`), join(DOCS, 'smeta.png'));
    } finally {
      if (copyId) await call(owner, 'DELETE', `/work-orders/${copyId}`);
      // order-pdf drew a number for the copy; give it back so the database ends as it started.
      for (const s of SEQUENCES) {
        const { v, called } = seqBefore[s];
        await db.query(`SELECT setval($1, $2::bigint, $3)`, [s, v, called]);
      }
    }
    const seqAfter = await readSequences(db);
    if (JSON.stringify(seqAfter) !== JSON.stringify(seqBefore)) throw new Error('sequences not restored');
    process.stdout.write(`fixtures: exported to ${FIX} and ${DOCS} (demoNow ${nowIso})\n`);
  } finally {
    await db.end();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`export-fixtures failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
