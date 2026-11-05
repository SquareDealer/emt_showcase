import { describe, expect, it } from 'vitest';
import { cameraAt, stageView, type View } from '../kit/math';
import { CAM, CALLOUT_AT, DAY_HEADS_Y, LAND_AT, MENU, MENU_IN, SLOT } from './Booking';
import { SCENES_SOCIAL, SCENE_CLICKS, sceneStart } from '../timing';

const social = (f: number) => stageView(cameraAt(f, 30, CAM.social), 'social', 1080, 1350);
const inside = (v: View, r: { x: number; y: number; w: number; h: number }) =>
  v.l <= r.x && v.r >= r.x + r.w && v.t <= r.y && v.b >= r.y + r.h;

describe('booking social camera', () => {
  it('every social key is at least 1.7×', () => {
    for (const k of CAM.social) expect(k.zoom).toBeGreaterThanOrEqual(1.7);
  });
  it('the slot is on the stage from the start through the click', () => {
    for (let f = 0; f <= SCENE_CLICKS.booking[0]; f++) expect(inside(social(f), SLOT)).toBe(true);
  });
  it('one zone from the menu on: slot + menu + the day heads above them, between the bands', () => {
    for (let f = MENU_IN; f <= LAND_AT; f++) {
      const v = social(f);
      expect(inside(v, SLOT)).toBe(true);
      expect(inside(v, MENU)).toBe(true);
      expect(v.t).toBeLessThanOrEqual(DAY_HEADS_Y);
    }
  });
  it('the landed order stays on the stage to the scene\'s social end', () => {
    const end = SCENES_SOCIAL.find((s) => s.id === 'booking')!.dur;
    for (let f = LAND_AT; f < end; f++) expect(inside(social(f), SLOT)).toBe(true);
  });
  it('the callout is on the beat in the social cut', () => {
    expect((sceneStart('booking', SCENES_SOCIAL) + CALLOUT_AT) % 15).toBe(0);
  });
});
