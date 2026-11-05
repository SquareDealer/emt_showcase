import { describe, expect, it } from 'vitest';
import { dashboard } from '../fixtures';
import { FRAMES_PER_BEAT, SCENE_CLICKS, sceneStart, SCENES, SCENES_SOCIAL } from '../timing';
import { cameraAt } from '../kit/math';
import {
  CALLOUT_AT,
  CALLOUT_OUT,
  calloutOpacity,
  cameraKeys,
  dashboardState,
  GROW,
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
    expect(calloutOpacity(CALLOUT_AT - 1)).toBe(0);
    expect(calloutOpacity(CALLOUT_AT)).toBe(1);
    expect(calloutOpacity(CALLOUT_OUT)).toBe(1);
    expect(calloutOpacity(LOAD_AT)).toBe(0);
  });

  it.each([false, true])('camera (social=%s): holds 0–45, settles on the chart by 65, on the load by 110 and holds', (social) => {
    const keys = cameraKeys(social);
    const cam = (f: number) => cameraAt(f, 30, keys);
    expect(cam(0)).toEqual(cam(REVENUE_AT));
    expect(cam(REVENUE_AT + MOVE)).toEqual(cam(LOAD_AT));
    expect(cam(LOAD_AT + MOVE)).toEqual(cam(149));
    expect(cam(149).zoom).toBeGreaterThan(cam(LOAD_AT).zoom);
  });

  it('wide chart and load views stay inside the 1440×900 window', () => {
    const keys = cameraKeys(false);
    for (const f of [REVENUE_AT + MOVE, 149]) {
      const { x, y, zoom } = cameraAt(f, 30, keys);
      expect(x - 960 / zoom).toBeGreaterThanOrEqual(240);
      expect(x + 960 / zoom).toBeLessThanOrEqual(1440);
      expect(y - 540 / zoom).toBeGreaterThanOrEqual(0);
      expect(y + 540 / zoom).toBeLessThanOrEqual(900);
    }
  });
});
