import { describe, expect, it } from 'vitest';
import { cameraAt, cursorAt, maxPointerStep, stageView, type View } from '../kit/math';
import {
  BANDS,
  CALLOUT_ANCHOR,
  CAM,
  CALLOUT_AT,
  CURSOR,
  LAND_AT,
  MENU,
  MENU_IN,
  SCROLL,
  SLOT,
  TIME_AXIS_Y,
  bookingScroll,
  bookingState,
} from './Booking';
import { SCENES_SOCIAL, SCENE_CLICKS, sceneStart } from '../timing';

const FPS = 30;
const social = (f: number) => stageView(cameraAt(f, FPS, CAM.social), 'social', 1080, 1350);
const wide = (f: number) => stageView(cameraAt(f, FPS, CAM.wide), 'wide', 1920, 1080);
const inside = (v: View, r: { x: number; y: number; w: number; h: number }) =>
  v.l <= r.x && v.r >= r.x + r.w && v.t <= r.y && v.b >= r.y + r.h;
const within = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
/** `[data-demo="slot-booking"]` as measured (menu at MENU). */
const BOOKING_ROW = { x: 455, y: 667.5, w: 386, h: 54.5 };
/** Wednesday's row top, scrolled (617.5 − SCROLL). */
const WED_TOP = 337.5;
const [CLICK_SLOT, CLICK_BOOKING] = SCENE_CLICKS.booking;

describe('booking geometry (horizontal calendar)', () => {
  it('the rows derived from the fixtures are the measured ones (lane counts Mon … Sun)', () => {
    expect(BANDS).toEqual([160, 240, 240, 240, 160, 160, 120]);
    expect(SCROLL).toBe(280);
  });
  it('the slot is the measured ghost box: Thu 14:00–16:00, Thursday\'s whole row', () => {
    expect(SLOT.x).toBeCloseTo(872, 1);
    expect(SLOT.y).toBe(580.5);
    expect(SLOT.w).toBeCloseTo(181, 1);
    expect(SLOT.h).toBe(235);
  });
  it('the menu sits inside the window, left of the slot, without covering it', () => {
    expect(MENU.x).toBeGreaterThanOrEqual(264); // the timeline box's left edge
    expect(MENU.x + MENU.w).toBeLessThan(SLOT.x);
    expect(MENU.y).toBeGreaterThanOrEqual(0);
    expect(MENU.y + MENU.h).toBeLessThanOrEqual(900);
  });
  it('the timeline scrolls to Thursday with the camera\'s push (30–60) and stays there', () => {
    for (const f of [0, 30]) expect(bookingScroll(f)).toBe(0);
    for (const f of [60, 75, 120, 179]) expect(bookingScroll(f)).toBe(SCROLL);
    expect(bookingState(0, FPS).scroll).toBe(0);
  });
});

describe('booking cursor', () => {
  it('is on the slot at its click and on «Новая запись» at its click', () => {
    expect(within(cursorAt(CLICK_SLOT, FPS, CURSOR), SLOT)).toBe(true);
    expect(within(cursorAt(CLICK_BOOKING, FPS, CURSOR), BOOKING_ROW)).toBe(true);
  });
  it('is paced: no step above 75 px on screen, wide and social (steps the viewer sees)', () => {
    expect(maxPointerStep(CURSOR, CAM.wide, FPS, 0, 180).max).toBeLessThanOrEqual(75);
    const end = SCENES_SOCIAL.find((s) => s.id === 'booking')!.dur;
    const seen = (f: number, p: { x: number; y: number }) => {
      const v = social(f);
      return p.x >= v.l && p.x <= v.r && p.y >= v.t && p.y <= v.b;
    };
    expect(maxPointerStep(CURSOR, CAM.social, FPS, 0, end, seen).max).toBeLessThanOrEqual(75);
  });
});

describe('booking wide camera', () => {
  it('holds the time axis, the slot, the menu and the callout from the scroll\'s end to the dive', () => {
    for (let f = 60; f <= 150; f++) {
      const v = wide(f);
      const zoom = cameraAt(f, FPS, CAM.wide).zoom;
      expect(inside(v, SLOT)).toBe(true);
      expect(inside(v, MENU)).toBe(true);
      expect(v.t).toBeLessThanOrEqual(TIME_AXIS_Y);
      // the pill under the dot: 18 + 7 px gap and ≈ 60 px tall on screen, ≥ 30 px clear of the frame's edge
      expect(v.b - CALLOUT_ANCHOR.y).toBeGreaterThanOrEqual((25 + 60 + 30) / zoom);
    }
  });
  it('keeps the window\'s bottom and right edges at the frame\'s (no background) from the hold through the dive', () => {
    for (let f = 60; f < 180; f++) {
      const v = wide(f);
      expect(v.b).toBeLessThanOrEqual(900.001);
      expect(v.r).toBeLessThanOrEqual(1440.001);
    }
  });
});

describe('booking social camera', () => {
  it('every social key is at least 1.7×', () => {
    for (const k of CAM.social) expect(k.zoom).toBeGreaterThanOrEqual(1.7);
  });
  it('the slot is on the stage from the scroll\'s end through the click', () => {
    for (let f = 60; f <= CLICK_SLOT; f++) expect(inside(social(f), SLOT)).toBe(true);
  });
  it('one zone from the menu on: slot + menu + Wednesday\'s row above them, between the bands', () => {
    for (let f = MENU_IN; f <= LAND_AT; f++) {
      const v = social(f);
      expect(inside(v, SLOT)).toBe(true);
      expect(inside(v, MENU)).toBe(true);
      expect(v.t).toBeLessThanOrEqual(WED_TOP);
    }
  });
  it('the camera does not move before the landing (the timeline scrolls under it)', () => {
    for (let f = 1; f <= LAND_AT; f++) expect(cameraAt(f, FPS, CAM.social)).toEqual(cameraAt(0, FPS, CAM.social));
  });
  it('the landed order stays on the stage to the scene\'s social end, the window\'s bottom never above the plaque', () => {
    const end = SCENES_SOCIAL.find((s) => s.id === 'booking')!.dur;
    for (let f = LAND_AT; f < end; f++) {
      expect(inside(social(f), SLOT)).toBe(true);
      expect(social(f).b).toBeLessThanOrEqual(900.001);
    }
  });
  it('the callout is on the beat in the social cut', () => {
    expect((sceneStart('booking', SCENES_SOCIAL) + CALLOUT_AT) % 15).toBe(0);
  });
});
