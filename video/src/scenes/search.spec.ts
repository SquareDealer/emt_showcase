import { describe, expect, it } from 'vitest';
import { cameraAt } from '../kit/math';
import { HERO } from '../../../demo/seed/hero';
import { clientHero, searchByPrefix, woHero } from '../fixtures';
import { SCENE_CLICKS } from '../timing';
import {
  CLICK_POINT,
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
  cameraKeys,
  searchState,
} from './Search';

const at = (f: number, social = false) => searchState(f, 30, social);
/** The camera's view in window px at frame f: [left, top, right, bottom]. */
const view = (f: number, social: boolean) => {
  const [w, h] = social ? [1080, 1350] : [1920, 1080];
  const c = cameraAt(f, 30, cameraKeys(social));
  return { l: c.x - w / 2 / c.zoom, t: c.y - h / 2 / c.zoom, r: c.x + w / 2 / c.zoom, b: c.y + h / 2 / c.zoom };
};

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
    expect(at(90, true).scroll).toBe(0);
    expect(at(MOVE_TO, true).scroll).toBe(SCROLL.social);
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

  it('social end view: the orders panel edge to edge, all 13 rows inside the window', () => {
    const v = view(140, true);
    expect(v.l).toBeLessThanOrEqual(710);
    expect(v.r).toBeGreaterThanOrEqual(1406);
    expect(v.t).toBeGreaterThanOrEqual(0);
    expect(v.b).toBeLessThanOrEqual(900);
    expect(ROW_Y0 + ROW_H * ORDERS.length - SCROLL.social).toBeLessThanOrEqual(v.b);
  });

  it('wide callout: right of the palette at the hit, then in the empty stats row, riding with the scroll', () => {
    const a = calloutAnchor(false, 0);
    expect(a.x).toBeGreaterThanOrEqual(HIT.x + HIT.w);
    expect(a.y).toBeGreaterThan(HIT.y);
    expect(a.y).toBeLessThan(HIT.y + HIT.h);
    expect(calloutAnchor(false, 40).y).toBe(a.y - 40);
  });
});
