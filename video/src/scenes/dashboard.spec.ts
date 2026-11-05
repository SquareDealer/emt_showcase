import { describe, expect, it } from 'vitest';
import { dashboard } from '../fixtures';
import { FRAMES_PER_BEAT, SCENE_CLICKS, sceneStart, SCENES, SCENES_SOCIAL } from '../timing';
import { cameraAt, stageView, type View } from '../kit/math';
import {
  CALLOUT_AT,
  CALLOUT_OUT,
  calloutOpacity,
  CAM,
  SOCIAL_ZONES,
  dashboardState,
  GROW,
  labelTop,
  PILL_BOTTOM,
  LOAD_AT,
  MOVE,
  REVENUE_AT,
} from './Dashboard';

const at = (f: number) => dashboardState(f, 30);

describe('dashboard scene state', () => {
  it('starts from zero: empty bars, KPIs at 0', () => {
    const s = at(0);
    expect(s.progress).toBe(0);
    expect(s.data.kpi).toMatchObject({ revenue: 0, orders: 0, avgTicket: 0 });
  });

  it('at rest (GROW and after) the numbers are exactly the fixture', () => {
    for (const f of [GROW, 90, 149]) {
      const s = at(f);
      expect(s.progress).toBe(1);
      expect(s.data.kpi).toEqual(dashboard.kpi);
      expect(s.data.revenueByMonth).toBe(dashboard.revenueByMonth);
    }
  });

  it('the KPIs count up monotonically, integers stay integers', () => {
    let prev = at(0).data.kpi;
    for (let f = 1; f <= GROW; f++) {
      const k = at(f).data.kpi;
      expect(k.revenue).toBeGreaterThanOrEqual(prev.revenue);
      expect(k.orders).toBeGreaterThanOrEqual(prev.orders);
      expect(Number.isInteger(k.orders) && Number.isInteger(k.avgTicket)).toBe(true);
      expect(Math.round(k.revenue * 100)).toBeCloseTo(k.revenue * 100, 6);
      prev = k;
    }
    expect(at(GROW - 1).data.kpi.revenue).toBeLessThan(dashboard.kpi.revenue);
  });

  it('highlight: none, revenue from 45, load from 90 to the end', () => {
    expect(at(44).highlight).toBeUndefined();
    expect(at(REVENUE_AT).highlight).toBe('revenue');
    expect(at(LOAD_AT - 1).highlight).toBe('revenue');
    expect(at(LOAD_AT).highlight).toBe('load');
    expect(at(149).highlight).toBe('load');
  });

  it('no clicks; the beats (45, 60, 90) are on the grid in the hero and the social cut', () => {
    expect(SCENE_CLICKS.dashboard).toEqual([]);
    for (const scenes of [SCENES, SCENES_SOCIAL]) {
      for (const f of [REVENUE_AT, CALLOUT_AT, LOAD_AT]) expect((sceneStart('dashboard', scenes) + f) % FRAMES_PER_BEAT).toBe(0);
    }
  });

  it('callout: invisible before 60, gone before the camera leaves the chart', () => {
    expect(calloutOpacity(CALLOUT_AT - 1, false)).toBe(0);
    expect(calloutOpacity(CALLOUT_AT, false)).toBe(1);
    expect(calloutOpacity(CALLOUT_OUT, false)).toBe(1);
    expect(calloutOpacity(LOAD_AT, false)).toBe(0);
  });

  it('social callout: the plaque from 60 to the end (its text names both the revenue and the load)', () => {
    expect(calloutOpacity(CALLOUT_AT - 1, true)).toBe(0);
    for (const f of [CALLOUT_AT, LOAD_AT, 134]) expect(calloutOpacity(f, true)).toBe(1);
  });

  it.each([false, true])('camera (social=%s): holds 0–45, settles on the chart by 65, on the load by 110 and holds', (social) => {
    const keys = social ? CAM.social : CAM.wide;
    const cam = (f: number) => cameraAt(f, 30, keys);
    expect(cam(0)).toEqual(cam(REVENUE_AT));
    expect(cam(REVENUE_AT + MOVE)).toEqual(cam(LOAD_AT));
    expect(cam(LOAD_AT + MOVE)).toEqual(cam(149));
    expect(cam(149).zoom).toBeGreaterThan(cam(LOAD_AT).zoom);
  });

  it('wide chart and load views stay inside the 1440×900 window', () => {
    const keys = CAM.wide;
    for (const f of [REVENUE_AT + MOVE, 149]) {
      const { x, y, zoom } = cameraAt(f, 30, keys);
      expect(x - 960 / zoom).toBeGreaterThanOrEqual(240);
      expect(x + 960 / zoom).toBeLessThanOrEqual(1440);
      expect(y - 540 / zoom).toBeGreaterThanOrEqual(0);
      expect(y + 540 / zoom).toBeLessThanOrEqual(900);
    }
  });

  it('labelTop matches the measured labels (Sep 463.3, Oct 345.9) and Jun–Sep clear the wide pill', () => {
    const rev = dashboard.revenueByMonth.map((m) => m.revenue);
    const top = Math.max(...rev);
    expect(labelTop(rev[3], top)).toBeCloseTo(463.3, 0);
    expect(labelTop(rev[4], top)).toBeCloseTo(345.9, 0);
    for (const v of rev.slice(0, 4)) expect(labelTop(v, top)).toBeGreaterThan(PILL_BOTTOM + 8);
  });

  describe('social: one zone at a time, at least 1.7×', () => {
    const view = (f: number) => stageView(cameraAt(f, 30, CAM.social), 'social', 1080, 1350);
    const inside = (v: View, r: { x: number; y: number; w: number; h: number }) =>
      v.l <= r.x && v.r >= r.x + r.w && v.t <= r.y && v.b >= r.y + r.h;
    const dur = SCENES_SOCIAL.find((x) => x.id === 'dashboard')!.dur;
    it('every social key is at least 1.7×', () => {
      for (const k of CAM.social) expect(k.zoom).toBeGreaterThanOrEqual(1.7);
    });
    it('0–45: the revenue KPI card whole while it counts up', () => {
      for (let f = 0; f <= REVENUE_AT; f++) expect(inside(view(f), SOCIAL_ZONES.kpi)).toBe(true);
    });
    it('65–90: the chart — title, every bar and label, the month ticks; the footnote wholly out', () => {
      for (let f = REVENUE_AT + MOVE; f <= LOAD_AT; f++) {
        const v = view(f);
        expect(inside(v, SOCIAL_ZONES.chart)).toBe(true);
        expect(v.b).toBeLessThan(841);
      }
    });
    it('110–end: the masters\' load panel whole, right of the revenue panel', () => {
      for (let f = LOAD_AT + MOVE; f < dur; f++) {
        const v = view(f);
        expect(inside(v, SOCIAL_ZONES.load)).toBe(true);
        expect(v.l).toBeGreaterThan(960.8);
        expect(v.r).toBeLessThanOrEqual(1440);
      }
    });
  });
});
