import { describe, expect, it } from 'vitest';
import { cameraAt, cameraCentre, stageView } from '../kit/math';
import { HERO } from '../../../demo/seed/hero';
import { clientHero, searchByPrefix, woHero } from '../fixtures';
import { FRAMES_PER_BEAT, SCENE_CLICKS, SCENES_SOCIAL, TRANSITION } from '../timing';
import { TITLE_OUT } from '../kit/ChapterTitle';
import { clearOfSlate } from '../kit/slate-check';
import {
  CLICK_POINT,
  CURSOR_GONE,
  CURSOR_PARK,
  GRID_TOP,
  PALETTE_AT,
  TITLES,
  HIT,
  MOVE_FROM,
  MOVE_TO,
  ORDERS,
  QUERY,
  ROW_H,
  ROW_Y0,
  SCROLL,
  SWITCH_AT,
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
  it('the board alone through the transition; ⌘K opens the palette a beat after it (30), never under the wipe', () => {
    expect(PALETTE_AT).toBe(TRANSITION);
    for (const f of [0, 15, 29]) expect(at(f)).toMatchObject({ open: true, palette: false });
    expect(at(PALETTE_AT).palette).toBe(true);
  });

  it('types the first 7 VIN characters 45–80, one every 5 frames; empty before', () => {
    expect(QUERY).toBe(HERO.r56.vin.slice(0, 7));
    expect(at(0).q).toBe('');
    expect(at(49).q).toBe('');
    expect(at(50).q).toBe(QUERY.slice(0, 1));
    expect(at(75).q).toBe(QUERY.slice(0, 6));
    expect(at(80).q).toBe(QUERY);
    expect(at(92).q).toBe(QUERY);
    const lengths = [...Array(36).keys()].map((i) => at(45 + i).q.length);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i] - lengths[i - 1]).toBeGreaterThanOrEqual(0);
  });

  it('hits are the export for the current prefix (none for the empty query); the last one is the hero R56 alone', () => {
    expect(at(40).hits).toEqual([]);
    for (const f of [50, 60, 70, 80]) expect(at(f).hits).toBe(searchByPrefix[at(f).q]);
    expect(at(80).hits).toHaveLength(1);
    expect(at(80).hits[0]).toMatchObject({ type: 'vehicle', id: HERO.r56.vehicleId, plate: HERO.r56.plate });
    expect(at(80).hits[0].client?.full_name).toBe(HERO.client.name);
  });

  it('click at 90 lands on the hero hit; its effects (palette closes, card opens) 3 frames later', () => {
    expect(SCENE_CLICKS.search).toEqual([90]);
    expect(SWITCH_AT).toBe(93);
    const c = at(90).cursor;
    expect(c).toEqual(CLICK_POINT);
    expect(c.x).toBeGreaterThan(HIT.x);
    expect(c.x).toBeLessThan(HIT.x + HIT.w);
    expect(c.y).toBeGreaterThan(HIT.y);
    expect(c.y).toBeLessThan(HIT.y + HIT.h);
    // Hover on the hit before the press.
    expect(at(82).cursor).toEqual(CLICK_POINT);
    expect(at(92).open).toBe(true);
    expect(at(93).open).toBe(false);
  });

  it('the card lists the hero order on top, then client-hero.json (diagnostics included)', () => {
    expect(clientHero.client.id).toBe(HERO.client.id);
    expect(ORDERS[0]).toBe(woHero[4]);
    expect(ORDERS.slice(1)).toEqual(clientHero.orders);
    expect(ORDERS.findIndex((o) => o.id === HERO.diagnosticsOrderId)).toBe(2);
  });

  it('page scroll: still until the move, then to its end value at 165', () => {
    expect(at(105).scroll).toBe(0);
    expect(at(MOVE_TO).scroll).toBe(SCROLL.wide);
    expect(at(224).scroll).toBe(SCROLL.wide);
    // Social doesn't scroll: its orders shot frames the panel head and the first rows.
    for (const f of [0, 120, MOVE_TO, 224]) expect(at(f, true).scroll).toBe(0);
  });

  it('wide end view: both panels whole, top edge in the gap above them, bottom on a row boundary, inside the window', () => {
    const v = view(170, false);
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
    for (let f = PALETTE_AT; f < SWITCH_AT; f++) expect(inside(stage(f), SOCIAL_ZONES.palette)).toBe(true);
  });

  it('social zone 2: the card head — back link, name, phone, stats — and the vehicles panel, no orders sliver', () => {
    for (let f = 108; f <= 120; f++) {
      const v = stage(f);
      expect(inside(v, SOCIAL_ZONES.head)).toBe(true);
      expect(v.r).toBeLessThan(710);
    }
  });

  it('social zone 3: a 15-frame move from 120, settled by 135 and held to the transition (social dur 225)', () => {
    const dur = SCENES_SOCIAL.find((x) => x.id === 'search')!.dur;
    expect([SOCIAL_MOVE_FROM, SOCIAL_SETTLE, dur]).toEqual([120, 135, 225]);
    expect(dur - TRANSITION - SOCIAL_SETTLE).toBeGreaterThanOrEqual(FRAMES_PER_BEAT);
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

  it('chapter 06 enters with one hit left (75) and never covers the palette, the hit, the card head or the top orders', () => {
    const [t] = TITLES;
    expect(t.at).toBe(75);
    expect(at(t.at).hits).toHaveLength(1);
    for (let f = t.at; f < t.out + TITLE_OUT; f++) {
      if (at(f).palette) expect(clearOfSlate({ x: 410, y: 108, w: 620, h: 184 }, CAM.wide, f, 'vin')).toBe(true);
      else {
        // The card head (back link to the stats) until the camera moves down the history, and the hero
        // order with the diagnostics under it throughout.
        if (f < MOVE_FROM) expect(clearOfSlate({ x: 274, y: 81 - at(f).scroll, w: 1132, h: 175 }, CAM.wide, f, 'vin')).toBe(true);
        expect(clearOfSlate({ x: 710, y: ROW_Y0 - at(f).scroll, w: 696, h: ROW_H * 3 }, CAM.wide, f, 'vin')).toBe(true);
      }
    }
  });

  it('cursor: leaves the hit from the switch (93), never rests on the card, out of every view by 114', () => {
    expect(at(93).cursor).toEqual(CLICK_POINT);
    const p = at(100).cursor;
    expect(p.x).toBeLessThan(CLICK_POINT.x);
    expect(p.y).toBeGreaterThan(CLICK_POINT.y);
    expect(at(CURSOR_GONE).cursor).toEqual(CURSOR_PARK);
    for (const social of [false, true]) {
      for (let f = CURSOR_GONE; f < 225; f++) {
        const v = view(f, social);
        const c = at(f, social).cursor;
        expect(c.x < v.l || c.x > v.r || c.y < v.t || c.y > v.b).toBe(true);
      }
    }
    // Past the vehicles panel (x 274–694, y 280–461) by 105: in the empty page under it or beyond.
    expect(at(105).cursor.y).toBeGreaterThan(461);
  });
});
