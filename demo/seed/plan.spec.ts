import { isUUID } from 'class-validator';
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import { promisify } from 'util';
import { CLIENTS_TOTAL } from './config';
import { HERO, heroSchedule } from './hero';
import { buildDemoPlan } from './plan';
import { planViolations } from './test-utils/plan-checks';
import { mskAt, mskDay } from './time';

const now = mskAt('2026-11-04', 12);
const plan = buildDemoPlan(now);

it('is deterministic', () => expect(buildDemoPlan(now)).toEqual(plan));
// The API validates some ids with IsUUID('4') (apply-template's part_template_ids): a v5-shaped
// demoId was rejected there with 400. Every uuid the plan writes must pass the same validator.
it('every uuid in the plan is version 4 (class-validator isUUID(…, "4"))', () => {
  const ids = [...new Set(JSON.stringify(plan).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [])];
  expect(ids.length).toBeGreaterThan(1000);
  expect(ids).toContain(HERO.parts.oil5w30);
  expect(ids.filter((id) => !isUUID(id, '4'))).toEqual([]);
});
it('does not depend on the host time zone', () => {
  const saved = process.env.TZ;
  try {
    process.env.TZ = 'UTC';
    const a = JSON.stringify(buildDemoPlan(now));
    process.env.TZ = 'America/Los_Angeles';
    const b = JSON.stringify(buildDemoPlan(now));
    expect(b).toBe(a);
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});
// Jest gives each test file its own copy of process.env, so the test above never reaches the host
// zone. Here every build runs in a child process started with its own TZ.
it('does not depend on the host time zone (child processes)', async () => {
  const run = promisify(execFile);
  const zones = ['UTC', 'America/Los_Angeles', 'Asia/Kamchatka'];
  const results = await Promise.all(
    zones.map(async (TZ) => {
      const { stdout } = await run(process.execPath, ['-r', 'ts-node/register', join(__dirname, 'test-utils/plan-fingerprint.ts'), '2026-11-04'], {
        cwd: join(__dirname, '../..'),
        env: { ...process.env, TZ, TS_NODE_TRANSPILE_ONLY: '1', TS_NODE_PROJECT: join(__dirname, '../../tsconfig.json') },
      });
      return JSON.parse(stdout) as { offset: number; hash: string };
    }),
  );
  expect(results.map((r) => r.offset)).toEqual([0, 480, -720]);
  const here = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  for (const r of results) expect(r.hash).toBe(here);
}, 120_000);
it.each(['2026-11-06', '2026-11-08', '2027-03-31', '2028-02-29'])('invariants hold for --now=%s', (day) => {
  const p = buildDemoPlan(mskAt(day, 12));
  expect(p.demoNow).toEqual(mskAt(day, 12));
  expect(p.settings.demo_now).toBe(day);
  expect(planViolations(p)).toEqual([]);
  const { busyDay } = heroSchedule(p.demoNow);
  expect(mskDay(p.workOrders.find((w) => w.id === HERO.bigOrder.id)!.scheduled_at)).toBe(busyDay);
});
it('settings are exactly the spec set', () =>
  expect(Object.keys(plan.settings).sort()).toEqual(
    [
      'labor_rate',
      'company_name',
      'company_inn',
      'company_address',
      'company_phone',
      'vat_rate',
      'working_hours_start',
      'working_hours_end',
      'slot_minutes',
      'default_appointment_min',
      'demo_now',
    ].sort(),
  ));
it('settings values', () =>
  expect(plan.settings).toEqual({
    labor_rate: '2200',
    company_name: 'ООО «Гараж»',
    company_inn: '',
    company_address: 'г. Москва, Промышленный проезд, д. 12, стр. 3',
    company_phone: '+7 (555) 000-00-00',
    vat_rate: '20',
    working_hours_start: '8',
    working_hours_end: '20',
    slot_minutes: '30',
    default_appointment_min: '60',
    demo_now: '2026-11-04',
  }));
it('assembles every part of the plan', () => {
  expect(plan.demoNow).toEqual(now);
  expect(plan.staff).toHaveLength(6);
  expect(plan.clients).toHaveLength(CLIENTS_TOTAL);
  expect(plan.vehicles.length).toBeGreaterThan(180);
  expect(plan.catalog.tasks.length).toBeGreaterThan(50);
  expect(plan.blocks.length).toBeGreaterThan(0);
  const vehicleIds = new Set(plan.vehicles.map((v) => v.id));
  expect(plan.workOrders.every((w) => vehicleIds.has(w.vehicle_id))).toBe(true);
});
