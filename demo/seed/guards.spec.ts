import { DemoSeedRefusal, assertCanSeed, assertSafeEnv, dbNameOf, parseArgs } from './guards';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { importClosure } from './test-utils/import-closure';

const ok = { DATABASE_URL: 'postgres://crm:crm@localhost:5545/tatarin_demo', DEMO_PASSWORD: 'demo-pass' };
const seedOpts = { requirePassword: true };

describe('assertSafeEnv', () => {
  it('refuses NODE_ENV=production', () =>
    expect(() => assertSafeEnv({ ...ok, NODE_ENV: 'production' }, seedOpts)).toThrow(/NODE_ENV=production/));
  it.each([['Production'], [' production '], ['PRODUCTION']])('refuses NODE_ENV=%p after normalising', (v) =>
    expect(() => assertSafeEnv({ ...ok, NODE_ENV: v }, seedOpts)).toThrow(/NODE_ENV=production/));
  it('refuses a URL without a database path', () =>
    expect(() => assertSafeEnv({ ...ok, DATABASE_URL: 'postgres://h:1' }, seedOpts)).toThrow(DemoSeedRefusal));
  it('refuses a missing or empty DATABASE_URL', () => {
    expect(() => assertSafeEnv({ DEMO_PASSWORD: 'x' }, seedOpts)).toThrow(/DATABASE_URL/);
    expect(() => assertSafeEnv({ ...ok, DATABASE_URL: '' }, seedOpts)).toThrow(/DATABASE_URL/);
  });
  it('refuses a database name without demo', () =>
    expect(() =>
      assertSafeEnv({ ...ok, DATABASE_URL: 'postgres://crm:crm@localhost:5544/tatarin_crm' }, seedOpts),
    ).toThrow(/tatarin_crm/));
  it('looks only at the database name, not host/user/query', () =>
    expect(() =>
      assertSafeEnv(
        { ...ok, DATABASE_URL: 'postgres://demo:demo@demo-host:5432/tatarin_crm?application_name=demo' },
        seedOpts,
      ),
    ).toThrow());
  it('refuses an unparseable DATABASE_URL', () =>
    expect(() => assertSafeEnv({ ...ok, DATABASE_URL: 'not a url' }, seedOpts)).toThrow(DemoSeedRefusal));
  it('accepts a demo database with query params', () =>
    expect(assertSafeEnv({ ...ok, DATABASE_URL: ok.DATABASE_URL + '?sslmode=disable' }, seedOpts).databaseUrl).toContain(
      'tatarin_demo',
    ));
  it('requires DEMO_PASSWORD for seeding only', () => {
    expect(() => assertSafeEnv({ DATABASE_URL: ok.DATABASE_URL }, seedOpts)).toThrow(/DEMO_PASSWORD/);
    expect(assertSafeEnv({ DATABASE_URL: ok.DATABASE_URL }, { requirePassword: false }).demoPassword).toBeNull();
  });
});

describe('dbNameOf', () => {
  it.each([['postgres://h:1'], ['postgres://h:1/']])('refuses %p (no database name)', (u) =>
    expect(() => dbNameOf(u)).toThrow(DemoSeedRefusal));
  it('decodes the pathname and ignores query', () => {
    expect(dbNameOf('postgres://u:p@h:1/tatarin_demo?x=/other')).toBe('tatarin_demo');
    expect(dbNameOf('postgres://u:p@h:1/tatarin%5Fdemo')).toBe('tatarin_demo');
  });
});

describe('parseArgs', () => {
  it('defaults to today in Moscow at 12:00', () => {
    const a = parseArgs([], new Date('2026-11-04T22:30:00Z'));
    expect(a).toEqual({ force: false, demoDay: '2026-11-05', demoNow: new Date('2026-11-05T09:00:00.000Z') });
  });
  it('parses --force and --now=', () =>
    expect(parseArgs(['--now=2026-11-04', '--force'], new Date())).toMatchObject({ force: true, demoDay: '2026-11-04' }));
  it.each([['--froce'], ['--now'], ['--now=2026-13-01'], ['--now=2026-02-30'], ['--now', '2026-11-04'], ['extra'], ['--now='], ['--now=A'.replace('A', '2026-11-04'), '--now=2026-11-05'], ['--force', '--force']])(
    'rejects %p',
    (...argv) => expect(() => parseArgs(argv, new Date())).toThrow(DemoSeedRefusal),
  );
});

describe('assertCanSeed', () => {
  it('refuses a non-empty database without --force', () => {
    expect(() => assertCanSeed({ clients: 1, work_orders: 0 }, false)).toThrow(/--force/);
    expect(() => assertCanSeed({ clients: 0, work_orders: 3 }, false)).toThrow(/--force/);
    expect(() => assertCanSeed({ clients: 5, work_orders: 3 }, true)).not.toThrow();
    expect(() => assertCanSeed({ clients: 0, work_orders: 0 }, false)).not.toThrow();
  });
});

const FORBIDDEN = /[\\/]src[\\/]|^src[\\/]|^dotenv|^typeorm|^@nestjs|^@faker-js/;

describe('import graph', () => {
  it('guards never pull in src/, dotenv, typeorm, nest or faker', () => {
    const deps = importClosure(require.resolve('./guards'));
    expect(deps.some((d) => d.endsWith('time.ts'))).toBe(true); // the walk really recurses
    expect(deps.filter((d) => FORBIDDEN.test(d))).toEqual([]);
  });
  it('tripwire fires: the filter flags typeorm and bare src/ imports (negative control)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'closure-'));
    try {
      writeFileSync(join(dir, 'a.ts'), "import { X } from 'typeorm';\nimport { Y } from './b';\n");
      writeFileSync(join(dir, 'b.ts'), "import { AppDataSource } from 'src/x';\nconst d = require('dotenv');\n");
      const deps = importClosure(join(dir, 'a.ts'));
      expect(deps.filter((d) => FORBIDDEN.test(d)).sort()).toEqual(['dotenv', 'src/x', 'typeorm']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('walks bare src/ specifiers that resolve inside the repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'closure-'));
    try {
      writeFileSync(join(dir, 'a.ts'), "import { s } from 'src/data-source';\n");
      expect(importClosure(join(dir, 'a.ts')).some((d) => /[\\/]src[\\/]data-source\.ts$/.test(d))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
