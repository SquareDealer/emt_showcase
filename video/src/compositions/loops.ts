import type { CSSProperties } from 'react';
import { interpolate } from 'remotion';
import type { PriceListRow, VehicleGeneration, WorkOrderStatus } from '@crm/lib/types';
import { generations, priceList } from '../fixtures';
import { CAM_EASE, countUp, type CamKey, type CursorPoint } from '../kit/math';
import { FPS, SCENE_CLICKS } from '../timing';
import {
  CALLOUT_AT as BOOKING_CALLOUT_AT,
  CAM as BOOKING_CAM,
  CURSOR as BOOKING_CURSOR,
  SCROLL as BOOKING_SCROLL,
  bookingScroll,
} from '../scenes/Booking';
import {
  APPLY_AT,
  BLOCK_AT,
  BLOCK_CAPTION_OUT,
  CAM as ESTIMATE_CAM,
  CURSOR as ESTIMATE_CURSOR,
  GEN_AT,
  GEN_CAPTION_OUT,
  GEN_RING_OUT,
  estimateState,
} from '../scenes/Estimate';
import { DC_CLICKS, discountsAt, discountsCursor, type DiscountsState } from '../scenes/discounts';
import {
  CALLOUT_AT as BOARD_CALLOUT_AT,
  CALLOUT_OUT as BOARD_CALLOUT_OUT,
  CAM as BOARD_CAM,
  COLUMNS_AFTER,
  CURSOR as BOARD_CURSOR,
  HERO_ID,
  SLOT_STEP,
  boardState,
} from '../scenes/Board';
import { LOOP_DEFS, LOOP_H, LOOP_W, type LoopId } from './loop-defs';

// ---------------------------------------------------------------------------------------------
// The feature loops (1600×1000): each a short story told with a scene's own state function and
// window, that ends in exactly the camera, cursor and data state it starts in — a pure function
// `frame(t)` per loop, so `frame(0)` deep-equals `frame(D − 1)` and the clip's tail D … D+overlap−1
// (LoopCrossfade lays the tail over the head; with equal ends the cross-fade only hides AA noise).
// Camera keys are the scenes' wide keys with the zoom scaled by LOOP_SCALE: the same view width on
// a 1600-px frame as on the hero's 1920 (and 1000/1600 is taller than 1080/1920, so more height).
// ---------------------------------------------------------------------------------------------

/** Hero zoom → loop zoom: the view keeps its width in UI px. */
export const LOOP_SCALE = LOOP_W / 1920;
const toLoop = (k: CamKey): CamKey => ({ ...k, zoom: k.zoom * LOOP_SCALE });

const s = (f: number) => f / FPS;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
/** 1 → 0 over `dur` frames from `from`. */
const fadeOut = (t: number, from: number, dur = 6) => interpolate(t, [from, from + dur], [1, 0], clamp);
/** Opacity of an overlay that appears at `at` and fades out from `out` (6 frames). */
const shown = (t: number, at: number, out: number, dur = 6) => (t < at ? 0 : fadeOut(t, out, dur));
const dur = (id: LoopId) => LOOP_DEFS.find((d) => d.id === id)!.dur;
/** LoopCrossfade's overlap: output frame f < HEAD shows clip(D + f) over clip(f), so every loop holds
 *  its first frame through 0 … HEAD−1 (nothing moves there; the scenes are idle that long anyway). */
export const HEAD = 10;
/** A click's effect lands 3 frames after the press (every scene's convention). */
const FX = 3;
/** Scene frame for loop frame t: the scene from its start, its idle head pinned to frame 0. */
const fromScene = (t: number) => (t < HEAD ? 0 : t);

export type LoopSpec<S> = {
  id: LoopId;
  dur: number;
  /** Camera keys (seconds, UI px at the frame centre). */
  cam: CamKey[];
  cursor: CursorPoint[];
  /** Click frames (loop-local, on the beat). */
  clicks: number[];
  /** Data state at loop frame t — plain data, so the loop's ends compare with toEqual. */
  frame: (t: number) => S;
  /** Opacity of each caption/highlight wrapper at loop frame t (0 before it appears) — what
   *  Loops.tsx draws them with, so the spec tests the drawn values. */
  overlays: (t: number) => Record<string, number>;
};

/** The strongest overlay at t (0 = nothing drawn over the window). */
export const overlayMax = (spec: LoopSpec<unknown>, t: number) => Math.max(0, ...Object.values(spec.overlays(t)));

// ---- LoopBooking (180): the Booking scene 0–149 (the timeline scrolls to Thursday 30–60, slot 75,
// «Новая запись» 105, the order lands 120, caption 90), then the landed order fades out while the camera
// pulls back to the week and the timeline scrolls back up to Monday with it (150–170). ----
const BK_FADE_FROM = 150;
const BK_FADE = 15;
const BK_BACK_TO = 170;
const BK_CAPTION_OUT = 140;
const [, BK_CLICK_BOOKING] = SCENE_CLICKS.booking;
const bookingKeys = BOOKING_CAM.wide.filter((k) => k.at <= 5).map(toLoop);
/** `scroll`: the timeline's scroll (UI px) — the scene's up to 149, then back to 0 with the camera. */
export type BookingFrame = { scene: number; heroFade: number; scroll: number };
export const BOOKING_LOOP: LoopSpec<BookingFrame> = {
  id: 'LoopBooking',
  dur: dur('LoopBooking'),
  // Wide → 1.6 (hero) on Wednesday–Thursday, held; back out 150–170 instead of the hero's dive.
  cam: [...bookingKeys, { ...bookingKeys[0], at: s(BK_BACK_TO) }],
  // The scene's path to «Новая запись», then back to where it idles at frame 0.
  cursor: [...BOOKING_CURSOR.filter((p) => p.at <= s(BK_CLICK_BOOKING + 12)), { ...BOOKING_CURSOR[0], at: s(165) }],
  clicks: SCENE_CLICKS.booking,
  frame: (t) => {
    // The scroll back rides the camera's pull-back (same frames, same curve), as the scene's scroll
    // rides its push.
    const back = interpolate(t, [BK_FADE_FROM, BK_BACK_TO], [BOOKING_SCROLL, 0], { ...clamp, easing: CAM_EASE });
    if (t < BK_FADE_FROM) return { scene: fromScene(t), heroFade: 1, scroll: bookingScroll(fromScene(t)) };
    if (t < BK_FADE_FROM + BK_FADE)
      return { scene: BK_FADE_FROM - 1, heroFade: interpolate(t, [BK_FADE_FROM, BK_FADE_FROM + BK_FADE], [1, 0]), scroll: back };
    return { scene: 0, heroFade: 1, scroll: back };
  },
  overlays: (t) => ({ caption: shown(t, BOOKING_CALLOUT_AT, BK_CAPTION_OUT) }),
};

// ---- LoopEstimate (240): the Estimate scene 0–193 («+ Из прайса…» 45, the work 75, the sheet with
// its generation price, the oil unticked 120, «Добавить» 150, the block lands, toast), then the order
// dissolves back to wo-hero.0 (194–208) while the camera returns. ----
const ES_END = 194;
const ES_RESET = 15;
const [, , ES_OIL, ES_CONFIRM] = SCENE_CLICKS.estimate;
const estimateKeys = ESTIMATE_CAM.wide.filter((k) => k.at <= s(180)).map(toLoop);
export type EstimateFrame = { scene: number; reset: number };
export const ESTIMATE_LOOP: LoopSpec<EstimateFrame> = {
  id: 'LoopEstimate',
  dur: dur('LoopEstimate'),
  cam: [...estimateKeys, { ...estimateKeys.at(-1)!, at: s(ES_END) }, { ...estimateKeys[0], at: s(215) }],
  // The scene's path through the confirm and out to the right, then back to its start. Two trips are
  // longer than the scene's, paced at ≤ 75 px/frame: oil → «Добавить» 121–148 (scene 124–144) and the
  // exit 156–186 (scene –178).
  cursor: [
    ...ESTIMATE_CURSOR.filter((p) => p.at <= s(178)).map((p) =>
      p.at === s(ES_OIL + 4)
        ? { ...p, at: s(ES_OIL + 1) }
        : p.at === s(ES_CONFIRM - 6)
          ? { ...p, at: s(ES_CONFIRM - 2) }
          : p.at === s(178)
            ? { ...p, at: s(186) }
            : p,
    ),
    { ...ESTIMATE_CURSOR.find((p) => p.at === s(178))!, at: s(200) },
    { ...ESTIMATE_CURSOR[0], at: s(228) },
  ],
  clicks: SCENE_CLICKS.estimate.filter((c) => c < ES_END),
  frame: (t) => {
    if (t < ES_END) return { scene: fromScene(t), reset: 0 };
    if (t < ES_END + ES_RESET) return { scene: ES_END, reset: CAM_EASE((t - ES_END) / ES_RESET) };
    return { scene: 0, reset: 0 };
  },
  // The Estimate scene's wide overlays, with its own timings: the generation-price ring, the
  // generation caption (only while the sheet is up), «block» over the sheet, «block» under the line.
  overlays: (t) => {
    const sheet = t < ES_END ? estimateState(fromScene(t), FPS).modalOpacity : 0;
    return {
      ring: shown(t, GEN_AT, GEN_RING_OUT),
      generation: Math.min(sheet, shown(t, GEN_AT, GEN_CAPTION_OUT)),
      blockSheet: t < BLOCK_AT ? 0 : sheet,
      blockLine: shown(t, APPLY_AT, BLOCK_CAPTION_OUT),
    };
  },
};

// ---- LoopDiscounts (180): the discount sequence of the Estimate scene (./scenes/discounts, the same
// pure timeline the scene plays from its frame 195) on wo-hero.1: the chain kit's ✎ (30), its discount
// field (45), «10» typed, ✓ (75): wo-hero.2, «Итого» counts 44 400 → 42 910 → the order discount «%»
// (105), «5», applied (120): wo-hero.3, «Итого» counts to 40 764,50 by 135 and holds → dissolve back
// to wo-hero.1 (165–174). No caption. ----
/** The dissolve back to wo-hero.1 (the settled total holds from DC_SETTLED to it). */
export const DC_RESET = 165;
const DC_RESET_LEN = 10;
export type DiscountsFrame = DiscountsState & {
  /** Opacity of wo-hero.1 dissolving in over the end state. */
  reset: number;
};
const discountsFrame = (t: number, reset: number): DiscountsFrame => ({ ...discountsAt(t), reset });
/** Idle in the gap between the parts panel (to 1079) and the summary (from 1096), clear of every row. */
const DC_REST = { x: 1087, y: 770 };
/** The Estimate scene's summary shot (zoom 1.62 → 1.35, view 1185×741), moved so that its right and
 *  bottom edges sit 10 px inside the window (1440×900; no rounded corner, no background): x 245–1430
 *  (the panels start at 264), y 149–890 (the vehicle line to the summary's buttons). */
const summaryKey = toLoop(ESTIMATE_CAM.wide.at(-1)!);
const summaryView = { r: 1430, b: 890 };
export const DISCOUNTS_LOOP: LoopSpec<DiscountsFrame> = {
  id: 'LoopDiscounts',
  dur: dur('LoopDiscounts'),
  cam: [
    {
      at: 0,
      zoom: summaryKey.zoom,
      x: summaryView.r - LOOP_W / 2 / summaryKey.zoom,
      y: summaryView.b - LOOP_H / 2 / summaryKey.zoom,
    },
  ],
  // Rest → ✎ (the sequence's pointer from there to the order discount) → back down past the totals
  // to the gap.
  cursor: [{ at: 0, ...DC_REST }, { at: s(HEAD), ...DC_REST }, ...discountsCursor(0), { at: s(155), ...DC_REST }],
  clicks: [...DC_CLICKS],
  frame: (t) => {
    if (t >= DC_RESET + DC_RESET_LEN) return discountsFrame(0, 0);
    // Under the dissolve the end state holds (the frame before it starts).
    if (t >= DC_RESET) return discountsFrame(DC_RESET - 1, CAM_EASE((t - DC_RESET) / DC_RESET_LEN));
    return discountsFrame(t, 0);
  },
  // Nothing drawn over the window: the kit line is marked by the app's own row outline (kitOutline),
  // not a dimming ring — «Итого» counts down at the same time and must stay bright.
  overlays: () => ({}),
};

// ---- LoopPriceList (180): «Прайс-лист» on R56 → the generation select: F56 (30/45) → F60 (75/90)
// → R56 (120/135); each pick swaps the rows to that generation's fixture and counts the changed
// prices over 15 frames; the first visible work whose price depends on the generation is outlined. ----
type GenCode = 'R56' | 'F56' | 'F60';
export const gen = (code: GenCode): VehicleGeneration => {
  const g = generations.find((x) => x.code === code);
  if (!g) throw new Error(`generations.json: no ${code}`);
  return g;
};
/** The select's option label (PriceListView: genLabel + « · years»). */
export const genOption = (g: VehicleGeneration) =>
  `${g.make} ${[g.model, g.code].filter(Boolean).join(' ')}${g.years ? ` · ${g.years}` : ''}`;
/** A native select opens scrolled to its list around the option (as the Estimate scene's «+ Из
 *  прайса…»): a 6-row window of the select's labels in the generations' order, the target 3rd —
 *  close to the control, so the pointer's trip stays short. */
const PL_WINDOW = 6;
const PL_TARGET_ROW = 2;
function plOptions(code: GenCode): { options: string[]; pickIndex: number } {
  const i = generations.indexOf(gen(code));
  const from = Math.max(0, Math.min(i - PL_TARGET_ROW, generations.length - PL_WINDOW));
  return { options: generations.slice(from, from + PL_WINDOW).map(genOption), pickIndex: i - from };
}
const PL_COUNT = 15;
export const PL_PICKS = (
  [
    { from: 'R56', to: 'F56', open: 30, pick: 45 },
    { from: 'F56', to: 'F60', open: 75, pick: 90 },
    { from: 'F60', to: 'R56', open: 120, pick: 135 },
  ] as const
).map((p) => ({ ...p, ...plOptions(p.to), at: p.pick + FX }));
for (const code of ['F56', 'F60'] as const) {
  const rows = priceList[code];
  if (rows.length !== priceList.R56.length || rows.some((r, i) => r.template.id !== priceList.R56[i].template.id))
    throw new Error(`price-list.${code}.json: rows are not R56's works in R56's order`);
}
/** The first work whose effective price differs between the three generations (the pump). */
export const PL_HIGHLIGHT = (() => {
  const i = priceList.R56.findIndex(
    (r, k) => new Set((['R56', 'F56', 'F60'] as const).map((g) => priceList[g][k].effective.price)).size > 1,
  );
  if (i < 0) throw new Error('price-list fixtures: no generation-dependent price');
  return priceList.R56[i].template.id;
})();
export const PL_CAPTION = 60;
const PL_CAPTION_OUT = 150;
export type PriceListFrame = { gen: GenCode; from: GenCode; p: number; highlight: boolean };
/** The rows PriceListView shows: the generation's fixture, prices counting from the previous one. */
export function plRows(f: PriceListFrame): PriceListRow[] {
  const to = priceList[f.gen];
  if (f.p >= 1 || f.from === f.gen) return to;
  const from = priceList[f.from];
  return to.map((r, i) => {
    const a = from[i].effective.price;
    const b = r.effective.price;
    if (a === b || a === null || b === null) return r;
    // List prices are whole rubles: count in rubles (no kopecks flickering mid-count).
    return { ...r, effective: { ...r.effective, price: Math.round(countUp(f.p, 0, 1, a, b)) } };
  });
}
/** The generation select `[data-demo="pl-generation"]`, measured on the rendered PriceListView (R56,
 *  1440×900 window, getBoundingClientRect − `.crm-root`): x 264 y 176 261×36. */
export const PL_SELECT = { x: 264, y: 176, w: 261, h: 36 };
/** FakeSelect list rows: 4 px below the control, 4 px padding, 36 px rows. */
const plOptionY = (i: number) => PL_SELECT.y + PL_SELECT.h + 4 + 4 + 36 * i + 18;
const PL_SELECT_AT = { x: PL_SELECT.x + 70, y: PL_SELECT.y + PL_SELECT.h / 2 };
const plOptionAt = (i: number) => ({ x: PL_SELECT.x + 110, y: plOptionY(i) });
/** Idle on the list, right of row 2's name, a short trip from the select. */
const PL_REST = { x: 640, y: 380 };
const PL_START = { x: 720, y: 450, zoom: LOOP_SCALE };
// FOCUS 1.35 (view 1185×741): x 247–1433 — the select (264) to the reset buttons (to 1399);
// y 135–875 — from the gap between the page subtitle (to ~131) and the «Поколение» label (~149):
// the page bar with the caption above the column heads, rows 0–11 (row 5 is the pump; row 11 runs
// out at the bottom edge, as a list does).
const PL_FOCUS = { x: 840, y: 505, zoom: 1.35 };
export const PRICE_LIST_LOOP: LoopSpec<PriceListFrame> = {
  id: 'LoopPriceList',
  dur: dur('LoopPriceList'),
  cam: [
    { at: 0, ...PL_START },
    { at: s(HEAD), ...PL_START },
    { at: s(27), ...PL_FOCUS },
    { at: s(150), ...PL_FOCUS },
    { at: s(170), ...PL_START },
  ],
  cursor: [
    { at: 0, ...PL_REST },
    { at: s(HEAD), ...PL_REST },
    ...PL_PICKS.flatMap((p) => [
      { at: s(p.open - 5), ...PL_SELECT_AT },
      { at: s(p.open + 1), ...PL_SELECT_AT },
      { at: s(p.pick - 2), ...plOptionAt(p.pickIndex) },
      { at: s(p.pick + 4), ...plOptionAt(p.pickIndex) },
    ]),
    { at: s(170), ...PL_REST },
  ],
  clicks: PL_PICKS.flatMap((p) => [p.open, p.pick]),
  frame: (t) => {
    const last = [...PL_PICKS].reverse().find((p) => t >= p.at);
    const highlight = t >= PL_PICKS[0].at && t < PL_CAPTION_OUT;
    if (!last) return { gen: 'R56', from: 'R56', p: 1, highlight };
    const p = Math.min(1, (t - last.at) / PL_COUNT);
    return { gen: last.to, from: p < 1 ? last.from : last.to, p, highlight };
  },
  overlays: (t) => ({ caption: shown(t, PL_CAPTION, PL_CAPTION_OUT) }),
};

// ---- LoopBoard (180): the Board scene's drag 0–119 (press 30, drop 75, settled by 92; caption
// 60–102) without its pan, then a reset: 120–129 the hero fades out of «В работе», its gap closes and
// «Запланирована» makes room (the scene's settle in reverse); 130–139 it fades back in on top of
// «Запланирована». ----
const BD_RESET = 120;
const BD_HALF = 10;
const BD_REST = { x: 514, y: 480 };
export type BoardFrame = { scene: number; out: number; heroIn: number };
export const BOARD_LOOP: LoopSpec<BoardFrame> = {
  id: 'LoopBoard',
  dur: dur('LoopBoard'),
  // The scene's START (1.75 → 1.458, view 1097×686): its x (258–1355) as is; the loop's view is taller,
  // so it starts under the topbar (57) at 60 instead of showing a sliver of it — rows 1–3 whole.
  cam: [{ ...toLoop(BOARD_CAM.wide[0]), at: 0, y: 60 + LOOP_H / 2 / toLoop(BOARD_CAM.wide[0]).zoom }],
  // Idle in the gap between «Запланирована» and «В работе» (508–520), then the scene's path from the
  // grab (24) through the drop, then back. (The scene idles below the view, too far for the 14 frames
  // to the grab at ≤ 75 px/frame.)
  cursor: [
    { at: 0, ...BD_REST },
    { at: s(HEAD), ...BD_REST },
    ...BOARD_CURSOR.filter((p) => p.at >= s(SCENE_CLICKS.board[0] - 6) && p.at <= s(SCENE_CLICKS.board[1] + 10)),
    { at: s(110), ...BD_REST },
  ],
  clicks: SCENE_CLICKS.board,
  frame: (t) => {
    if (t < BD_RESET) return { scene: fromScene(t), out: 0, heroIn: 1 };
    if (t < BD_RESET + BD_HALF) return { scene: BD_RESET - 1, out: (t - BD_RESET + 1) / BD_HALF, heroIn: 1 };
    if (t < BD_RESET + 2 * BD_HALF) return { scene: 0, out: 0, heroIn: (t - BD_RESET - BD_HALF) / BD_HALF };
    return { scene: 0, out: 0, heroIn: 1 };
  },
  overlays: (t) => ({ caption: shown(t, BOARD_CALLOUT_AT, BOARD_CALLOUT_OUT) }),
};

/** BoardWindow's state for a loop frame: the scene's state, never panned, plus the reset. */
export function boardLoopState(f: BoardFrame, fps: number) {
  const base = { ...boardState(f.scene, fps), scroll: 0 };
  if (f.out > 0) {
    const e = CAM_EASE(f.out);
    return {
      ...base,
      columns: COLUMNS_AFTER,
      float: null,
      rowStyle: (status: WorkOrderStatus, index: number, id: string): CSSProperties | undefined => {
        if (id === HERO_ID) return { opacity: 1 - e };
        if (status === 'in_progress' && index > 0) return { transform: `translateY(${-SLOT_STEP * e}px)` };
        if (status === 'scheduled') return { transform: `translateY(${SLOT_STEP * e}px)` };
        return undefined;
      },
    };
  }
  if (f.heroIn < 1) {
    return {
      ...base,
      rowStyle: (_: WorkOrderStatus, __: number, id: string): CSSProperties | undefined =>
        id === HERO_ID ? { opacity: f.heroIn } : undefined,
    };
  }
  return base;
}

export const LOOP_SPECS = [BOOKING_LOOP, ESTIMATE_LOOP, DISCOUNTS_LOOP, PRICE_LIST_LOOP, BOARD_LOOP] as LoopSpec<unknown>[];
