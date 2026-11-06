import { describe, expect, it } from 'vitest';
import {
  FRAMES_PER_BEAT,
  TRANSITION,
  SCENES,
  SCENES_SOCIAL,
  SCENE_CLICKS,
  SOCIAL_DUR,
  offBeatClicks,
  sceneStart,
  totalDuration,
} from './timing';

describe('timing', () => {
  it('hero total is 1470 frames (49.0 s, ≤ 50 s; 1-s transitions, the estimate 465)', () => {
    expect(TRANSITION).toBe(30);
    expect(SCENES.find((s) => s.id === 'estimate')?.dur).toBe(465);
    expect(totalDuration()).toBeLessThanOrEqual(1500);
    expect(totalDuration()).toBe(1470);
  });
  it('every scene lasts a whole number of beats, at least two transitions long', () => {
    for (const s of [...SCENES, ...SCENES_SOCIAL]) {
      expect(s.dur % FRAMES_PER_BEAT).toBe(0);
      expect(s.dur).toBeGreaterThanOrEqual(2 * TRANSITION);
    }
  });
  it('booking starts at 60', () => expect(sceneStart('booking')).toBe(60));
  it('every scene start is on the beat grid (hero and social)', () => {
    for (const s of SCENES) expect(sceneStart(s.id) % FRAMES_PER_BEAT).toBe(0);
    for (const s of SCENES_SOCIAL) expect(sceneStart(s.id, SCENES_SOCIAL) % FRAMES_PER_BEAT).toBe(0);
  });
  it('real click table is on the beat grid (hero and social)', () => {
    expect(offBeatClicks()).toEqual([]);
    expect(offBeatClicks(SCENES_SOCIAL)).toEqual([]);
  });
  it('booking clicks: slot at 75, «Новая запись» at 105 (absolute 135/165, on the beat)', () => {
    expect(SCENE_CLICKS.booking).toEqual([75, 105]);
    expect(SCENE_CLICKS.booking.map((f) => f + sceneStart('booking'))).toEqual([135, 165]);
  });
  it('estimate clicks: select 45, option 75, oil 120, confirm 150, then the discounts: ✎ 300, field 315, ✓ 345, type 375 (absolute 285/315/360/390/540/555/585/615, on the beat)', () => {
    expect(SCENE_CLICKS.estimate).toEqual([45, 75, 120, 150, 300, 315, 345, 375]);
    expect(sceneStart('estimate')).toBe(240);
    expect(SCENE_CLICKS.estimate.map((f) => f + sceneStart('estimate'))).toEqual([285, 315, 360, 390, 540, 555, 585, 615]);
  });
  it('board clicks: press 30, drop 75 (absolute 705/750, on the beat)', () => {
    expect(SCENE_CLICKS.board).toEqual([30, 75]);
    expect(sceneStart('board')).toBe(675);
    expect(SCENE_CLICKS.board.map((f) => f + sceneStart('board'))).toEqual([705, 750]);
  });
  it('search clicks: the hero hit at 90 (absolute 1065, social 855, on the beat)', () => {
    expect(SCENE_CLICKS.search).toEqual([90]);
    expect(sceneStart('search')).toBe(975);
    expect(SCENE_CLICKS.search.map((f) => f + sceneStart('search'))).toEqual([1065]);
    expect(SCENE_CLICKS.search.map((f) => f + sceneStart('search', SCENES_SOCIAL))).toEqual([855]);
  });
  it('scene starts (hero): 0 / 60 / 240 / 675 / 825 / 975 / 1170 / 1350; social: 0 / 180 / 615 / 765 / 960 / 1110', () => {
    expect(SCENES.map((s) => sceneStart(s.id))).toEqual([0, 60, 240, 675, 825, 975, 1170, 1350]);
    expect(SCENES_SOCIAL.map((s) => sceneStart(s.id, SCENES_SOCIAL))).toEqual([0, 180, 615, 765, 960, 1110]);
  });
  it('offBeatClicks detects off-grid clicks in an injected table', () => {
    expect(offBeatClicks(SCENES, { ...SCENE_CLICKS, booking: [20] })).toEqual([80]);
    expect(offBeatClicks(SCENES, { ...SCENE_CLICKS, booking: [15] })).toEqual([]);
    expect(offBeatClicks(SCENES_SOCIAL, { ...SCENE_CLICKS, booking: [20] })).toEqual([20 + sceneStart('booking', SCENES_SOCIAL)]);
  });
  it('social drops intro and docs, keeps the hero\'s scenes but a shorter dashboard and outro', () => {
    const ids: string[] = SCENES_SOCIAL.map((s) => s.id);
    expect(ids).not.toContain('intro');
    expect(ids).not.toContain('docs');
    expect(Object.fromEntries(SCENES_SOCIAL.map((s) => [s.id, s.dur]))).toEqual({
      booking: 210,
      estimate: 465,
      board: 180,
      search: 225,
      dashboard: 180,
      outro: 90,
    });
    for (const s of SCENES_SOCIAL) {
      expect(s.dur % FRAMES_PER_BEAT).toBe(0);
      if (SOCIAL_DUR[s.id] === undefined) expect(s.dur).toBe(SCENES.find((h) => h.id === s.id)?.dur);
    }
  });
  it('social is at most 40 s (≤ 1200 frames) and every scene starts on the beat', () => {
    expect(totalDuration(SCENES_SOCIAL)).toBeLessThanOrEqual(1200);
    expect(totalDuration(SCENES_SOCIAL)).toBe(1200);
    for (const s of SCENES_SOCIAL) expect(sceneStart(s.id, SCENES_SOCIAL) % FRAMES_PER_BEAT).toBe(0);
  });
});
