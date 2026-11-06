import { describe, expect, it } from 'vitest';
import { cameraAt, cursorAt, maxPointerStep, stageView, type View } from '../kit/math';
import { clearOfSlate } from '../kit/slate-check';
import { TITLE_OUT } from '../kit/ChapterTitle';
import {
  BANDS,
  CAM,
  CURSOR,
  LAND_AT,
  PUSH_FROM,
  PUSH_TO,
  TITLES,
  landedCardRect,
  MENU,
  MENU_IN,
  SCROLL,
  SLOT,
  TIME_AXIS_Y,
  bookingScroll,
  bookingState,
} from './Booking';
import { SCENES, SCENES_SOCIAL, SCENE_CLICKS, TRANSITION } from '../timing';

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
    for (const f of [60, 75, 120, 179, 209]) expect(bookingScroll(f)).toBe(SCROLL);
    expect(bookingState(0, FPS).scroll).toBe(0);
  });
});

describe('booking cursor', () => {
  it('is on the slot at its click and on «Новая запись» at its click', () => {
    expect(within(cursorAt(CLICK_SLOT, FPS, CURSOR), SLOT)).toBe(true);
    expect(within(cursorAt(CLICK_BOOKING, FPS, CURSOR), BOOKING_ROW)).toBe(true);
  });
  it('is paced: no step above 75 px on screen, wide and social (steps the viewer sees)', () => {
    expect(maxPointerStep(CURSOR, CAM.wide, FPS, 0, 210).max).toBeLessThanOrEqual(75);
    const end = SCENES_SOCIAL.find((s) => s.id === 'booking')!.dur;
    const seen = (f: number, p: { x: number; y: number }) => {
      const v = social(f);
      return p.x >= v.l && p.x <= v.r && p.y >= v.t && p.y <= v.b;
    };
    expect(maxPointerStep(CURSOR, CAM.social, FPS, 0, end, seen).max).toBeLessThanOrEqual(75);
  });
});

describe('booking wide camera', () => {
  it('holds the time axis, the slot and the menu from the scroll\'s end to the push', () => {
    for (let f = 60; f <= PUSH_FROM; f++) {
      const v = wide(f);
      expect(inside(v, SLOT)).toBe(true);
      expect(inside(v, MENU)).toBe(true);
      expect(v.t).toBeLessThanOrEqual(TIME_AXIS_Y);
    }
  });
  it('chapter 01 never covers the slot (and the order landing in it) nor the open menu', () => {
    const [t] = TITLES;
    for (let f = t.at; f < t.out + TITLE_OUT; f++) {
      expect(clearOfSlate(SLOT, CAM.wide, f, 'booking')).toBe(true);
      if (bookingState(f, FPS).menuOpacity > 0) expect(clearOfSlate(MENU, CAM.wide, f, 'booking')).toBe(true);
    }
  });
  it('the window\'s right edge stays at the frame\'s, its bottom at most 8 UI px above it, through the push', () => {
    for (let f = 60; f < 210; f++) {
      const v = wide(f);
      expect(v.b).toBeLessThanOrEqual(908.001);
      expect(v.r).toBeLessThanOrEqual(1440.001);
    }
  });
  it('the push into the landed card (165–210) starts once chapter 01 is gone and spans the transition', () => {
    const dur = SCENES.find((s) => s.id === 'booking')!.dur;
    expect(PUSH_TO).toBe(dur);
    expect(PUSH_FROM).toBeGreaterThanOrEqual(TITLES[0].out + TITLE_OUT);
    expect(PUSH_FROM).toBeLessThanOrEqual(dur - TRANSITION);
    // The order lands, is outlined, and holds alone a beat before the camera moves.
    expect(PUSH_FROM - (LAND_AT + 15)).toBeGreaterThanOrEqual(15);
  });
  it('the card the estimate opens out of: the landed order\'s box on screen, growing with the push', () => {
    const r0 = landedCardRect(PUSH_FROM, 'wide', 1920, 1080);
    const r1 = landedCardRect(PUSH_TO, 'wide', 1920, 1080);
    expect(r0.w).toBeCloseTo(SLOT.w * 1.5, 3);
    expect(r1.w).toBeCloseTo(SLOT.w * 2.6, 3);
    // At the end the card is whole and centred in the frame.
    expect(r1.x).toBeGreaterThan(0);
    expect(r1.x + r1.w).toBeLessThan(1920);
    expect(r1.y).toBeGreaterThan(0);
    expect(r1.y + r1.h).toBeLessThan(1080);
    expect(Math.abs(r1.x + r1.w / 2 - 960)).toBeLessThan(1);
    const s1 = landedCardRect(PUSH_TO, 'social', 1080, 1350);
    expect(s1.x).toBeGreaterThan(0);
    expect(s1.x + s1.w).toBeLessThan(1080);
    expect(s1.y).toBeGreaterThan(120);
    expect(s1.y + s1.h).toBeLessThan(1350 - 260);
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
  it('the landed order stays on the stage to the scene\'s social end, the window\'s bottom never above the band', () => {
    const end = SCENES_SOCIAL.find((s) => s.id === 'booking')!.dur;
    for (let f = LAND_AT; f < end; f++) {
      expect(inside(social(f), SLOT)).toBe(true);
      expect(social(f).b).toBeLessThanOrEqual(900.001);
    }
  });
});
