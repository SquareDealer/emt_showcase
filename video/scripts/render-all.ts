/**
 * The deliverables (`npm run render:all`, or one group: render:hero / render:social / render:loops /
 * render:stills): bundles once into out/bundle, then runs `remotion render|still` against it for every
 * job of scripts/render-jobs.ts and prints each output's size and time.
 *
 *   tsx scripts/render-all.ts                          everything
 *   tsx scripts/render-all.ts loops stills             only these groups
 *   tsx scripts/render-all.ts hero --concurrency=4     extra flags go to every renderer call
 *
 * Run through npm so TZ/LANG are set; the browser comes from $REMOTION_BROWSER when set. The mobile
 * prerender (public/prerender/mobile-master.mp4) is an input and is not re-rendered here.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { remotionArgs, selectJobs } from './render-jobs';

const BUNDLE = path.join('out', 'bundle');

function main(argv: string[]) {
  const extra = argv.filter((a) => a.startsWith('--'));
  const jobs = selectJobs(argv.filter((a) => !a.startsWith('--')));
  const browser = process.env.REMOTION_BROWSER || undefined;

  console.log(`bundling → ${BUNDLE}`);
  execFileSync('npx', ['remotion', 'bundle', '--out-dir', BUNDLE, '--log=error'], { stdio: 'inherit' });

  const done: string[] = [];
  const t0 = Date.now();
  for (const [i, job] of jobs.entries()) {
    mkdirSync(path.dirname(job.out), { recursive: true });
    console.log(`\n[${i + 1}/${jobs.length}] ${job.kind} ${job.id} → ${job.out} ${job.flags.join(' ')}`);
    const t = Date.now();
    execFileSync('npx', remotionArgs(job, BUNDLE, extra, browser), { stdio: 'inherit' });
    const mb = (statSync(job.out).size / 1e6).toFixed(2);
    done.push(`${job.out.padEnd(30)} ${mb.padStart(7)} MB  ${((Date.now() - t) / 1000).toFixed(0).padStart(4)} s`);
  }
  console.log(`\n${jobs.length} outputs in ${((Date.now() - t0) / 1000).toFixed(0)} s:\n${done.join('\n')}`);
}

main(process.argv.slice(2));
