import { describe, expect, it } from 'vitest';
import { orderTotal } from '@crm/lib/format';
import { woHero } from '../fixtures';
import { cameraAt, stageView, type View } from '../kit/math';
import { SCENES_SOCIAL, sceneStart } from '../timing';
import { CAM, SOCIAL_CALLOUTS, SOCIAL_ZONES, estimateState, newLineIds } from './Estimate';

const at = (f: number) => estimateState(f, 30);
/** Lines of wo-hero.1 absent in wo-hero.0, in rowStyle order (works, then parts). */
const NEW = newLineIds(woHero[0], woHero[1]);

describe('estimate scene state', () => {
  it('new lines come from the fixtures: the template work + its parts without the oil', () => {
    expect(NEW).toHaveLength(1 + (woHero[1].part_lines ?? []).length);
    expect(NEW[0]).toBe(woHero[1].labor_lines!.at(-1)!.id);
  });

  it('switches snapshots 3 frames after the confirm press (153), on the kit discount (195) and the order discount (225)', () => {
    expect(at(152).wo.labor_lines).toBe(woHero[0].labor_lines);
    expect(at(153).wo).toBe(woHero[1]);
    expect(at(195).wo).toBe(woHero[2]);
    expect(at(224).wo).toBe(woHero[2]);
    expect(at(225).wo.part_lines).toBe(woHero[3].part_lines);
  });

  it('totals: 2 200 → 44 400 → 42 910 → counts to 40 764,50 by 255', () => {
    expect(at(0).wo.total_cached).toBe(2200);
    expect(at(160).wo.total_cached).toBe(44400);
    expect(at(200).wo.total_cached).toBe(42910);
    expect(at(225).wo.total_cached).toBe(orderTotal(woHero[2]));
    expect(at(255).wo.total_cached).toBe(40764.5);
    expect(at(269).wo.total_cached).toBe(orderTotal(woHero[3]));
  });

  it('the sheet: open 80–152 (still under the confirm press), all parts until the oil click, button 47 600 → 42 200', () => {
    expect(at(79).modalOpacity).toBe(0);
    expect(at(100).modalOpacity).toBeCloseTo(1);
    expect(at(152).modalOpacity).toBeCloseTo(1);
    expect(at(153).modalOpacity).toBe(0);
    expect(at(119).picked.size).toBe(5);
    expect(at(120).picked.size).toBe(4);
    expect(at(119).buttonTotal).toBe(47600);
    expect(at(132).buttonTotal).toBe(42200);
  });

  it('only the lines new in snapshot 1 animate in, staggered by 3 frames; their headers fade with them', () => {
    const old = woHero[0].labor_lines![0].id;
    expect(at(155).rowStyle(old)).toBeUndefined();
    expect(at(155).rowStyle(NEW[0])?.opacity).toBe(0);
    const s = at(159);
    expect(s.rowStyle(NEW[0])?.opacity).toBeGreaterThan(s.rowStyle(NEW[1])!.opacity as number);
    expect(at(185).rowStyle(NEW.at(-1)!)).toBeUndefined();
    expect(at(153).headerMasks).toEqual([1, 1]);
    expect(at(185).headerMasks).toEqual([0, 0]);
    expect(at(150).headerMasks).toEqual([0, 0]);
  });

  it('discount type «%» 3 frames after the 210 click, then «5»', () => {
    expect(at(212).discountDraft).toBeUndefined();
    expect(at(213).discountDraft).toEqual({ type: 'percent', value: '' });
    expect(at(218).discountDraft).toEqual({ type: 'percent', value: '5' });
    expect(at(240).discountDraft).toEqual({ type: 'percent', value: '5' });
  });
});

describe('estimate social camera and captions', () => {
  const view = (f: number) => stageView(cameraAt(f, 30, CAM.social), 'social', 1080, 1350);
  const inside = (v: View, r: { x: number; y: number; w: number; h: number }) =>
    v.l <= r.x && v.r >= r.x + r.w && v.t <= r.y && v.b >= r.y + r.h;
  it('every social key is at least 1.7×', () => {
    for (const k of CAM.social) expect(k.zoom).toBeGreaterThanOrEqual(1.7);
  });
  it('zone 1: «+ Из прайса…» and its open list (to the option clicked at 75)', () => {
    for (let f = 0; f <= 78; f++) {
      const v = view(f);
      expect(inside(v, SOCIAL_ZONES.select)).toBe(true);
      expect(v.r).toBeLessThanOrEqual(1096); // the summary column starts
      expect(v.t).toBeGreaterThanOrEqual(189); // under the vehicle line (its last pixels end ~185)
    }
  });
  it('zone 2: the whole confirmation sheet while it is up (from 95 to the confirm)', () => {
    for (let f = 95; f <= 152; f++) expect(inside(view(f), SOCIAL_ZONES.modal)).toBe(true);
  });
  it('zone 3: the new block (both group heads, the work line, the parts) and the toast', () => {
    for (let f = 168; f <= 180; f++) {
      const v = view(f);
      expect(inside(v, SOCIAL_ZONES.block)).toBe(true);
      expect(v.l).toBeGreaterThan(240); // no sidebar
      expect(v.r).toBeLessThan(838); // no discount column / group total cut mid-number
    }
  });
  it('zone 4: the summary (discount type, totals, «Остаток») and the kit\'s 10 % cell, to the end', () => {
    for (let f = 198; f < 270; f++) expect(inside(view(f), SOCIAL_ZONES.summary)).toBe(true);
  });
  it('no view leaves the 1440×900 window by more than a pixel', () => {
    for (let f = 0; f < 270; f++) {
      const v = view(f);
      expect(v.l).toBeGreaterThanOrEqual(-1);
      expect(v.r).toBeLessThanOrEqual(1441);
      expect(v.t).toBeGreaterThanOrEqual(-1);
      expect(v.b).toBeLessThanOrEqual(901);
    }
  });
  it('captions: one at a time, each on the beat in the social cut; «block» spans the sheet and the landing', () => {
    const start = sceneStart('estimate', SCENES_SOCIAL);
    expect(SOCIAL_CALLOUTS.map((c) => c.key)).toEqual(['generation', 'block', 'discounts']);
    SOCIAL_CALLOUTS.forEach((c, i) => {
      expect((start + c.at) % 15).toBe(0);
      const next = SOCIAL_CALLOUTS[i + 1];
      if (next) expect(c.out! + 6).toBeLessThanOrEqual(next.at);
    });
    expect(SOCIAL_CALLOUTS[2].out).toBeNull();
  });
});
