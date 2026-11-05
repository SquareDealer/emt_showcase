// What `npm run render:all` renders (pure data; scripts/render-all.ts runs it, render-jobs.spec.ts
// checks it). Every output lands in out/ (gitignored). The mobile prerender is NOT here: its mp4 in
// public/prerender/ is a committed build input (`npm run prerender:mobile`), not an output.
import { LOOP_DEFS } from '../src/compositions/loop-defs';

export type RenderGroup = 'hero' | 'social' | 'loops' | 'stills';
export type RenderJob = {
  group: RenderGroup;
  kind: 'render' | 'still';
  id: string;
  out: string;
  flags: string[];
};

export const RENDER_GROUPS: readonly RenderGroup[] = ['hero', 'social', 'loops', 'stills'];

export const RENDER_JOBS: readonly RenderJob[] = [
  // Final cut: lossless PNG frames into the encoder (the config default, jpeg, is for drafts).
  { group: 'hero', kind: 'render', id: 'Hero', out: 'out/hero.mp4', flags: ['--codec=h264', '--crf=16', '--image-format=png'] },
  { group: 'social', kind: 'render', id: 'HeroSocial', out: 'out/social.mp4', flags: ['--codec=h264', '--image-format=png'] },
  // Feature loops: webm (vp9) for the site, mp4 (h264) as the fallback; silent.
  ...LOOP_DEFS.flatMap((d): RenderJob[] => [
    { group: 'loops', kind: 'render', id: d.id, out: `out/loops/${d.file}.webm`, flags: ['--codec=vp9', '--muted'] },
    { group: 'loops', kind: 'render', id: d.id, out: `out/loops/${d.file}.mp4`, flags: ['--codec=h264', '--muted'] },
  ]),
  { group: 'stills', kind: 'still', id: 'Cover', out: 'out/cover.png', flags: ['--scale=2'] },
  { group: 'stills', kind: 'still', id: 'OG', out: 'out/og.png', flags: [] },
  { group: 'stills', kind: 'still', id: 'ReadmeEstimate', out: 'out/readme-estimate.png', flags: [] },
  { group: 'stills', kind: 'still', id: 'ReadmeBoard', out: 'out/readme-board.png', flags: [] },
];

/** The jobs of the named groups (all of them when none is named), in RENDER_JOBS order. */
export function selectJobs(groups: readonly string[]): RenderJob[] {
  const unknown = groups.filter((g) => !(RENDER_GROUPS as readonly string[]).includes(g));
  if (unknown.length) throw new Error(`unknown render group(s): ${unknown.join(', ')} (known: ${RENDER_GROUPS.join(', ')})`);
  return RENDER_JOBS.filter((j) => groups.length === 0 || groups.includes(j.group));
}

/** `npx remotion …` arguments of one job against a pre-built bundle; `extra` (e.g. --concurrency=4)
 *  goes to every renderer call, the browser path only when given. */
export function remotionArgs(job: RenderJob, bundle: string, extra: readonly string[], browser?: string): string[] {
  return [
    'remotion',
    job.kind,
    bundle,
    job.id,
    job.out,
    ...job.flags,
    ...extra,
    ...(browser ? [`--browser-executable=${browser}`] : []),
  ];
}
