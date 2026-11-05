// Entry point: `npm run seed:demo [-- --force] [-- --now=YYYY-MM-DD]`.
// Only ./guards is imported statically. src/data-source calls dotenv, which would quietly fill
// DATABASE_URL from .env (the dev database), so src/ is loaded only after every guard has passed.
import { DemoSeedRefusal, assertSafeEnv, parseArgs } from './guards';

async function main() {
  const args = parseArgs(process.argv.slice(2), new Date());
  const env = assertSafeEnv(process.env, { requirePassword: true });
  const { runDemoSeed } = await import('./run'); // src/data-source (и dotenv) грузятся только здесь
  await runDemoSeed({ ...args, ...env });
}

main().catch((err: unknown) => {
  if (err instanceof DemoSeedRefusal) {
    process.stderr.write(`${err.message}\n`);
  } else {
    process.stderr.write(`demo seed failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  }
  process.exit(1);
});
