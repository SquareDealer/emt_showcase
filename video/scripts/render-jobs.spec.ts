import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOP_DEFS } from '../src/compositions/loop-defs';
import { RENDER_JOBS, remotionArgs, selectJobs } from './render-jobs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('render jobs', () => {
  it('hero: png frames, crf 16; social: png frames', () => {
    const hero = RENDER_JOBS.find((j) => j.id === 'Hero')!;
    expect(hero).toMatchObject({ kind: 'render', out: 'out/hero.mp4' });
    expect(hero.flags).toEqual(expect.arrayContaining(['--crf=16', '--image-format=png']));
    const social = RENDER_JOBS.find((j) => j.id === 'HeroSocial')!;
    expect(social).toMatchObject({ kind: 'render', out: 'out/social.mp4' });
    expect(social.flags).toContain('--image-format=png');
  });

  it('every loop as a muted webm (vp9) and mp4 (h264) under out/loops/, png frames', () => {
    for (const d of LOOP_DEFS) {
      const jobs = RENDER_JOBS.filter((j) => j.id === d.id);
      expect(jobs.map((j) => j.out)).toEqual([`out/loops/${d.file}.webm`, `out/loops/${d.file}.mp4`]);
      expect(jobs[0].flags).toEqual(['--codec=vp9', '--muted', '--image-format=png']);
      expect(jobs[1].flags).toEqual(['--codec=h264', '--muted', '--image-format=png']);
    }
  });

  it('the four stills, the cover at 2×', () => {
    const stills = RENDER_JOBS.filter((j) => j.kind === 'still');
    expect(stills.map((j) => [j.id, j.out, j.flags])).toEqual([
      ['Cover', 'out/cover.png', ['--scale=2']],
      ['OG', 'out/og.png', []],
      ['ReadmeEstimate', 'out/readme-estimate.png', []],
      ['ReadmeBoard', 'out/readme-board.png', []],
    ]);
  });

  it('everything lands in out/ (gitignored), nothing in public/', () => {
    for (const j of RENDER_JOBS) expect(j.out).toMatch(/^out\//);
    expect(new Set(RENDER_JOBS.map((j) => j.out)).size).toBe(RENDER_JOBS.length);
    expect(RENDER_JOBS.some((j) => j.id === 'MobileMaster')).toBe(false);
  });

  it('selectJobs: groups in order, all when none, unknown throws', () => {
    expect(selectJobs([])).toEqual(RENDER_JOBS);
    expect(selectJobs(['stills', 'hero']).map((j) => j.id)).toEqual(['Hero', 'Cover', 'OG', 'ReadmeEstimate', 'ReadmeBoard']);
    expect(() => selectJobs(['mobile'])).toThrow(/unknown render group/);
  });

  it('remotionArgs: against the bundle, extra flags and the browser last', () => {
    const cover = RENDER_JOBS.find((j) => j.id === 'Cover')!;
    expect(remotionArgs(cover, 'out/bundle', ['--concurrency=4'], '/x/chrome')).toEqual([
      'remotion', 'still', 'out/bundle', 'Cover', 'out/cover.png', '--scale=2', '--concurrency=4', '--browser-executable=/x/chrome',
    ]);
    expect(remotionArgs(cover, 'b', [])).toEqual(['remotion', 'still', 'b', 'Cover', 'out/cover.png', '--scale=2']);
  });
});

describe('package.json render scripts', () => {
  const scripts = pkg.scripts;
  const render = Object.keys(scripts).filter((s) => s === 'render' || s.startsWith('render:') || s === 'still');

  it('render:all and one script per group', () => {
    expect(render).toEqual(expect.arrayContaining(['render:all', 'render:hero', 'render:social', 'render:loops', 'render:stills']));
  });

  it('no npm pre-hook fires on a render/still script (prerender:mobile must not re-encode public/)', () => {
    for (const s of render) expect(scripts[`pre${s}`], `pre${s}`).toBeUndefined();
  });

  it('render scripts pin the time zone and locale', () => {
    for (const s of render) expect(scripts[s]).toMatch(/TZ=Europe\/Moscow LANG=ru_RU\.UTF-8 LANGUAGE=ru/);
  });

  it('the browser path is quoted (a path with spaces stays one argument)', () => {
    const uses = Object.entries(scripts).filter(([, cmd]) => cmd.includes('REMOTION_BROWSER'));
    expect(uses.length).toBeGreaterThan(0);
    for (const [name, cmd] of uses) {
      expect(cmd, name).toContain('${REMOTION_BROWSER:+"--browser-executable=$REMOTION_BROWSER"}');
    }
  });

  it('prerender:mobile feeds the encoder png frames, like every deliverable', () => {
    expect(scripts['prerender:mobile']).toContain('--image-format=png');
  });
});
