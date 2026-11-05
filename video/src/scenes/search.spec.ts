import { describe, expect, it } from 'vitest';
import { cameraAt, cameraCentre, stageView } from '../kit/math';
import { HERO } from '../../../demo/seed/hero';
import { clientHero, searchByPrefix, woHero } from '../fixtures';
import { FRAMES_PER_BEAT, SCENE_CLICKS, SCENES, SCENES_SOCIAL, sceneStart } from '../timing';
import {
  CALLOUT_AT,
  CLICK_POINT,
  CURSOR_GONE,
  CURSOR_PARK,
  calloutOpacity,
  GRID_TOP,
  HIT,
  MOVE_TO,
  ORDERS,
  QUERY,
  ROW_H,
  ROW_Y0,
  SCROLL,
  SWITCH_AT,
  calloutAnchor,
  CAM,
  searchState,
  SOCIAL_ZONES,
  SOCIAL_MOVE_FROM,
  SOCIAL_SETTLE,
  ORDER_AMOUNTS_X,
} from './Search';

const at = (f: number, social = false) => searchState(f, 30, social);
/** The camera's view in window px at frame f: the whole frame (social: bands included). */
const view = (f: number, social: boolean) => {
  const [w, h] = social ? [1080, 1350] : [1920, 1080];
  const c = cameraAt(f, 30, social ? CAM.social : CAM.wide);
  const o = cameraCentre(social ? 'social' : 'wide', w, h);
  return { l: c.x - o.x / c.zoom, t: c.y - o.y / c.zoom, r: c.x + (w - o.x) / c.zoom, b: c.y + (h - o.y) / c.zoom };
};
/** Social: the stage between the brand band and the caption plaque. */
const stage = (f: number) => stageView(cameraAt(f, 30, CAM.social), 'social', 1080, 1350);
const inside = (v: { l: number; t: number; r: number; b: number }, r: { x: number; y: number; w: number; h: number }) =>
  v.l <= r.x && v.r >= r.x + r.w && v.t <= r.y && v.b >= r.y + r.h;

describe('search scene state', () => {
  it('types the first 7 VIN characters 15–50, one every 5 frames; empty before', () => {
    expect(QUERY).toBe(HERO.r56.vin.slice(0, 7));
    expect(at(0).q).toBe('');
    expect(at(19).q).toBe('');
    expect(at(20).q).toBe(QUERY.slice(0, 1));
    expect(at(45).q).toBe(QUERY.slice(0, 6));
    expect(at(50).q).toBe(QUERY);
    expect(at(62).q).toBe(QUERY);
    const lengths = [...Array(36).keys()].map((i) => at(15 + i).q.length);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i] - lengths[i - 1]).toBeGreaterThanOrEqual(0);
  });

  it('hits are the export for the current prefix (none for the empty query); the last one is the hero R56 alone', () => {
    expect(at(10).hits).toEqual([]);
    for (const f of [20, 30, 40, 50]) expect(at(f).hits).toBe(searchByPrefix[at(f).q]);
    expect(at(50).hits).toHaveLength(1);
    expect(at(50).hits[0]).toMatchObject({ type: 'vehicle', id: HERO.r56.vehicleId, plate: HERO.r56.plate });
    expect(at(50).hits[0].client?.full_name).toBe(HERO.client.name);
  });

  it('click at 60 lands on the hero hit; its effects (palette closes, card opens) 3 frames later', () => {
    expect(SCENE_CLICKS.search).toEqual([60]);
    expect(SWITCH_AT).toBe(63);
    const c = at(60).cursor;
    expect(c).toEqual(CLICK_POINT);
    expect(c.x).toBeGreaterThan(HIT.x);
    expect(c.x).toBeLessThan(HIT.x + HIT.w);
    expect(c.y).toBeGreaterThan(HIT.y);
    expect(c.y).toBeLessThan(HIT.y + HIT.h);
    // Hover on the hit before the press.
    expect(at(52).cursor).toEqual(CLICK_POINT);
    expect(at(62).open).toBe(true);
    expect(at(63).open).toBe(false);
  });

  it('the card lists the hero order on top, then client-hero.json (diagnostics included)', () => {
    expect(clientHero.client.id).toBe(HERO.client.id);
    expect(ORDERS[0]).toBe(woHero[4]);
    expect(ORDERS.slice(1)).toEqual(clientHero.orders);
    expect(ORDERS.findIndex((o) => o.id === HERO.diagnosticsOrderId)).toBe(2);
  });

  it('page scroll: still until the move, then to its end value at 135', () => {
    expect(at(75).scroll).toBe(0);
    expect(at(MOVE_TO).scroll).toBe(SCROLL.wide);
    expect(at(149).scroll).toBe(SCROLL.wide);
    // Social doesn't scroll: its orders shot frames the panel head and the first rows.
    for (const f of [0, 90, MOVE_TO, 149]) expect(at(f, true).scroll).toBe(0);
  });

  it('wide end view: both panels whole, top edge in the gap above them, bottom on a row boundary, inside the window', () => {
    const v = view(140, false);
    expect(v.l).toBeLessThanOrEqual(274);
    expect(v.r).toBeGreaterThanOrEqual(1406);
    const top = v.t + SCROLL.wide;
    const bottom = v.b + SCROLL.wide;
    expect(top).toBeGreaterThan(256);
    expect(top).toBeLessThan(GRID_TOP);
    const rows = (bottom - ROW_Y0) / ROW_H;
    expect(rows).toBeCloseTo(Math.round(rows), 3);
    expect(Math.round(rows)).toBeGreaterThanOrEqual(8);
    expect(v.b).toBeLessThanOrEqual(900);
  });

  it('social: every key at least 1.7×', () => {
    for (const k of CAM.social) expect(k.zoom).toBeGreaterThanOrEqual(1.7);
  });

  it('social zone 1: the palette (input + the hero hit) while it is open', () => {
    for (let f = 0; f < SWITCH_AT; f++) expect(inside(stage(f), SOCIAL_ZONES.palette)).toBe(true);
  });

  it('social zone 2: the card head — back link, name, phone, stats — and the vehicles panel, no orders sliver', () => {
    for (let f = 78; f <= 90; f++) {
      const v = stage(f);
      expect(inside(v, SOCIAL_ZONES.head)).toBe(true);
      expect(v.r).toBeLessThan(710);
    }
  });

  it('social zone 3: a 15-frame move from 90, settled by 105 and held a beat before the slide (social dur 135)', () => {
    const dur = SCENES_SOCIAL.find((x) => x.id === 'search')!.dur;
    expect([SOCIAL_MOVE_FROM, SOCIAL_SETTLE, dur]).toEqual([90, 105, 135]);
    expect(dur - 15 - SOCIAL_SETTLE).toBeGreaterThanOrEqual(FRAMES_PER_BEAT);
  });

  it('social zone 3: the orders panel head and rows 0–7 whole (titles to status chips), the bottom edge on a row line', () => {
    for (let f = SOCIAL_SETTLE; f < SCENES_SOCIAL.find((x) => x.id === 'search')!.dur; f++) {
      const v = stage(f);
      expect(inside(v, SOCIAL_ZONES.orders)).toBe(true);
      expect(v.l).toBeGreaterThan(694); // right of the vehicles panel
      expect(v.t).toBeGreaterThan(256); // under the stats row
      const rows = (v.b - ROW_Y0) / ROW_H;
      expect(rows).toBeCloseTo(8, 2);
      expect(v.r).toBeLessThan(ORDER_AMOUNTS_X); // the amounts are out whole, not cut
      expect(v.b).toBeLessThanOrEqual(900);
    }
  });

  it('callout window: from 45 (on the beat, one hit left) through the switch; wide gone by 75, the social plaque stays', () => {
    expect(CALLOUT_AT).toBe(45);
    expect((sceneStart('search', SCENES) + CALLOUT_AT) % 15).toBe(0);
    expect(at(CALLOUT_AT).hits).toHaveLength(1);
    expect(calloutOpacity(44, false)).toBe(0);
    for (const f of [45, 60, 63, 69]) expect(calloutOpacity(f, false)).toBe(1);
    expect(calloutOpacity(75, false)).toBe(0);
    for (const f of [45, 84, 90, 149]) expect(calloutOpacity(f, true)).toBe(1);
    expect(calloutOpacity(44, true)).toBe(0);
    expect((sceneStart('search', SCENES_SOCIAL) + CALLOUT_AT) % 15).toBe(0);
  });

  it('cursor: leaves the hit from the switch (63), never rests on the card, out of every view by 84', () => {
    expect(at(63).cursor).toEqual(CLICK_POINT);
    const p = at(70).cursor;
    expect(p.x).toBeLessThan(CLICK_POINT.x);
    expect(p.y).toBeGreaterThan(CLICK_POINT.y);
    expect(at(CURSOR_GONE).cursor).toEqual(CURSOR_PARK);
    for (const social of [false, true]) {
      for (let f = CURSOR_GONE; f < 150; f++) {
        const v = view(f, social);
        const c = at(f, social).cursor;
        expect(c.x < v.l || c.x > v.r || c.y < v.t || c.y > v.b).toBe(true);
      }
    }
    // Past the vehicles panel (x 274–694, y 280–461) by 75: in the empty page under it or beyond.
    expect(at(75).cursor.y).toBeGreaterThan(461);
  });

  it('wide callout: right of the palette at the hit, then in the empty stats row, riding with the scroll', () => {
    const a = calloutAnchor(0);
    expect(a.x).toBeGreaterThanOrEqual(HIT.x + HIT.w);
    expect(a.y).toBeGreaterThan(HIT.y);
    expect(a.y).toBeLessThan(HIT.y + HIT.h);
    expect(calloutAnchor(40).y).toBe(a.y - 40);
  });
});
