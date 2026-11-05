import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { DemoSeedModule } from './demo-seed.module';
import { DemoSeedRefusal, assertCanSeed, type SafeEnv, type SeedArgs } from './guards';
import { heroSchedule } from './hero';
import { createProgressLog } from './log';
import { buildDemoPlan } from './plan';
import { resetDemoDb } from './reset';
import { writeDemoPlan } from './writer';

/** Loaded only after the guards passed: this file pulls in src/ (and with it dotenv). */
export async function runDemoSeed(args: SeedArgs & SafeEnv): Promise<void> {
  if (!args.demoPassword) throw new DemoSeedRefusal('DEMO_PASSWORD обязателен для сида.');
  const log = createProgressLog();
  const app = await NestFactory.createApplicationContext(DemoSeedModule.forUrl(args.databaseUrl), {
    logger: ['error', 'warn'],
  });
  try {
    // Migrations have already run (migrationsRun: true) before assertCanSeed: the row counts need the
    // schema, and the guards let only a database named *demo* this far.
    const ds = app.get(DataSource);
    const [row] = (await ds.query(
      `SELECT (SELECT count(*) FROM clients)::int AS clients, (SELECT count(*) FROM work_orders)::int AS work_orders`,
    )) as { clients: number; work_orders: number }[];
    assertCanSeed(row, args.force);
    // Build first: a plan that throws must not leave the database already wiped.
    log.stage(`plan (--now=${args.demoDay})`);
    const plan = buildDemoPlan(args.demoNow);
    log.stage('reset');
    await resetDemoDb(ds);
    const counts = await writeDemoPlan(app, plan, args.demoPassword, log);
    log.summary(counts, heroSchedule(plan.demoNow));
  } finally {
    await app.close();
  }
}
