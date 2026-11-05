// Entry point: `npm run seed:demo:verify`. Checks the seeded demo database against the app's code and
// leaves it exactly as it found it (fingerprint before = after). Like demo-seed.ts, only ./guards is
// imported statically: src/data-source calls dotenv, which would fill DATABASE_URL from .env.
import { DemoSeedRefusal, assertSafeEnv } from './guards';

async function main() {
  const extra = process.argv.slice(2);
  if (extra.length > 0) throw new DemoSeedRefusal(`verify не принимает аргументов, получено: ${extra.join(' ')}`);
  const { databaseUrl } = assertSafeEnv(process.env, { requirePassword: false });
  await import('reflect-metadata');
  const { NestFactory } = await import('@nestjs/core');
  const { DemoSeedModule } = await import('./demo-seed.module'); // src/ (и dotenv) грузятся только здесь
  const { runVerify } = await import('./verify-checks');
  // migrationsRun: false — a reader never migrates the database it checks.
  const app = await NestFactory.createApplicationContext(DemoSeedModule.forUrl(databaseUrl, { migrationsRun: false }), {
    logger: ['error', 'warn'],
  });
  let failed: boolean;
  try {
    const { errors, fingerprint } = await runVerify(app);
    process.stdout.write(`fingerprint: ${fingerprint}\n`);
    failed = errors.length > 0;
    if (failed) {
      process.stdout.write(`ОШИБКИ (${errors.length}):\n`);
      for (const e of errors) process.stdout.write(`  ✗ ${e}\n`);
    } else process.stdout.write('verify: OK\n');
  } finally {
    await app.close();
  }
  if (failed) process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof DemoSeedRefusal) {
    process.stderr.write(`${err.message}\n`);
  } else {
    process.stderr.write(`demo verify failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  }
  process.exit(1);
});
