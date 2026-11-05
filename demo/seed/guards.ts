// Guards for the demo seed (it TRUNCATEs tables). Deliberately free of src/, dotenv, typeorm,
// @nestjs and faker: they must run BEFORE anything that could read .env or open a connection.
import { DEMO_HOUR } from './config';
import { mskAt, todayMsk } from './time';

export class DemoSeedRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoSeedRefusal';
  }
}

export interface SeedArgs {
  force: boolean;
  demoDay: string;
  demoNow: Date;
}

export interface SafeEnv {
  databaseUrl: string;
  demoPassword: string | null;
}

const EXAMPLE_URL = 'DATABASE_URL=postgres://crm:crm@localhost:5545/tatarin_demo';

export function parseArgs(argv: string[], realNow: Date): SeedArgs {
  let force = false;
  let demoDay = todayMsk(realNow);
  for (const arg of argv) {
    if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--now=')) {
      const v = arg.slice('--now='.length);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      const ok =
        m !== null &&
        (() => {
          const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
          const t = new Date(Date.UTC(y, mo - 1, d));
          return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
        })();
      if (!ok) throw new DemoSeedRefusal(`--now: ожидается реальная дата YYYY-MM-DD, получено «${v}»`);
      demoDay = v;
    } else {
      throw new DemoSeedRefusal(
        `Неизвестный аргумент «${arg}». Допустимы только --force и --now=YYYY-MM-DD (со знаком «=», без пробела).`,
      );
    }
  }
  return { force, demoDay, demoNow: mskAt(demoDay, DEMO_HOUR) };
}

export function dbNameOf(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    throw new DemoSeedRefusal(`DATABASE_URL не разобрать как URL. Пример: ${EXAMPLE_URL}`);
  }
  try {
    return decodeURIComponent(pathname.replace(/^\//, ''));
  } catch {
    throw new DemoSeedRefusal(`DATABASE_URL: имя базы не декодируется. Пример: ${EXAMPLE_URL}`);
  }
}

export function assertSafeEnv(env: NodeJS.ProcessEnv, opts: { requirePassword: boolean }): SafeEnv {
  if (env.NODE_ENV === 'production') {
    throw new DemoSeedRefusal('Отказ: NODE_ENV=production. Сид стирает таблицы и не запускается в production.');
  }
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new DemoSeedRefusal(
      `DATABASE_URL должен быть задан явно, .env не читается: ${EXAMPLE_URL}`,
    );
  }
  const name = dbNameOf(databaseUrl);
  if (!name.toLowerCase().includes('demo')) {
    throw new DemoSeedRefusal(
      `Отказ: имя базы «${name}» не содержит «demo». Сид работает только с демо-базой, например ${EXAMPLE_URL}`,
    );
  }
  const demoPassword = env.DEMO_PASSWORD ? env.DEMO_PASSWORD : null;
  if (opts.requirePassword && demoPassword === null) {
    throw new DemoSeedRefusal('DEMO_PASSWORD обязателен для сида: DEMO_PASSWORD=<пароль демо-пользователей>');
  }
  return { databaseUrl, demoPassword };
}

export function assertCanSeed(counts: { clients: number; work_orders: number }, force: boolean): void {
  if (force) return;
  if (counts.clients > 0 || counts.work_orders > 0) {
    throw new DemoSeedRefusal(
      `База не пуста (клиентов: ${counts.clients}, нарядов: ${counts.work_orders}). ` +
        'Сид стирает все таблицы; чтобы продолжить, добавьте --force.',
    );
  }
}
