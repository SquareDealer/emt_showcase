import { describe, expect, it } from 'vitest';
import { typed } from '../kit/math';
import { FRAMES_PER_CHAR, QUERY, TYPE_FROM, TYPE_KEY_FRAMES } from '../scenes/Search';
import { FPS, SCENES, SCENES_SOCIAL, TRANSITION, clicksAbsolute, sceneStart, totalDuration } from '../timing';
import {
  SFX,
  assemblyPlan,
  heroClickSfx,
  heroKeySfx,
  heroWhooshSfx,
  musicPlacement,
  musicVolume,
  planDuration,
  transitionFor,
} from './assembly';

describe('transitionFor', () => {
  it('plan pairs: fade intro/booking, booking/estimate, docs/search, dashboard/outro', () => {
    expect(transitionFor('intro', 'booking')).toBe('fade');
    expect(transitionFor('booking', 'estimate')).toBe('fade');
    expect(transitionFor('docs', 'search')).toBe('fade');
    expect(transitionFor('dashboard', 'outro')).toBe('fade');
  });
  it('plan pairs: slide from-right estimate/board, board/docs, search/dashboard', () => {
    expect(transitionFor('estimate', 'board')).toBe('slide');
    expect(transitionFor('board', 'docs')).toBe('slide');
    expect(transitionFor('search', 'dashboard')).toBe('slide');
  });
  it('any pair not in the plan (social board→search) falls back to fade', () => {
    expect(transitionFor('board', 'search')).toBe('fade');
    expect(transitionFor('outro', 'intro')).toBe('fade');
  });
});

describe('assembly plan', () => {
  it('alternates scene / transition, one transition between each adjacent pair', () => {
    const plan = assemblyPlan(SCENES);
    expect(plan.filter((p) => p.type === 'scene').map((p) => p.type === 'scene' && p.id)).toEqual(SCENES.map((s) => s.id));
    expect(plan.filter((p) => p.type === 'transition')).toHaveLength(SCENES.length - 1);
    plan.forEach((p, i) => expect(p.type).toBe(i % 2 === 0 ? 'scene' : 'transition'));
  });
  it('hero: the 7 transitions in plan order', () => {
    const kinds = assemblyPlan(SCENES).flatMap((p) => (p.type === 'transition' ? [p.kind] : []));
    expect(kinds).toEqual(['fade', 'fade', 'slide', 'slide', 'fade', 'slide', 'fade']);
  });
  it('every transition lasts TRANSITION frames (linearTiming)', () => {
    for (const p of assemblyPlan(SCENES)) if (p.type === 'transition') expect(p.timing.getDurationInFrames({ fps: FPS })).toBe(TRANSITION);
  });
  it('TransitionSeries total equals totalDuration (hero 1110 = 37.0 s, social)', () => {
    expect(planDuration(assemblyPlan(SCENES), FPS)).toBe(totalDuration(SCENES));
    expect(planDuration(assemblyPlan(SCENES), FPS)).toBe(1110);
    expect(planDuration(assemblyPlan(SCENES_SOCIAL), FPS)).toBe(totalDuration(SCENES_SOCIAL));
  });
  it('each scene enters the series at sceneStart()', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      let at = 0;
      for (const p of assemblyPlan(scenes)) {
        if (p.type === 'scene') {
          expect(at).toBe(sceneStart(p.id, scenes));
          at += p.dur;
        } else at -= p.timing.getDurationInFrames({ fps: FPS });
      }
    }
  });
});

describe('sound effects', () => {
  it('click SFX positions === clicksAbsolute() (Review Focus 5: one table for cursor and sound)', () => {
    expect(heroClickSfx()).toEqual(clicksAbsolute());
    expect(heroClickSfx(SCENES)).toEqual(clicksAbsolute(SCENES));
    expect(heroClickSfx(SCENES_SOCIAL)).toEqual(clicksAbsolute(SCENES_SOCIAL));
    expect(heroClickSfx().length).toBeGreaterThan(0);
  });
  it('Search typing frames come from TYPE_FROM / QUERY / FRAMES_PER_CHAR', () => {
    expect(TYPE_KEY_FRAMES).toHaveLength(QUERY.length);
    expect(TYPE_KEY_FRAMES[0]).toBe(TYPE_FROM + FRAMES_PER_CHAR);
  });
  it('key SFX: one per typed character, exactly on the frames where typed() grows by one', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const start = sceneStart('search', scenes);
      const keys = heroKeySfx(scenes);
      expect(keys).toHaveLength(QUERY.length);
      const grows: number[] = [];
      for (let f = 1; f < 150; f++) {
        const d = typed(f, TYPE_FROM, QUERY, FRAMES_PER_CHAR).length - typed(f - 1, TYPE_FROM, QUERY, FRAMES_PER_CHAR).length;
        expect(d === 0 || d === 1).toBe(true);
        if (d === 1) grows.push(start + f);
      }
      expect(keys).toEqual(grows);
    }
  });
  it('key SFX in the hero: 740…770, every 5 frames', () => {
    expect(heroKeySfx()).toEqual([740, 745, 750, 755, 760, 765, 770]);
  });
  it('whoosh SFX at the start of each slide transition (= the entering scene\'s start)', () => {
    expect(heroWhooshSfx()).toEqual([sceneStart('board'), sceneStart('docs'), sceneStart('dashboard')]);
    expect(heroWhooshSfx(SCENES_SOCIAL)).toEqual([sceneStart('board', SCENES_SOCIAL), sceneStart('dashboard', SCENES_SOCIAL)]);
  });
  it('volumes per plan: click 0.5, key 0.2, whoosh 0.3', () => {
    expect(SFX.click.volume).toBe(0.5);
    expect(SFX.key.volume).toBe(0.2);
    expect(SFX.whoosh.volume).toBe(0.3);
    expect(SFX.click.frames).toBe(15);
  });
  it('every SFX ends before the composition does', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const total = totalDuration(scenes);
      for (const f of heroClickSfx(scenes)) expect(f + SFX.click.frames).toBeLessThanOrEqual(total);
      for (const f of heroKeySfx(scenes)) expect(f + SFX.key.frames).toBeLessThanOrEqual(total);
      for (const f of heroWhooshSfx(scenes)) expect(f + SFX.whoosh.frames).toBeLessThanOrEqual(total);
    }
  });
});

describe('music', () => {
  it('volume envelope: 0 → 0.8 over the first second, holds, 0 over the last 3 s', () => {
    const v = (f: number) => musicVolume(f, 1110);
    expect(v(0)).toBe(0);
    expect(v(15)).toBeCloseTo(0.4);
    expect(v(30)).toBe(0.8);
    expect(v(500)).toBe(0.8);
    expect(v(1020)).toBe(0.8);
    expect(v(1065)).toBeCloseTo(0.4);
    expect(v(1110)).toBe(0);
    expect(v(2000)).toBe(0);
    expect(v(-5)).toBe(0);
  });
  it('musicOffsetFrames: positive skips into the track, negative delays its start', () => {
    expect(musicPlacement(0)).toEqual({ from: 0, trimBefore: 0 });
    expect(musicPlacement(12)).toEqual({ from: 0, trimBefore: 12 });
    expect(musicPlacement(-8)).toEqual({ from: 8, trimBefore: 0 });
  });
});
