import { describe, expect, it } from 'vitest';
import {
  FRAMES_PER_BEAT,
  SCENES,
  SCENES_SOCIAL,
  SCENE_CLICKS,
  SOCIAL_DUR,
  offBeatClicks,
  sceneStart,
  totalDuration,
} from './timing';

describe('timing', () => {
  it('hero total is 1200 frames (40.0 s; the estimate is 360)', () => {
    expect(SCENES.find((s) => s.id === 'estimate')?.dur).toBe(360);
    expect(totalDuration()).toBeLessThanOrEqual(1200);
    expect(totalDuration()).toBe(1200);
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
  it('estimate clicks: select 45, option 75, oil 120, confirm 150, then the discounts: ✎ 225, field 240, ✓ 270, type 300 (absolute 270/300/345/375/450/465/495/525, on the beat)', () => {
    expect(SCENE_CLICKS.estimate).toEqual([45, 75, 120, 150, 225, 240, 270, 300]);
    expect(sceneStart('estimate')).toBe(225);
    expect(SCENE_CLICKS.estimate.map((f) => f + sceneStart('estimate'))).toEqual([270, 300, 345, 375, 450, 465, 495, 525]);
  });
  it('board clicks: press 30, drop 75 (absolute 600/645 — the old 510/555 + 90, on the beat)', () => {
    expect(SCENE_CLICKS.board).toEqual([30, 75]);
    expect(sceneStart('board')).toBe(570);
    expect(SCENE_CLICKS.board.map((f) => f + sceneStart('board'))).toEqual([600, 645]);
  });
  it('search clicks: the hero hit at 60 (absolute 870, social 645, on the beat)', () => {
    expect(SCENE_CLICKS.search).toEqual([60]);
    expect(sceneStart('search')).toBe(810);
    expect(SCENE_CLICKS.search.map((f) => f + sceneStart('search'))).toEqual([870]);
    expect(SCENE_CLICKS.search.map((f) => f + sceneStart('search', SCENES_SOCIAL))).toEqual([645]);
  });
  it('offBeatClicks detects off-grid clicks in an injected table', () => {
    expect(offBeatClicks(SCENES, { ...SCENE_CLICKS, booking: [20] })).toEqual([80]);
    expect(offBeatClicks(SCENES, { ...SCENE_CLICKS, booking: [15] })).toEqual([]);
    expect(offBeatClicks(SCENES_SOCIAL, { ...SCENE_CLICKS, booking: [20] })).toEqual([20 + sceneStart('booking', SCENES_SOCIAL)]);
  });
  it('social drops intro and docs, keeps the hero\'s estimate (360) and trims settled holds by 90 elsewhere in 15-frame steps', () => {
    const ids: string[] = SCENES_SOCIAL.map((s) => s.id);
    expect(ids).not.toContain('intro');
    expect(ids).not.toContain('docs');
    expect(Object.fromEntries(SCENES_SOCIAL.map((s) => [s.id, s.dur]))).toEqual({
      booking: 150,
      estimate: 360,
      board: 120,
      search: 135,
      dashboard: 120,
      outro: 90,
    });
    // vs the delivered cut (booking 150, estimate 270, board 150, search 150, dashboard 135, outro 120):
    // the estimate +90, the board −30, search −15, the dashboard −15, the outro −30.
    for (const s of SCENES_SOCIAL) {
      expect(s.dur % FRAMES_PER_BEAT).toBe(0);
      if (SOCIAL_DUR[s.id] === undefined) expect(s.dur).toBe(SCENES.find((h) => h.id === s.id)?.dur);
    }
  });
  it('social is at most 30 s (≤ 900 frames) and every scene starts on the beat', () => {
    expect(totalDuration(SCENES_SOCIAL)).toBeLessThanOrEqual(900);
    expect(totalDuration(SCENES_SOCIAL)).toBe(900);
    for (const s of SCENES_SOCIAL) expect(sceneStart(s.id, SCENES_SOCIAL) % FRAMES_PER_BEAT).toBe(0);
  });
});
