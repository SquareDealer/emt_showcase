/**
 * Seamlessness check of the feature loops (`npm run loops:check`): for every loop, render
 * `still --frame=0` and `--frame=<dur-1>` and compare them pixel by pixel. A pixel differs when a
 * channel moves by more than 16; the check fails when more than 1 % of the pixels differ.
 *
 *   tsx scripts/loop-diff.ts                     all loops (bundles once into out/loops/check)
 *   tsx scripts/loop-diff.ts LoopBoard …         only these
 *   tsx scripts/loop-diff.ts a.png b.png         just compare two PNGs
 *
 * Run through npm so TZ/LANG are set; the browser comes from $REMOTION_BROWSER when set.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { LOOP_DEFS } from '../src/compositions/loop-defs';
import { pixelDiff } from './pixel-diff';

const TOLERANCE = 16;
const MAX_SHARE = 0.01;

const read = (file: string) => PNG.sync.read(readFileSync(file));
const pct = (x: number) => `${(x * 100).toFixed(3)} %`;

function remotion(args: string[]) {
  const browser = process.env.REMOTION_BROWSER;
  execFileSync('npx', ['remotion', ...args, ...(browser ? [`--browser-executable=${browser}`] : []), '--log=error'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

function main(argv: string[]) {
  if (argv.length === 2 && argv.every((a) => a.endsWith('.png'))) {
    const d = pixelDiff(read(argv[0]), read(argv[1]), TOLERANCE);
    console.log(`${argv[0]} vs ${argv[1]}: ${d.differing}/${d.total} px differ (${pct(d.share)})`);
    return d.share <= MAX_SHARE ? 0 : 1;
  }
  const wanted = argv.length ? argv : LOOP_DEFS.map((d) => d.id);
  const unknown = wanted.filter((id) => !LOOP_DEFS.some((d) => d.id === id));
  if (unknown.length) throw new Error(`unknown loop(s): ${unknown.join(', ')}`);

  const dir = path.join('out', 'loops', 'check');
  const bundle = path.join(dir, 'bundle');
  mkdirSync(dir, { recursive: true });
  console.log(`bundling → ${bundle}`);
  execFileSync('npx', ['remotion', 'bundle', '--out-dir', bundle, '--log=error'], { stdio: ['ignore', 'ignore', 'inherit'] });

  let failed = 0;
  for (const def of LOOP_DEFS.filter((d) => wanted.includes(d.id))) {
    const last = def.dur - 1;
    const first = path.join(dir, `${def.file}-0.png`);
    const end = path.join(dir, `${def.file}-${last}.png`);
    remotion(['still', bundle, def.id, first, '--frame=0']);
    remotion(['still', bundle, def.id, end, `--frame=${last}`]);
    const d = pixelDiff(read(first), read(end), TOLERANCE);
    const ok = d.share <= MAX_SHARE;
    if (!ok) failed++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${def.id.padEnd(17)} frame 0 vs ${String(last).padStart(3)}: ` +
        `${String(d.differing).padStart(7)}/${d.total} px differ by > ${TOLERANCE} (${pct(d.share)})`,
    );
  }
  console.log(failed ? `${failed} loop(s) over ${pct(MAX_SHARE)}` : `all ${wanted.length} loops seamless (≤ ${pct(MAX_SHARE)})`);
  return failed ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
