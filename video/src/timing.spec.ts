import { describe, expect, it } from 'vitest';
import {
  FRAMES_PER_BEAT,
  SCENES,
  SCENES_SOCIAL,
  SCENE_CLICKS,
  offBeatClicks,
  sceneStart,
  totalDuration,
} from './timing';

describe('timing', () => {
  it('hero total is 1110 frames', () => expect(totalDuration()).toBe(1110));
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
  it('estimate clicks: select 45, option 75, oil 120, confirm 150, discount type 210 (absolute 270/300/345/375/435, on the beat)', () => {
    expect(SCENE_CLICKS.estimate).toEqual([45, 75, 120, 150, 210]);
    expect(sceneStart('estimate')).toBe(225);
    expect(SCENE_CLICKS.estimate.map((f) => f + sceneStart('estimate'))).toEqual([270, 300, 345, 375, 435]);
  });
  it('board clicks: press 30, drop 75 (absolute 510/555, on the beat)', () => {
    expect(SCENE_CLICKS.board).toEqual([30, 75]);
    expect(sceneStart('board')).toBe(480);
    expect(SCENE_CLICKS.board.map((f) => f + sceneStart('board'))).toEqual([510, 555]);
  });
  it('offBeatClicks detects off-grid clicks in an injected table', () => {
    expect(offBeatClicks(SCENES, { ...SCENE_CLICKS, booking: [20] })).toEqual([80]);
    expect(offBeatClicks(SCENES, { ...SCENE_CLICKS, booking: [15] })).toEqual([]);
    expect(offBeatClicks(SCENES_SOCIAL, { ...SCENE_CLICKS, booking: [20] })).toEqual([20 + sceneStart('booking', SCENES_SOCIAL)]);
  });
  it('social drops intro and docs and shortens booking', () => {
    const ids: string[] = SCENES_SOCIAL.map((s) => s.id);
    expect(ids).not.toContain('intro');
    expect(ids).not.toContain('docs');
    expect(SCENES_SOCIAL.find((s) => s.id === 'booking')?.dur).toBe(150);
    expect(totalDuration(SCENES_SOCIAL)).toBeGreaterThan(0);
  });
});
