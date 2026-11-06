import { describe, expect, it } from 'vitest';
import { orderTotal } from '@crm/lib/format';
import { woHero } from '../fixtures';
import { cameraAt, cursorAt, maxPointerStep, stageView, type View } from '../kit/math';
import { defaultProps } from '../schema';
import { SCENES, SCENE_CLICKS } from '../timing';
import { TITLE_OUT } from '../kit/ChapterTitle';
import { clearOfSlate } from '../kit/slate-check';
import {
  CAM,
  CURSOR,
  DIALOG,
  DISCOUNTS_FROM,
  DISC_TYPE,
  KIT_LINE,
  LABOR_ADD_INPUTS_BOTTOM,
  TITLES,
  SOCIAL_KIT_OUT,
  SOCIAL_SUMMARY_IN,
  SOCIAL_ZONES,
  TOTAL_TO,
  estimateState,
  newLineIds,
} from './Estimate';

const at = (f: number) => estimateState(f, 30);
/** The toast `.toast`, measured (fixed, bottom-centre of the window). */
const TOAST = { x: 617, y: 840.5, w: 205.5, h: 35.5 };
const DUR = SCENES.find((x) => x.id === 'estimate')!.dur;
/** Lines of wo-hero.1 absent in wo-hero.0, in rowStyle order (works, then parts). */
const NEW = newLineIds(woHero[0], woHero[1]);

describe('estimate scene state', () => {
  it('new lines come from the fixtures: the template work + its parts without the oil', () => {
    expect(NEW).toHaveLength(1 + (woHero[1].part_lines ?? []).length);
    expect(NEW[0]).toBe(woHero[1].labor_lines!.at(-1)!.id);
  });

  it('switches snapshots 3 frames after the confirm press (153), then on the discount sequence\'s ✓ (348) and order discount (390)', () => {
    expect(at(152).wo.labor_lines).toBe(woHero[0].labor_lines);
    expect(at(153).wo).toBe(woHero[1]);
    expect(at(269).wo).toBe(woHero[1]);
    expect(at(270).wo).toEqual(woHero[1]);
    expect(at(347).wo.part_lines).toBe(woHero[1].part_lines);
    expect(at(348).wo.part_lines).toBe(woHero[2].part_lines);
    expect(at(389).wo.part_lines).toBe(woHero[2].part_lines);
    expect(at(390).wo.part_lines).toBe(woHero[3].part_lines);
    expect(at(434).wo.part_lines).toBe(woHero[3].part_lines);
  });

  it('totals: 2 200 → 44 400 → counts to 42 910 (348–363) → counts to 40 764,50 (390–405), held to the end', () => {
    expect(at(0).wo.total_cached).toBe(2200);
    expect(at(160).wo.total_cached).toBe(44400);
    expect(at(347).wo.total_cached).toBe(44400);
    expect(at(363).wo.total_cached).toBe(42910);
    expect(at(389).wo.total_cached).toBe(42910);
    expect(TOTAL_TO).toBe(405);
    expect(at(TOTAL_TO).wo.total_cached).toBe(40764.5);
    expect(at(434).wo.total_cached).toBe(orderTotal(woHero[3]));
    for (let f = 348; f < TOTAL_TO; f++) {
      expect(at(f + 1).wo.total_cached).toBeLessThanOrEqual(at(f).wo.total_cached);
      expect(Math.round(at(f).wo.total_cached * 100) / 100).toBe(at(f).wo.total_cached);
    }
  });

  it('«Итого» holds settled at least 15 frames before the slide to the board (TOTAL_TO ≤ dur − 30)', () => {
    expect(TOTAL_TO).toBeLessThanOrEqual(DUR - 30);
    for (let f = TOTAL_TO; f < DUR; f++) expect(at(f).wo.total_cached).toBe(40764.5);
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

  it('the kit line: ✎ shows as the pointer lands (295), edit form (303), «1» 323, «10» 328, saved at 348 and outlined from there', () => {
    const kit = KIT_LINE!.id;
    expect(at(294).hoverLine).toBeUndefined();
    expect(at(295).hoverLine).toBe(kit);
    const tip = cursorAt(295, 30, CURSOR);
    expect(Math.hypot(tip.x - 1016, tip.y - 671)).toBeLessThan(20);
    expect(at(302).editPart).toBeNull();
    expect(at(303)).toMatchObject({ editPart: kit, partDraft: { discValue: '' }, hoverLine: undefined });
    expect(at(323).partDraft).toEqual({ discValue: '1' });
    expect(at(328).partDraft).toEqual({ discValue: '10' });
    expect(at(347).partDraft).toEqual({ discValue: '10' });
    expect(at(348)).toMatchObject({ editPart: null, partDraft: undefined, highlightLine: kit });
    expect(at(347).highlightLine).toBeUndefined();
    expect(at(434).highlightLine).toBe(kit);
  });

  it('the order discount: type «%» 3 frames after the 375 click, «5» at 383, kept to the end', () => {
    expect(at(377).discountDraft).toBeUndefined();
    expect(at(378).discountDraft).toEqual({ type: 'percent', value: '' });
    expect(at(383).discountDraft).toEqual({ type: 'percent', value: '5' });
    expect(at(434).discountDraft).toEqual({ type: 'percent', value: '5' });
  });

  it('everything before the discount sequence is the delivered scene: no drafts, no edit form, no outline, keyed by position', () => {
    for (const f of [0, 100, 153, 180, 194, 240, 269]) {
      expect(at(f)).toMatchObject({ editPart: null, partDraft: undefined, hoverLine: undefined, highlightLine: undefined, discountDraft: undefined, windowKey: undefined });
    }
    expect(DISCOUNTS_FROM).toBe(270);
    expect(at(270).windowKey).toBe('wo1');
    expect(at(303).windowKey).toBe('wo1-edit');
    expect(at(348).windowKey).toBe('wo2');
    expect(at(390).windowKey).toBe('wo3');
  });

  it('pace: every state is on screen about a beat before the next action', () => {
    const [, , , , pencil, field, save, type] = SCENE_CLICKS.estimate;
    expect([pencil, field, save, type]).toEqual([300, 315, 345, 375]);
    expect(field - 303).toBeGreaterThanOrEqual(12); // the edit form open
    expect(save - 328).toBeGreaterThanOrEqual(15); // «10» typed
    expect(type - 348).toBeGreaterThanOrEqual(15); // «−1 490 ₽ (10%)» on the row
    expect(type - 363).toBeGreaterThanOrEqual(12); // «Итого» 42 910 settled
    expect(pencil - 273).toBeGreaterThanOrEqual(15); // the camera settled on the shot (wide)
  });

  it('up to the block landing the pointer is the delivered one, to the bit (its keys through 178, all cubic)', () => {
    const delivered = CURSOR.filter((k) => k.at <= 178 / 30);
    expect(delivered.some((k) => k.ease)).toBe(false);
    for (let f = 0; f <= 178; f++) expect(cursorAt(f, 30, CURSOR)).toEqual(cursorAt(f, 30, delivered));
  });

  it('the pointer lands on each target at its click', () => {
    const p = (f: number) => cursorAt(f, 30, CURSOR);
    const within = (q: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
      q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
    expect(within(p(300), { x: 1001, y: 656.3, w: 30, h: 30 })).toBe(true); // ✎
    expect(within(p(315), { x: 791, y: 657.3, w: 52, h: 30 })).toBe(true); // the discount field
    expect(within(p(345), { x: 1033, y: 657.3, w: 30, h: 30 })).toBe(true); // ✓
    expect(within(p(375), DISC_TYPE)).toBe(true); // the order-discount type
  });

  it('wide: the pointer is paced from the block landing on (≤ 75 frame px per frame, as the loops)', () => {
    const { max, at: f } = maxPointerStep(CURSOR, CAM.wide, 30, 175, DUR);
    expect(max, `largest step ${max.toFixed(1)} px at ${f}`).toBeLessThanOrEqual(75);
  });

  it('wide: one still shot from 273 to the end — the kit row (name to ✓) and the summary with «Итого»', () => {
    const v0 = stageView(cameraAt(273, 30, CAM.wide), 'wide', 1920, 1080);
    for (let f = 273; f < DUR; f++) expect(stageView(cameraAt(f, 30, CAM.wide), 'wide', 1920, 1080)).toEqual(v0);
    expect(v0.l).toBeLessThanOrEqual(265);
    expect(v0.r).toBeGreaterThanOrEqual(1416);
    expect(v0.t).toBeLessThanOrEqual(471.5);
    expect(v0.b).toBeGreaterThanOrEqual(704.3);
    expect(v0.b).toBeLessThanOrEqual(900.001);
  });

  it('chapter 02 never covers the price list, the sheet or its generation price; chapter 03 never the block or its toast', () => {
    const [gen, block] = TITLES;
    expect([gen.key, block.key]).toEqual(['generation', 'block']);
    for (let f = gen.at; f < gen.out + TITLE_OUT; f++) {
      if (at(f).showSelect) expect(clearOfSlate(SOCIAL_ZONES.select, CAM.wide, f, 'generation')).toBe(true);
      if (at(f).modalOpacity > 0) expect(clearOfSlate(DIALOG, CAM.wide, f, 'generation')).toBe(true);
    }
    // The block lands at 153; on the block shot (168 to the move off it, which starts with the title's
    // exit) both group heads, the work, the parts and the toast.
    expect(block.out).toBe(DISCOUNTS_FROM - 15);
    for (let f = 168; f <= block.out; f++) {
      expect(clearOfSlate(SOCIAL_ZONES.block, CAM.wide, f, 'block')).toBe(true);
      if (at(f).toastOpacity > 0) expect(clearOfSlate(TOAST, CAM.wide, f, 'block')).toBe(true);
    }
  });

  it('wide block shot: the whole new block and the summary\'s «Итого», the window\'s right edge at the frame\'s', () => {
    for (let f = 168; f <= DISCOUNTS_FROM - 15; f++) {
      const v = stageView(cameraAt(f, 30, CAM.wide), 'wide', 1920, 1080);
      expect(v.l).toBeLessThanOrEqual(265);
      expect(v.r).toBeCloseTo(1440, 3);
      expect(v.t).toBeLessThanOrEqual(377);
      expect(v.b).toBeGreaterThanOrEqual(876);
    }
  });

  it('the discounts have no title: chapter 03 is gone before the camera leaves the block', () => {
    expect(TITLES[1].out + TITLE_OUT).toBeLessThanOrEqual(DISCOUNTS_FROM - 15 + TITLE_OUT);
    expect(TITLES.every((t) => t.out + TITLE_OUT <= SCENE_CLICKS.estimate[4])).toBe(true);
    expect(Object.keys(defaultProps.chapters)).not.toContain('discounts');
  });
});

describe('estimate social camera', () => {
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
    for (let f = 168; f <= DISCOUNTS_FROM - 15; f++) {
      const v = view(f);
      expect(inside(v, SOCIAL_ZONES.block)).toBe(true);
      expect(v.l).toBeGreaterThan(240); // no sidebar
      expect(v.r).toBeLessThan(838); // no discount column / group total cut mid-number
    }
  });
  it('zone 4: the kit line from 273 to 330 — its quantity to ✓, ✎ and the discount field whole; clean edges', () => {
    for (let f = DISCOUNTS_FROM + 3; f <= SOCIAL_KIT_OUT; f++) {
      const v = view(f);
      expect(inside(v, SOCIAL_ZONES.kit)).toBe(true);
      expect(v.l).toBeGreaterThan(633); // past the edit form's quantity input
      expect(v.r).toBeLessThan(1079); // inside the parts panel
      expect(v.t).toBeGreaterThan(LABOR_ADD_INPUTS_BOTTOM); // under the works add-form's inputs
    }
    expect(CAM.social.find((k) => k.at === (DISCOUNTS_FROM + 3) / 30)!.zoom).toBeGreaterThan(2.4);
  });
  it('zone 5: the summary with the kit\'s discount cell from 345 (before ✓) to the end — «−1 490 ₽ (10%)» and «Итого» in one shot', () => {
    expect(SOCIAL_SUMMARY_IN).toBeLessThanOrEqual(SCENE_CLICKS.estimate[6]);
    for (let f = SOCIAL_SUMMARY_IN; f < DUR; f++) {
      const v = view(f);
      expect(inside(v, SOCIAL_ZONES.summary)).toBe(true);
      expect(v.l).toBeLessThanOrEqual(791); // the edit form's discount field, whole
    }
  });
  it('social: the pointer, where the viewer sees it, is paced from the block landing on (≤ 75 frame px per frame)', () => {
    const seen = (f: number, p: { x: number; y: number }) => {
      const v = view(f);
      return p.x >= v.l && p.x <= v.r && p.y >= v.t && p.y <= v.b;
    };
    const { max, at: f } = maxPointerStep(CURSOR, CAM.social, 30, 175, DUR, seen);
    expect(max, `largest seen step ${max.toFixed(1)} px at ${f}`).toBeLessThanOrEqual(75);
  });
  it('no view leaves the 1440×900 window by more than a pixel', () => {
    for (let f = 0; f < DUR; f++) {
      const v = view(f);
      expect(v.l).toBeGreaterThanOrEqual(-1);
      expect(v.r).toBeLessThanOrEqual(1441);
      expect(v.t).toBeGreaterThanOrEqual(-1);
      expect(v.b).toBeLessThanOrEqual(901);
    }
  });
});
