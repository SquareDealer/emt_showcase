import { describe, expect, it } from 'vitest';
import { dashboard } from '../fixtures';
import { FRAMES_PER_BEAT, SCENE_CLICKS, sceneStart, SCENES, SCENES_SOCIAL } from '../timing';
import { cameraAt, stageView, type View } from '../kit/math';
import { SLATE_TOP, TITLE_OUT } from '../kit/ChapterTitle';
import { clearOfSlate } from '../kit/slate-check';
import {
  CAM,
  SOCIAL_LOAD_AT,
  SOCIAL_TITLES,
  SOCIAL_ZONES,
  TITLES,
  dashboardState,
  GROW,
  labelTop,
  LOAD_AT,
  MOVE,
  REVENUE_AT,
  SOCIAL_LOAD_FROM,
  SOCIAL_MOVE,
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

  it('highlight (wide): none, revenue from 45, load from 150 (after chapter 07) to the end', () => {
    expect(LOAD_AT).toBe(150);
    expect(at(44).highlight).toBeUndefined();
    expect(at(REVENUE_AT).highlight).toBe('revenue');
    expect(at(LOAD_AT - 1).highlight).toBe('revenue');
    expect(at(LOAD_AT).highlight).toBe('load');
    expect(at(209).highlight).toBe('load');
  });

  it('no clicks; the beats are on the grid in the hero (45, 150) and the social cut (45, 75, 90)', () => {
    expect(SCENE_CLICKS.dashboard).toEqual([]);
    for (const f of [REVENUE_AT, LOAD_AT]) expect((sceneStart('dashboard', SCENES) + f) % FRAMES_PER_BEAT).toBe(0);
    for (const f of [REVENUE_AT, SOCIAL_LOAD_FROM, SOCIAL_LOAD_AT]) expect((sceneStart('dashboard', SCENES_SOCIAL) + f) % FRAMES_PER_BEAT).toBe(0);
  });

  it('camera (wide): holds 0–45, settles on the chart by 65, holds it under chapter 07, on the load by 170 and holds', () => {
    const cam = (f: number) => cameraAt(f, 30, CAM.wide);
    expect(cam(0)).toEqual(cam(REVENUE_AT));
    expect(cam(REVENUE_AT + MOVE)).toEqual(cam(LOAD_AT));
    expect(cam(LOAD_AT + MOVE)).toEqual(cam(209));
    expect(cam(209).zoom).toBeGreaterThan(cam(LOAD_AT).zoom);
    expect(TITLES[0].out).toBe(LOAD_AT);
  });

  it('chapter 07 (wide) never covers the revenue chart: the whole panel above the slate while the camera is on it', () => {
    const [t] = TITLES;
    const panel = { x: 274, y: 269.7, w: 686.8, h: 876 - 269.7 };
    for (let f = REVENUE_AT + MOVE; f <= t.out; f++) expect(clearOfSlate(panel, CAM.wide, f, 'dashboard')).toBe(true);
    // The chart's bottom edge (frame) under the revenue key.
    const c = cameraAt(REVENUE_AT + MOVE, 30, CAM.wide);
    expect((876 - c.y) * c.zoom + 540).toBeLessThanOrEqual(SLATE_TOP);
    expect(t.out + TITLE_OUT).toBeLessThanOrEqual(LOAD_AT + MOVE);
  });

  it('camera (social, 180 f): 15-frame moves on the beat — chart 45→60 held to 75, load 75→90 held to the transition (150)', () => {
    const cam = (f: number) => cameraAt(f, 30, CAM.social);
    const dur = SCENES_SOCIAL.find((x) => x.id === 'dashboard')!.dur;
    expect(dur).toBe(180);
    expect(SOCIAL_MOVE).toBe(15);
    expect(SOCIAL_LOAD_FROM).toBe(75);
    expect(cam(0)).toEqual(cam(REVENUE_AT));
    expect(cam(REVENUE_AT + SOCIAL_MOVE)).toEqual(cam(SOCIAL_LOAD_FROM));
    expect(cam(SOCIAL_LOAD_AT)).toEqual(cam(dur - 1));
    expect(cam(dur - 1).zoom).toBeGreaterThan(cam(SOCIAL_LOAD_FROM).zoom);
    expect(SOCIAL_LOAD_FROM - (REVENUE_AT + SOCIAL_MOVE)).toBeGreaterThanOrEqual(FRAMES_PER_BEAT);
    expect(SOCIAL_TITLES[0].out + TITLE_OUT).toBeLessThanOrEqual(dur - 30);
  });

  it('wide chart view: the window\'s left part (sidebar edge) to its right edge; the load view inside the window', () => {
    const r = cameraAt(REVENUE_AT + MOVE, 30, CAM.wide);
    expect(r.x - 960 / r.zoom).toBeGreaterThanOrEqual(0);
    expect(r.x + 960 / r.zoom).toBeCloseTo(1440, 3);
    expect(r.y - 540 / r.zoom).toBeGreaterThanOrEqual(245.7);
    const { x, y, zoom } = cameraAt(209, 30, CAM.wide);
    expect(x - 960 / zoom).toBeGreaterThanOrEqual(240);
    expect(x + 960 / zoom).toBeLessThanOrEqual(1440);
    expect(y - 540 / zoom).toBeGreaterThanOrEqual(0);
    expect(y + 540 / zoom).toBeLessThanOrEqual(900);
  });

  it('labelTop matches the measured labels (Sep 463.3, Oct 345.9)', () => {
    const rev = dashboard.revenueByMonth.map((m) => m.revenue);
    const top = Math.max(...rev);
    expect(labelTop(rev[3], top)).toBeCloseTo(463.3, 0);
    expect(labelTop(rev[4], top)).toBeCloseTo(345.9, 0);
  });

  describe('social: one zone at a time, at least 1.7×', () => {
    const view = (f: number) => stageView(cameraAt(f, 30, CAM.social), 'social', 1080, 1350);
    const inside = (v: View, r: { x: number; y: number; w: number; h: number }) =>
      v.l <= r.x && v.r >= r.x + r.w && v.t <= r.y && v.b >= r.y + r.h;
    const dur = SCENES_SOCIAL.find((x) => x.id === 'dashboard')!.dur;
    it('every social key is at least 1.7×', () => {
      for (const k of CAM.social) expect(k.zoom).toBeGreaterThanOrEqual(1.7);
    });
    it('no \'revenue\' ring in social (its shot crops the panel\'s sides); \'load\' from 90', () => {
      for (const f of [0, REVENUE_AT, 60, SOCIAL_LOAD_AT - 1]) expect(dashboardState(f, 30, true).highlight).toBeUndefined();
      for (const f of [SOCIAL_LOAD_AT, 179]) expect(dashboardState(f, 30, true).highlight).toBe('load');
      expect(dashboardState(REVENUE_AT, 30).highlight).toBe('revenue');
    });
    it('0–45: the revenue KPI card whole while it counts up', () => {
      for (let f = 0; f <= REVENUE_AT; f++) expect(inside(view(f), SOCIAL_ZONES.kpi)).toBe(true);
    });
    it('60–75: the chart — title, every bar and label, the month ticks; the footnote wholly out', () => {
      for (let f = REVENUE_AT + SOCIAL_MOVE; f <= SOCIAL_LOAD_FROM; f++) {
        const v = view(f);
        expect(inside(v, SOCIAL_ZONES.chart)).toBe(true);
        expect(v.b).toBeLessThan(841);
      }
    });
    it('90–end: the masters\' load panel whole, right of the revenue panel', () => {
      for (let f = SOCIAL_LOAD_AT; f < dur; f++) {
        const v = view(f);
        expect(inside(v, SOCIAL_ZONES.load)).toBe(true);
        expect(v.l).toBeGreaterThan(960.8);
        expect(v.r).toBeLessThanOrEqual(1440);
      }
    });
  });
});
