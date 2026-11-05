import { describe, expect, it } from 'vitest';
import { STATUS_ORDER } from '@crm/lib/types';
import { discountAmount, orderTotal, partGross, partTotal } from '@crm/lib/format';
import { generations, priceList, woHero } from '../fixtures';
import { cameraAt, cursorAt, maxPointerStep, stageView } from '../kit/math';
import { FRAMES_PER_BEAT, SCENE_CLICKS } from '../timing';
import { COLUMNS_AFTER, COLUMNS_BEFORE, HERO_ID, SLOT_STEP, boardState } from '../scenes/Board';
import { SCROLL as BOOKING_SCROLL, bookingScroll, bookingState } from '../scenes/Booking';
import { DISCOUNTS_FROM, KIT_LINE, estimateState } from '../scenes/Estimate';
import { DC_SETTLED, discountsAt } from '../scenes/discounts';
import { LOOP_DEFS, LOOP_H, LOOP_W } from './loop-defs';
import {
  BOARD_LOOP,
  BOOKING_LOOP,
  DC_RESET,
  DISCOUNTS_LOOP,
  ESTIMATE_LOOP,
  HEAD,
  LOOP_SCALE,
  LOOP_SPECS,
  overlayMax,
  PRICE_LIST_LOOP,
  PL_HIGHLIGHT,
  PL_PICKS,
  boardLoopState,
  plRows,
} from './loops';

const FPS = 30;

describe('loop definitions', () => {
  it('six loops at 1600×1000 with the planned lengths; only the phone loop has no cross-fade', () => {
    expect([LOOP_W, LOOP_H]).toEqual([1600, 1000]);
    expect(LOOP_DEFS.map((d) => [d.id, d.dur, d.overlap])).toEqual([
      ['LoopBooking', 180, 10],
      ['LoopEstimate', 240, 10],
      ['LoopDiscounts', 180, 10],
      ['LoopPriceList', 180, 10],
      ['LoopBoard', 180, 10],
      ['LoopMasterMobile', 180, 0],
    ]);
  });
  it('the hero → loop camera keeps the view width (1920 → 1600)', () => {
    expect(LOOP_SCALE).toBeCloseTo(1600 / 1920);
  });
  it('every animated loop has a spec with the def\'s length', () => {
    for (const s of LOOP_SPECS) {
      const def = LOOP_DEFS.find((d) => d.id === s.id)!;
      expect(s.dur).toBe(def.dur);
    }
    expect(LOOP_SPECS.map((s) => s.id).sort()).toEqual(LOOP_DEFS.filter((d) => d.overlap > 0).map((d) => d.id).sort());
  });
});

describe.each(LOOP_SPECS.map((s) => [s.id, s] as const))('%s is seamless by construction', (_, spec) => {
  const D = spec.dur;
  it('data: the last frame and the clip tail (D … D+overlap−1) are the first frame', () => {
    for (const t of [D - 1, ...Array.from({ length: 10 }, (_, k) => D + k)]) expect(spec.frame(t)).toEqual(spec.frame(0));
  });
  it('camera: the same view at 0, D−1 and through the tail', () => {
    const c0 = cameraAt(0, FPS, spec.cam);
    for (const t of [D - 1, D + 9]) expect(cameraAt(t, FPS, spec.cam)).toEqual(c0);
  });
  it('cursor: back on its starting point', () => {
    const p0 = cursorAt(0, FPS, spec.cursor);
    for (const t of [D - 1, D + 9]) expect(cursorAt(t, FPS, spec.cursor)).toEqual(p0);
  });
  it('the head under the cross-fade (0 … overlap−1) is still: LoopCrossfade blends two equal pictures', () => {
    // Output frame f < overlap shows clip(D + f) over clip(f); both must be the first frame, or a
    // moving cursor/camera would show twice, half transparent.
    for (let k = 1; k < 10; k++) {
      expect(spec.frame(k)).toEqual(spec.frame(0));
      expect(cameraAt(k, FPS, spec.cam)).toEqual(cameraAt(0, FPS, spec.cam));
      expect(cursorAt(k, FPS, spec.cursor)).toEqual(cursorAt(0, FPS, spec.cursor));
      expect(overlayMax(spec, k)).toBe(0);
    }
  });
  it('captions and highlights are off at both ends', () => {
    for (const t of [0, D - 1, D + 9]) expect(overlayMax(spec, t)).toBe(0);
  });
  it('the pointer is paced: no per-frame step above 75 px on screen', () => {
    // Measured in frame px relative to the page — |Δ UI px| × the camera zoom — so the camera's own
    // pans and pushes are not counted, and every loop is judged at the size the viewer sees it.
    const { max, at } = maxPointerStep(spec.cursor, spec.cam, FPS, 0, D + 10);
    expect(max, `largest step ${max.toFixed(1)} px at ${at}→${at + 1}`).toBeLessThanOrEqual(75);
  });
  it('clicks fall on the beat, after frame 0 and at least 30 frames before the end', () => {
    for (const c of spec.clicks) {
      expect(c % FRAMES_PER_BEAT).toBe(0);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(D - 30);
    }
  });
});

describe('the scenes the loops play are idle through the head (pinned to their frame 0)', () => {
  it('Booking and Board: the state of frames 0 … HEAD−1 is frame 0\'s', () => {
    for (let k = 1; k < HEAD; k++) {
      expect(bookingState(k, FPS)).toEqual(bookingState(0, FPS));
      const [a, b] = [boardState(k, FPS), boardState(0, FPS)];
      // (the scene's own cursor path is not drawn by the loop; the window state is)
      expect({ ...a, cursor: null, rowStyle: null }).toEqual({ ...b, cursor: null, rowStyle: null });
      for (const st of STATUS_ORDER) for (const [i, w] of a.columns[st].entries()) expect(a.rowStyle(st, i, w.id)).toEqual(b.rowStyle(st, i, w.id));
    }
  });
  it('Estimate: the state of frames 0 … HEAD−1 is frame 0\'s', () => {
    const ids = [...(woHero[1].labor_lines ?? []), ...(woHero[1].part_lines ?? [])].map((l) => l.id);
    for (let k = 1; k < HEAD; k++) {
      const [a, b] = [estimateState(k, FPS), estimateState(0, FPS)];
      expect({ ...a, rowStyle: null }).toEqual({ ...b, rowStyle: null });
      for (const id of ids) expect(a.rowStyle(id)).toEqual(b.rowStyle(id));
    }
    expect(cursorAt(HEAD, FPS, ESTIMATE_LOOP.cursor)).toEqual(cursorAt(0, FPS, ESTIMATE_LOOP.cursor));
    expect(cursorAt(HEAD, FPS, BOOKING_LOOP.cursor)).toEqual(cursorAt(0, FPS, BOOKING_LOOP.cursor));
  });
});

describe('LoopBooking', () => {
  const f = BOOKING_LOOP.frame;
  it('plays the Booking scene from its first frame: scroll 30–60, slot click 75, «Новая запись» 105, the order lands 120', () => {
    for (const t of [10, 75, 105, 120, 149]) expect(f(t)).toEqual({ scene: t, heroFade: 1, scroll: bookingScroll(t) });
    for (const t of [60, 75, 149]) expect(f(t).scroll).toBe(BOOKING_SCROLL);
    expect(f(30).scroll).toBe(0);
    expect(f(45).scroll).toBe(bookingScroll(45));
    expect(BOOKING_LOOP.clicks).toEqual([75, 105]);
  });
  it('then the landed order fades out and the calendar is back to its first frame', () => {
    expect(f(150).scene).toBe(149);
    expect(f(157).heroFade).toBeGreaterThan(0);
    expect(f(157).heroFade).toBeLessThan(1);
    expect(f(165)).toMatchObject({ scene: 0, heroFade: 1 });
    expect(f(170)).toEqual({ scene: 0, heroFade: 1, scroll: 0 });
  });
  it('the timeline scrolls back up with the camera\'s pull-back (150–170), no jump at the reset (165)', () => {
    expect(f(150).scroll).toBe(BOOKING_SCROLL);
    for (let t = 150; t < 170; t++) {
      expect(f(t + 1).scroll).toBeLessThan(f(t).scroll);
      // the camera's curve over 20 frames peaks at ≈ 38 px/frame; a reset jump would be the whole 280
      expect(f(t).scroll - f(t + 1).scroll).toBeLessThan(60);
    }
  });
  it('the camera pulls back out only after the caption has gone', () => {
    const c = (t: number) => cameraAt(t, FPS, BOOKING_LOOP.cam);
    expect(c(149)).toEqual(c(100));
    expect(overlayMax(BOOKING_LOOP, 150)).toBe(0);
  });
});

describe('LoopEstimate', () => {
  const f = ESTIMATE_LOOP.frame;
  it('plays the Estimate scene up to the landed block (no summary, no discounts)', () => {
    for (const t of [10, 45, 80, 153, 185, 193]) expect(f(t)).toEqual({ scene: t, reset: 0 });
    expect(ESTIMATE_LOOP.clicks).toEqual([45, 75, 120, 150]);
  });
  it('then the order dissolves back to wo-hero.0', () => {
    expect(f(200).scene).toBe(194);
    expect(f(200).reset).toBeGreaterThan(0);
    expect(f(200).reset).toBeLessThan(1);
    expect(f(209)).toEqual({ scene: 0, reset: 0 });
  });
});

describe('LoopDiscounts', () => {
  const f = DISCOUNTS_LOOP.frame;
  const [, WO1, WO2, WO3] = woHero;
  const T = [WO1, WO2, WO3].map(orderTotal);
  it('totals come from the fixtures through the PricingService mirror: 44 400 → 42 910 → 40 764,50', () => {
    expect(T).toEqual([44400, 42910, 40764.5]);
    expect(f(0).total).toBe(T[0]);
    expect(f(77).total).toBe(T[0]);
    expect(f(93).total).toBe(T[1]);
    expect(f(119).total).toBe(T[1]);
    expect(f(135).total).toBe(T[2]);
    expect(f(164).total).toBe(T[2]);
    // monotone count-downs, whole kopecks
    for (let t = 78; t < 137; t++) {
      expect(f(t + 1).total).toBeLessThanOrEqual(f(t).total);
      expect(Math.round(f(t).total * 100) / 100).toBe(f(t).total);
    }
  });
  it('10 % on the chain kit, then 5 % on the order: the kit costs 14,5 % less, to the kopeck', () => {
    const kit = WO3.part_lines!.find((p) => p.id === KIT_LINE!.id)!;
    expect(kit.discount_type).toBe('percent');
    expect(kit.discount_value).toBe(10);
    expect(WO3.discount_type).toBe('percent');
    expect(WO3.discount_value).toBe(5);
    const kitAfterBoth = partTotal(kit) * (1 - WO3.discount_value! / 100);
    expect(1 - kitAfterBoth / partGross(kit)).toBeCloseTo(0.145, 10);
    expect(Math.round(discountAmount(WO3) * 100) / 100).toBe(2145.5);
  });
  it('the line discount: ✎ hovered as the pointer lands (25), edit form (33), «10» typed, saved (wo-hero.2, 78)', () => {
    expect(DISCOUNTS_LOOP.clicks).toEqual([30, 45, 75, 105]);
    expect(f(24).hoverKit).toBe(false);
    expect(f(25).hoverKit).toBe(true);
    const tip = cursorAt(25, FPS, DISCOUNTS_LOOP.cursor);
    expect(Math.hypot(tip.x - 1016, tip.y - 671)).toBeLessThan(20); // on ✎ (x 1001–1031, y 656–686)
    expect(f(32).edit).toBeNull();
    expect(f(33).edit).toBe('');
    expect(f(53).edit).toBe('1');
    expect(f(58).edit).toBe('10');
    expect(f(77)).toMatchObject({ snap: 1, edit: '10' });
    expect(f(78)).toMatchObject({ snap: 2, edit: null });
  });
  it('then the order discount: type «%» (105 → 108), «5» typed (113), applied (wo-hero.3) a beat after the click (120)', () => {
    expect(f(107).discountDraft).toBeNull();
    expect(f(108).discountDraft).toEqual({ type: 'percent', value: '' });
    expect(f(113).discountDraft).toEqual({ type: 'percent', value: '5' });
    expect(f(119).snap).toBe(2);
    expect(f(120).snap).toBe(3);
  });
  it('no caption: nothing is drawn over the window; the settled total holds 135–164 with the kit outlined', () => {
    for (let t = 0; t < DISCOUNTS_LOOP.dur + 10; t++) expect(overlayMax(DISCOUNTS_LOOP, t)).toBe(0);
    expect(DC_SETTLED).toBe(135);
    expect(DC_RESET - DC_SETTLED).toBeGreaterThanOrEqual(30);
    for (let t = DC_SETTLED; t < DC_RESET; t++) expect(f(t)).toMatchObject({ snap: 3, total: T[2], kitOutline: true, reset: 0 });
  });
  it('plays the Estimate scene\'s discount sequence: the same states at scene frame DISCOUNTS_FROM + t', () => {
    for (let t = 0; t < DC_RESET; t++) {
      const { reset, ...seq } = f(t);
      expect(reset).toBe(0);
      expect(seq).toEqual(discountsAt(t));
      const scene = estimateState(DISCOUNTS_FROM + t, FPS);
      expect(scene.wo.total_cached).toBe(seq.total);
      expect(scene.discountDraft ?? null).toEqual(seq.discountDraft);
    }
    expect(DISCOUNTS_LOOP.clicks).toEqual(SCENE_CLICKS.estimate.slice(4).map((c) => c - DISCOUNTS_FROM));
  });
  it('dissolves (eased, 10 frames) back to wo-hero.1', () => {
    expect(f(165).reset).toBe(0);
    const r = [166, 167, 168, 169, 170, 171, 172, 173, 174].map((t) => f(t).reset);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
    expect(r[0]).toBeLessThan(0.1); // eased in
    expect(f(175)).toEqual(f(0));
  });
  it('the camera frames the kit line and the whole summary inside the window', () => {
    const v = stageView(cameraAt(0, FPS, DISCOUNTS_LOOP.cam), 'wide', LOOP_W, LOOP_H);
    expect(v.l).toBeLessThanOrEqual(265);
    expect(v.r).toBeGreaterThanOrEqual(1416);
    expect(v.t).toBeLessThanOrEqual(195);
    expect(v.b).toBeLessThanOrEqual(900.001);
  });
});

describe('LoopPriceList', () => {
  const f = PRICE_LIST_LOOP.frame;
  const genId = (code: string) => generations.find((g) => g.code === code)!.id;
  it('R56 → F56 → F60 → R56 through the generation select (open, pick) on the beat', () => {
    expect(PL_PICKS.map((p) => [p.from, p.to])).toEqual([
      ['R56', 'F56'],
      ['F56', 'F60'],
      ['F60', 'R56'],
    ]);
    expect(PRICE_LIST_LOOP.clicks).toEqual(PL_PICKS.flatMap((p) => [p.open, p.pick]));
    for (const p of PL_PICKS) expect(p.options[p.pickIndex]).toContain(` ${p.to} · `);
  });
  it('each opening shows a window of the select\'s own labels (genLabel · years), in the generations\' order', () => {
    const labels = generations.map((g) => `${g.make} ${[g.model, g.code].filter(Boolean).join(' ')}${g.years ? ` · ${g.years}` : ''}`);
    for (const p of PL_PICKS) {
      const start = labels.indexOf(p.options[0]);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(p.options).toEqual(labels.slice(start, start + p.options.length));
      expect(p.options.length).toBe(6);
    }
    expect(genId('R56')).toBeTruthy();
  });
  it('rows are the fixture rows of the shown generation, prices counting between generations', () => {
    expect(plRows(f(0))).toEqual(priceList.R56);
    const p1 = PL_PICKS[0];
    expect(plRows(f(p1.pick + 2))).toEqual(priceList.R56);
    expect(plRows(f(p1.pick + 3 + 15))).toEqual(priceList.F56);
    const mid = plRows(f(p1.pick + 3 + 7));
    const i = priceList.R56.findIndex((r) => r.template.id === PL_HIGHLIGHT);
    const [a, b, m] = [priceList.R56[i], priceList.F56[i], mid[i]].map((r) => r.effective.price!);
    expect(a).not.toBe(b);
    expect(m).toBeGreaterThan(Math.min(a, b));
    expect(m).toBeLessThan(Math.max(a, b));
    expect(Number.isInteger(m)).toBe(true);
    // everything but the counted price is the target generation's row
    expect({ ...mid[i], effective: { ...mid[i].effective, price: 0 } }).toEqual({
      ...priceList.F56[i],
      effective: { ...priceList.F56[i].effective, price: 0 },
    });
    expect(plRows(f(PL_PICKS[1].pick + 3 + 15))).toEqual(priceList.F60);
    expect(plRows(f(PL_PICKS[2].pick + 3 + 15))).toEqual(priceList.R56);
  });
  it('the highlighted work is the first visible row whose price differs by generation', () => {
    const i = priceList.R56.findIndex((r) => r.template.id === PL_HIGHLIGHT);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(12); // rows from y 264, 50.9 px each: row 12 is cut by the frame
    const prices = (['R56', 'F56', 'F60'] as const).map((g) => priceList[g][i].effective.price);
    expect(new Set(prices).size).toBe(3);
    for (let k = 0; k < i; k++) {
      expect(new Set((['R56', 'F56', 'F60'] as const).map((g) => priceList[g][k].effective.price)).size).toBe(1);
    }
  });
});

describe('LoopBoard', () => {
  const f = BOARD_LOOP.frame;
  const at = (t: number) => boardLoopState(f(t), FPS);
  it('plays the Board scene\'s drag (press 30, drop 75) without its pan', () => {
    expect(BOARD_LOOP.clicks).toEqual([30, 75]);
    for (const t of [0, 30, 75, 100, 119]) expect(at(t).scroll).toBe(0);
    expect(at(100).columns).toBe(COLUMNS_AFTER);
    expect(at(0).columns).toBe(COLUMNS_BEFORE);
  });
  it('reset, out: the hero fades out of «В работе», its gap closes and «Запланирована» makes room', () => {
    const s = at(125);
    expect(s.columns).toBe(COLUMNS_AFTER);
    expect(s.float).toBeNull();
    const hero = s.rowStyle('in_progress', 0, HERO_ID)!;
    expect(hero.opacity).toBeGreaterThan(0);
    expect(hero.opacity).toBeLessThan(1);
    const other = COLUMNS_AFTER.in_progress[1].id;
    expect(s.rowStyle('in_progress', 1, other)!.transform).toMatch(/^translateY\(-/);
    expect(s.rowStyle('scheduled', 0, COLUMNS_AFTER.scheduled[0].id)!.transform).toMatch(/^translateY\(\d/);
  });
  it('at the swap the neighbours are exactly where the «before» columns put them', () => {
    const end = at(129);
    const px = (v: string | undefined) => Number(/translateY\((-?[\d.]+)px\)/.exec(v ?? '')?.[1] ?? 0);
    expect(px(end.rowStyle('scheduled', 0, COLUMNS_AFTER.scheduled[0].id)?.transform as string)).toBeCloseTo(SLOT_STEP, 0);
    expect(at(130).columns).toBe(COLUMNS_BEFORE);
    expect(at(130).rowStyle('scheduled', 0, HERO_ID)).toEqual({ opacity: 0 });
    expect(at(130).rowStyle('scheduled', 1, COLUMNS_BEFORE.scheduled[1].id)).toBeUndefined();
  });
  it('reset, in: the hero fades back in on top of «Запланирована»; from 140 it is frame 0', () => {
    expect(at(135).rowStyle('scheduled', 0, HERO_ID)!.opacity).toBeCloseTo(0.5);
    expect(f(140)).toEqual(f(0));
    for (const s of STATUS_ORDER) expect(at(140).columns[s]).toBe(COLUMNS_BEFORE[s]);
  });
});
