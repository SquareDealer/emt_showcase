import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { typed } from '../kit/math';
import { COLUMNS_AFTER, COLUMNS_BEFORE, DROP_AT, boardState } from '../scenes/Board';
import { LAND_AT, bookingState } from '../scenes/Booking';
import { DC_DTYPE, DC_KEY_FRAMES, DC_KIT_VALUE, DC_ORDER_VALUE, DC_PER_CHAR, DC_TYPE_10 } from '../scenes/discounts';
import { APPLY_AT, TOAST_IN, estimateState } from '../scenes/Estimate';
import { FRAMES_PER_CHAR, QUERY, TYPE_FROM, TYPE_KEY_FRAMES } from '../scenes/Search';
import { FPS, SCENES, SCENES_SOCIAL, SCENE_CLICKS, TRANSITION, clicksAbsolute, sceneStart, totalDuration } from '../timing';
import {
  POP_LEAD,
  SFX_RATE,
  SFX_TAKES,
  SFX_VOLUME,
  WHOOSH_LEAD,
  assemblyPlan,
  contentLandings,
  heroClickSfx,
  heroDingSfx,
  heroKeySfx,
  heroPopSfx,
  heroWhooshSfx,
  musicPlacement,
  musicVolume,
  planDuration,
  sfxCues,
  takeFrames,
  transitionFor,
} from './assembly';

const PUBLIC = fileURLToPath(new URL('../../public', import.meta.url));

/** Format and length of a PCM WAV (RIFF chunks; WAVE_FORMAT_EXTENSIBLE too). */
function readWav(file: string) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV`);
  let off = 12;
  let fmt: { channels: number; rate: number; bits: number } | null = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') {
      if (!fmt) throw new Error(`${file}: data before fmt`);
      return { rate: fmt.rate, channels: fmt.channels, bits: fmt.bits, samples: size / (fmt.channels * (fmt.bits / 8)) };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`${file}: no data chunk`);
}

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
  it('TransitionSeries total equals totalDuration (hero 1200 = 40.0 s, social 900 = 30.0 s)', () => {
    expect(planDuration(assemblyPlan(SCENES), FPS)).toBe(totalDuration(SCENES));
    expect(planDuration(assemblyPlan(SCENES), FPS)).toBe(1200);
    expect(planDuration(assemblyPlan(SCENES_SOCIAL), FPS)).toBe(totalDuration(SCENES_SOCIAL));
    expect(planDuration(assemblyPlan(SCENES_SOCIAL), FPS)).toBe(900);
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
  it('discount typing frames come from DC_TYPE_10 / DC_DTYPE / DC_PER_CHAR: «1» 53, «10» 58, «5» 113', () => {
    expect(DC_KEY_FRAMES).toEqual([53, 58, 113]);
    expect(DC_KEY_FRAMES).toHaveLength(DC_KIT_VALUE.length + DC_ORDER_VALUE.length);
    expect(DC_KEY_FRAMES[0]).toBe(DC_TYPE_10 + DC_PER_CHAR);
    expect(DC_KEY_FRAMES[2]).toBe(DC_DTYPE + DC_PER_CHAR);
  });
  it('key SFX: one per typed character, exactly on the frames where a typed field grows by one', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const grows: number[] = [];
      // Search: the palette query.
      const search = sceneStart('search', scenes);
      const searchDur = scenes.find((s) => s.id === 'search')!.dur;
      for (let f = 1; f < searchDur; f++) {
        const d = typed(f, TYPE_FROM, QUERY, FRAMES_PER_CHAR).length - typed(f - 1, TYPE_FROM, QUERY, FRAMES_PER_CHAR).length;
        expect(d === 0 || d === 1).toBe(true);
        if (d === 1) grows.push(search + f);
      }
      // Estimate: the kit line's discount field and the order-discount input (as the scene draws them).
      const est = sceneStart('estimate', scenes);
      const estDur = scenes.find((s) => s.id === 'estimate')!.dur;
      const field = (f: number) => {
        const st = estimateState(f, FPS);
        return [st.partDraft?.discValue ?? '', st.discountDraft?.value ?? ''];
      };
      for (let f = 1; f < estDur; f++) {
        const [e1, o1] = field(f);
        const [e0, o0] = field(f - 1);
        if ((e1.length === e0.length + 1 && e1.startsWith(e0)) || (o1.length === o0.length + 1 && o1.startsWith(o0))) grows.push(est + f);
      }
      expect(heroKeySfx(scenes)).toEqual(grows.sort((a, b) => a - b));
      expect(heroKeySfx(scenes)).toHaveLength(QUERY.length + 3);
    }
  });
  it('key SFX in the hero: discounts 473 / 478 / 533, VIN 830…860 every 5 frames', () => {
    expect(heroKeySfx()).toEqual([473, 478, 533, 830, 835, 840, 845, 850, 855, 860]);
  });
  it('whoosh SFX: 3 frames into each slide transition, so the file\'s apex (≈ 135 ms) is mid-transition', () => {
    expect(WHOOSH_LEAD).toBe(3);
    expect(heroWhooshSfx()).toEqual([sceneStart('board'), sceneStart('docs'), sceneStart('dashboard')].map((f) => f + 3));
    expect(heroWhooshSfx(SCENES_SOCIAL)).toEqual([sceneStart('board', SCENES_SOCIAL), sceneStart('dashboard', SCENES_SOCIAL)].map((f) => f + 3));
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const slides = assemblyPlan(scenes).flatMap((p) => (p.type === 'transition' && p.kind === 'slide' ? [sceneStart(p.to, scenes)] : []));
      heroWhooshSfx(scenes).forEach((at, i) => {
        const apex = at + 0.135 * FPS;
        // The middle third of the 15-frame overlap.
        expect(apex).toBeGreaterThanOrEqual(slides[i] + TRANSITION / 3);
        expect(apex).toBeLessThanOrEqual(slides[i] + (2 * TRANSITION) / 3);
      });
    }
  });
  it('content landings: each scene\'s own constant, and the frame its state actually changes on', () => {
    // Booking: the ghost → the booked order.
    expect(bookingState(LAND_AT - 1, FPS).selection).not.toBeNull();
    expect(bookingState(LAND_AT, FPS).selection).toBeNull();
    expect(bookingState(LAND_AT, FPS).events.length).toBe(bookingState(LAND_AT - 1, FPS).events.length + 1);
    // Estimate: the sheet closes, wo-hero.1 (the block) arrives.
    expect(APPLY_AT).toBe(153);
    expect(estimateState(APPLY_AT - 1, FPS).wo.id).toBe(estimateState(APPLY_AT, FPS).wo.id);
    expect(estimateState(APPLY_AT - 1, FPS).wo).not.toBe(estimateState(APPLY_AT, FPS).wo);
    expect(estimateState(APPLY_AT, FPS).modalOpacity).toBe(0);
    expect(estimateState(APPLY_AT - 1, FPS).modalOpacity).toBeGreaterThan(0);
    // Board: the drop's effects, 3 frames after the drop click.
    expect(DROP_AT).toBe(SCENE_CLICKS.board[1] + 3);
    expect(boardState(DROP_AT - 1, FPS).columns).toBe(COLUMNS_BEFORE);
    expect(boardState(DROP_AT, FPS).columns).toBe(COLUMNS_AFTER);
    expect(contentLandings()).toEqual([sceneStart('booking') + LAND_AT, sceneStart('estimate') + APPLY_AT, sceneStart('board') + DROP_AT]);
    expect(contentLandings()).toEqual([180, 378, 648]);
    expect(contentLandings(SCENES_SOCIAL)).toEqual([120, 288, 558]);
  });
  it('pop SFX: POP_LEAD (1) frame before each landing, so the peak (≈ 42 ms) is on it', () => {
    expect(POP_LEAD).toBe(1);
    for (const scenes of [SCENES, SCENES_SOCIAL]) expect(heroPopSfx(scenes)).toEqual(contentLandings(scenes).map((f) => f - 1));
    expect(heroPopSfx()).toEqual([179, 377, 647]);
  });
  it('ding SFX: when the success toast («Блок добавлен в смету») appears', () => {
    expect(estimateState(TOAST_IN - 1, FPS).toastOpacity).toBe(0);
    expect(estimateState(TOAST_IN + 1, FPS).toastOpacity).toBeGreaterThan(0);
    expect(heroDingSfx()).toEqual([sceneStart('estimate') + TOAST_IN]);
    expect(heroDingSfx()).toEqual([380]);
    expect(heroDingSfx(SCENES_SOCIAL)).toEqual([290]);
  });
  it('volumes: one table — clicks and keys under pops, the ding and the whooshes', () => {
    expect(Object.keys(SFX_VOLUME).sort()).toEqual(['click', 'ding', 'key', 'pop', 'whoosh']);
    expect(Object.keys(SFX_TAKES).sort()).toEqual(Object.keys(SFX_VOLUME).sort());
    for (const v of Object.values(SFX_VOLUME)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(SFX_VOLUME.key).toBeLessThan(SFX_VOLUME.click);
  });
  it('every take file exists: 48 kHz stereo 24-bit PCM, its length in samples as SFX_TAKES says', () => {
    for (const takes of Object.values(SFX_TAKES)) {
      for (const t of takes) {
        const wav = readWav(path.join(PUBLIC, t.src));
        expect({ src: t.src, ...wav }).toEqual({ src: t.src, rate: SFX_RATE, channels: 2, bits: 24, samples: t.samples });
      }
    }
    // The old synthesized files are gone.
    for (const f of ['click.wav', 'key.wav', 'whoosh.wav']) expect(fs.existsSync(path.join(PUBLIC, 'audio', f))).toBe(false);
  });
  it('takeFrames: whole frames to the file\'s end (click 1, key 5, whoosh 24, pop 6, ding 10)', () => {
    const frames = (n: keyof typeof SFX_TAKES) => SFX_TAKES[n].map((t) => takeFrames(t.samples));
    expect(frames('click')).toEqual([1, 1]);
    expect(frames('key')).toEqual([5, 5, 5, 5]);
    expect(frames('whoosh')).toEqual([24]);
    expect(frames('pop')).toEqual([6, 6]);
    expect(frames('ding')).toEqual([10]);
    for (const takes of Object.values(SFX_TAKES)) for (const t of takes) expect(takeFrames(t.samples) * SFX_RATE / FPS).toBeGreaterThanOrEqual(t.samples);
  });
});

describe('sfxCues: the single list the assembly renders', () => {
  const pick = (scenes: Parameters<typeof sfxCues>[0], name: string) => sfxCues(scenes).filter((c) => c.name === name).map((c) => c.at);
  it('hero: every cue frame', () => {
    expect(pick(SCENES, 'click')).toEqual(clicksAbsolute(SCENES));
    expect(pick(SCENES, 'click')).toEqual([135, 165, 270, 300, 345, 375, 450, 465, 495, 525, 600, 645, 870]);
    expect(pick(SCENES, 'key')).toEqual([473, 478, 533, 830, 835, 840, 845, 850, 855, 860]);
    expect(pick(SCENES, 'whoosh')).toEqual([573, 708, 948]);
    expect(pick(SCENES, 'pop')).toEqual([179, 377, 647]);
    expect(pick(SCENES, 'ding')).toEqual([380]);
  });
  it('social: every cue frame', () => {
    expect(pick(SCENES_SOCIAL, 'click')).toEqual(clicksAbsolute(SCENES_SOCIAL));
    expect(pick(SCENES_SOCIAL, 'click')).toEqual([75, 105, 180, 210, 255, 285, 360, 375, 405, 435, 510, 555, 645]);
    const s = sceneStart('search', SCENES_SOCIAL);
    expect(s).toBe(585);
    expect(pick(SCENES_SOCIAL, 'key')).toEqual([383, 388, 443, ...[20, 25, 30, 35, 40, 45, 50].map((f) => s + f)]);
    // Social transitions: booking>estimate fade, estimate>board slide, board>search fade, search>dashboard slide, dashboard>outro fade.
    const kinds = assemblyPlan(SCENES_SOCIAL).flatMap((p) => (p.type === 'transition' ? [`${p.from}>${p.to}:${p.kind}`] : []));
    expect(kinds).toEqual(['booking>estimate:fade', 'estimate>board:slide', 'board>search:fade', 'search>dashboard:slide', 'dashboard>outro:fade']);
    expect(pick(SCENES_SOCIAL, 'whoosh')).toEqual([483, 708]);
    expect(pick(SCENES_SOCIAL, 'pop')).toEqual([119, 287, 557]);
    expect(pick(SCENES_SOCIAL, 'ding')).toEqual([290]);
  });
  it('takes alternate by cue index: click_1/click_2, key_1…4 round-robin, pop_1/pop_2', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const cues = sfxCues(scenes);
      for (const name of Object.keys(SFX_TAKES) as (keyof typeof SFX_TAKES)[]) {
        const takes = SFX_TAKES[name];
        cues.filter((c) => c.name === name).forEach((c, i) => expect(c.src).toBe(takes[i % takes.length].src));
      }
    }
    expect(sfxCues(SCENES).filter((c) => c.name === 'key').map((c) => c.src.slice(-9))).toEqual(
      ['key_1.wav', 'key_2.wav', 'key_3.wav', 'key_4.wav', 'key_1.wav', 'key_2.wav', 'key_3.wav', 'key_4.wav', 'key_1.wav', 'key_2.wav'],
    );
  });
  it('every cue carries its take\'s src / level / frames, is on a whole frame and ends inside the composition', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const cues = sfxCues(scenes);
      expect(cues.length).toBe(clicksAbsolute(scenes).length + 10 + heroWhooshSfx(scenes).length + 3 + 1);
      for (const c of cues) {
        const take = SFX_TAKES[c.name].find((t) => t.src === c.src)!;
        expect(take).toBeDefined();
        expect(c).toEqual({ name: c.name, src: take.src, volume: SFX_VOLUME[c.name], frames: takeFrames(take.samples), at: c.at });
        expect(Number.isInteger(c.at)).toBe(true);
        expect(c.at).toBeGreaterThanOrEqual(0);
        expect(c.at + c.frames).toBeLessThanOrEqual(totalDuration(scenes));
      }
    }
  });
  it('no two cues of the same file closer than 3 frames', () => {
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      const bySrc = new Map<string, number[]>();
      for (const c of sfxCues(scenes)) bySrc.set(c.src, [...(bySrc.get(c.src) ?? []), c.at]);
      for (const [, ats] of bySrc) {
        const sorted = [...ats].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('a scene list without search has only the discount keys; without slides, no whooshes', () => {
    const noSearch = SCENES.filter((s) => s.id !== 'search');
    expect(sfxCues(noSearch).filter((c) => c.name === 'key')).toHaveLength(3);
    const fadesOnly = SCENES.filter((s) => ['intro', 'booking', 'estimate'].includes(s.id));
    expect(sfxCues(fadesOnly).some((c) => c.name === 'whoosh')).toBe(false);
    expect(sfxCues(fadesOnly).filter((c) => c.name === 'pop')).toHaveLength(2);
  });
});

describe('music', () => {
  it('volume envelope: 0 → 0.8 over the first second, holds, 0 over the last 3 s', () => {
    const v = (f: number) => musicVolume(f, 1200);
    expect(v(0)).toBe(0);
    expect(v(15)).toBeCloseTo(0.4);
    expect(v(30)).toBe(0.8);
    expect(v(500)).toBe(0.8);
    expect(v(1110)).toBe(0.8);
    expect(v(1155)).toBeCloseTo(0.4);
    expect(v(1200)).toBe(0);
    expect(v(2000)).toBe(0);
    expect(v(-5)).toBe(0);
  });
  it('musicOffsetFrames: positive skips into the track, negative delays its start', () => {
    expect(musicPlacement(0)).toEqual({ from: 0, trimBefore: 0 });
    expect(musicPlacement(12)).toEqual({ from: 0, trimBefore: 12 });
    expect(musicPlacement(-8)).toEqual({ from: 8, trimBefore: 0 });
  });
});
