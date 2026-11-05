import type { CSSProperties } from 'react';
import { Easing, interpolate } from 'remotion';
import { orderTotal } from '@crm/lib/format';
import type { PriceListRow, VehicleGeneration, WorkOrderStatus } from '@crm/lib/types';
import { generations, priceList, woHero } from '../fixtures';
import { countUp, typed, type CamKey, type CursorPoint } from '../kit/math';
import { FPS, SCENE_CLICKS } from '../timing';
import { CALLOUT_AT as BOOKING_CALLOUT_AT, CAM as BOOKING_CAM, CURSOR as BOOKING_CURSOR } from '../scenes/Booking';
import {
  BLOCK_AT,
  CAM as ESTIMATE_CAM,
  CURSOR as ESTIMATE_CURSOR,
  DISC_TYPE,
  GEN_AT,
} from '../scenes/Estimate';
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
const CAM_EASE = Easing.bezier(0.65, 0, 0.35, 1);
/** 1 → 0 over `dur` frames from `from`. */
export const fadeOut = (t: number, from: number, dur = 6) => interpolate(t, [from, from + dur], [1, 0], clamp);
/** Opacity of an overlay that appears at `at` and fades out from `out` (6 frames). */
export const shown = (t: number, at: number, out: number, dur = 6) => (t < at ? 0 : fadeOut(t, out, dur));
const dur = (id: LoopId) => LOOP_DEFS.find((d) => d.id === id)!.dur;
/** LoopCrossfade's overlap: output frame f < HEAD shows clip(D + f) over clip(f), so every loop holds
 *  its first frame through 0 … HEAD−1 (nothing moves there; the scenes are idle that long anyway). */
export const HEAD = 10;
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
  /** Max opacity of the loop's captions and highlights (0 at both ends). */
  overlayOpacity: (t: number) => number;
};

// ---- LoopBooking (180): the Booking scene 0–149 (slot 75, «Новая запись» 105, the order lands 120,
// caption 90), then the landed order fades out while the camera pulls back to the week. ----
const BK_FADE_FROM = 150;
const BK_FADE = 15;
export const BK_CAPTION_OUT = 140;
const [, BK_CLICK_BOOKING] = SCENE_CLICKS.booking;
const bookingKeys = BOOKING_CAM.wide.filter((k) => k.at <= 5).map(toLoop);
export type BookingFrame = { scene: number; heroFade: number };
export const BOOKING_LOOP: LoopSpec<BookingFrame> = {
  id: 'LoopBooking',
  dur: dur('LoopBooking'),
  // Wide → 1.7 (hero) on the slot and the menu, held; back out 150–170 instead of the hero's dive.
  cam: [...bookingKeys, { ...bookingKeys[0], at: s(170) }],
  // The scene's path to «Новая запись», then back to where it idles at frame 0.
  cursor: [...BOOKING_CURSOR.filter((p) => p.at <= s(BK_CLICK_BOOKING + 12)), { ...BOOKING_CURSOR[0], at: s(165) }],
  clicks: SCENE_CLICKS.booking,
  frame: (t) => {
    if (t < BK_FADE_FROM) return { scene: fromScene(t), heroFade: 1 };
    if (t < BK_FADE_FROM + BK_FADE)
      return { scene: BK_FADE_FROM - 1, heroFade: interpolate(t, [BK_FADE_FROM, BK_FADE_FROM + BK_FADE], [1, 0]) };
    return { scene: 0, heroFade: 1 };
  },
  overlayOpacity: (t) => shown(t, BOOKING_CALLOUT_AT, BK_CAPTION_OUT),
};

// ---- LoopEstimate (240): the Estimate scene 0–193 («+ Из прайса…» 45, the work 75, the sheet with
// its generation price, the oil unticked 120, «Добавить» 150, the block lands, toast), then the order
// dissolves back to wo-hero.0 (194–208) while the camera returns. ----
export const ES_END = 194;
const ES_RESET = 15;
const estimateKeys = ESTIMATE_CAM.wide.filter((k) => k.at <= s(180)).map(toLoop);
export type EstimateFrame = { scene: number; reset: number };
export const ESTIMATE_LOOP: LoopSpec<EstimateFrame> = {
  id: 'LoopEstimate',
  dur: dur('LoopEstimate'),
  cam: [...estimateKeys, { ...estimateKeys.at(-1)!, at: s(ES_END) }, { ...estimateKeys[0], at: s(215) }],
  // The scene's path through the confirm and out to the right (178), then back to its start.
  cursor: [
    ...ESTIMATE_CURSOR.filter((p) => p.at <= s(178)),
    { ...ESTIMATE_CURSOR.find((p) => p.at === s(178))!, at: s(200) },
    { ...ESTIMATE_CURSOR[0], at: s(228) },
  ],
  clicks: SCENE_CLICKS.estimate.filter((c) => c < ES_END),
  frame: (t) => {
    if (t < ES_END) return { scene: fromScene(t), reset: 0 };
    if (t < ES_END + ES_RESET) return { scene: ES_END, reset: (t - ES_END) / ES_RESET };
    return { scene: 0, reset: 0 };
  },
  // The scene's wide captions (generation 90–126, block 135–180) and the generation-price ring (–110).
  overlayOpacity: (t) => Math.max(shown(t, GEN_AT, 126), shown(t, BLOCK_AT, 180), shown(t, GEN_AT, 110)),
};

// ---- LoopDiscounts (180): wo-hero.1 → the chain kit's ✎ (15), its discount field (30), «10» typed,
// ✓ (60): wo-hero.2, total counts down → the order discount «%» (90), «5», applied (108): wo-hero.3,
// total counts to 40 764,50 → caption «10% + 5% = 14,5%» → dissolve back to wo-hero.1. ----
const [, WO1, WO2, WO3] = woHero;
const TOTALS = [orderTotal(WO1), orderTotal(WO2), orderTotal(WO3)] as const;
/** A click's effect lands 3 frames after the press (every scene's convention). */
const FX = 3;
const [DC_PENCIL, DC_INPUT, DC_SAVE, DC_TYPE] = [15, 30, 60, 90];
const DC_EDIT = DC_PENCIL + FX;
const DC_SNAP2 = DC_SAVE + FX;
const DC_DTYPE = DC_TYPE + FX;
/** The order discount applies (the app's onBlur) 10 frames after «5» is typed. */
const DC_SNAP3 = 108;
export const DC_CAPTION = 120;
export const DC_CAPTION_OUT = 150;
const DC_RESET = 156;
const DC_RESET_LEN = 12;
export type DiscountsFrame = {
  snap: 1 | 2 | 3;
  total: number;
  /** The kit line's edit form with this discount typed; null = the read-only row. */
  edit: string | null;
  hoverKit: boolean;
  discountDraft: { type: 'percent'; value: string } | null;
  /** The app's row highlight on the kit line (wo-hero.2 until the caption leaves). */
  kitOutline: boolean;
  /** Opacity of wo-hero.1 dissolving in over the end state. */
  reset: number;
};
function discountsAt(t: number, reset: number): DiscountsFrame {
  const snap = t >= DC_SNAP3 ? 3 : t >= DC_SNAP2 ? 2 : 1;
  return {
    snap,
    total:
      snap === 1
        ? TOTALS[0]
        : snap === 2
          ? countUp(t, DC_SNAP2, DC_SNAP2 + 15, TOTALS[0], TOTALS[1])
          : countUp(t, DC_SNAP3, DC_SNAP3 + 20, TOTALS[1], TOTALS[2]),
    edit: t >= DC_EDIT && t < DC_SNAP2 ? typed(t, DC_INPUT + FX, '10', 5) : null,
    hoverKit: t >= HEAD && t < DC_EDIT,
    discountDraft: t >= DC_DTYPE ? { type: 'percent', value: typed(t, DC_DTYPE, '5', 5) } : null,
    kitOutline: t >= DC_SNAP2 && t < DC_CAPTION_OUT,
    reset,
  };
}
// Cursor targets, UI px (measured on EstimateWindow with wo-hero.1, the kit line hovered / in edit):
// the kit row's ✎ x 1001 y 656.3 30×30; the edit form's discount input x 791 y 657.3 52×30 and its ✓
// x 1033 y 657.3 30×30; the order-discount type (the Estimate scene's DISC_TYPE).
export const DC_PENCIL_AT = { x: 1016, y: 671 };
export const DC_INPUT_AT = { x: 817, y: 672 };
export const DC_CHECK_AT = { x: 1048, y: 672 };
/** After the click on the discount field the pointer drifts down-left, off the digits being typed. */
const DC_INPUT_ASIDE = { x: 790, y: 708 };
const DC_TYPE_AT = { x: DISC_TYPE.x + 30, y: DISC_TYPE.y + DISC_TYPE.h / 2 };
/** Idle in the gap between the parts panel (to 1079) and the summary (from 1096), clear of every row
 *  and of the caption (which ends at the summary's left edge, above 565). */
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
  cursor: [
    { at: 0, ...DC_REST },
    { at: s(HEAD), ...DC_REST },
    { at: s(DC_PENCIL - 2), ...DC_PENCIL_AT },
    { at: s(DC_PENCIL + 5), ...DC_PENCIL_AT },
    { at: s(DC_INPUT - 5), ...DC_INPUT_AT },
    { at: s(DC_INPUT + 2), ...DC_INPUT_AT },
    { at: s(DC_INPUT + 8), ...DC_INPUT_ASIDE },
    { at: s(DC_INPUT + 18), ...DC_INPUT_ASIDE },
    { at: s(DC_SAVE - 6), ...DC_CHECK_AT },
    { at: s(DC_SAVE + 6), ...DC_CHECK_AT },
    { at: s(DC_TYPE - 6), ...DC_TYPE_AT },
    { at: s(DC_SNAP3 + 4), ...DC_TYPE_AT },
    // Back down past the totals to the gap (the caption sits left of the summary, above it).
    { at: s(140), ...DC_REST },
  ],
  clicks: [DC_PENCIL, DC_INPUT, DC_SAVE, DC_TYPE],
  frame: (t) => {
    if (t >= DC_RESET + DC_RESET_LEN) return discountsAt(0, 0);
    // Under the dissolve the end state holds (the frame before it starts).
    if (t >= DC_RESET) return discountsAt(DC_RESET - 1, (t - DC_RESET) / DC_RESET_LEN);
    return discountsAt(t, 0);
  },
  // The kit line is marked by the app's own row outline (kitOutline), not a dimming ring: the
  // total counts down at the same time and must stay bright.
  overlayOpacity: (t) => shown(t, DC_CAPTION, DC_CAPTION_OUT),
};

// ---- LoopPriceList (180): «Прайс-лист» on R56 → the generation select: F56 (30/45) → F60 (75/90)
// → R56 (120/135); each pick swaps the rows to that generation's fixture and counts the changed
// prices over 15 frames; the first visible work whose price depends on the generation is outlined. ----
type GenCode = 'R56' | 'F56' | 'F60';
const gen = (code: GenCode): VehicleGeneration => {
  const g = generations.find((x) => x.code === code);
  if (!g) throw new Error(`generations.json: no ${code}`);
  return g;
};
/** The select's option label (PriceListView: genLabel + « · years»). */
export const genOption = (g: VehicleGeneration) =>
  `${g.make} ${[g.model, g.code].filter(Boolean).join(' ')}${g.years ? ` · ${g.years}` : ''}`;
export const plGeneration = gen;
// A native select opens on a window of its list: R56 … F60, in the generations' order.
const OPT_FROM = generations.indexOf(gen('R56'));
const OPT_TO = generations.indexOf(gen('F60'));
if (OPT_FROM < 0 || OPT_TO < OPT_FROM) throw new Error('generations.json: R56 must come before F60');
export const PL_OPTIONS = generations.slice(OPT_FROM, OPT_TO + 1).map(genOption);
const PL_COUNT = 15;
export const PL_PICKS = (
  [
    { from: 'R56', to: 'F56', open: 30, pick: 45 },
    { from: 'F56', to: 'F60', open: 75, pick: 90 },
    { from: 'F60', to: 'R56', open: 120, pick: 135 },
  ] as const
).map((p) => ({ ...p, pickIndex: PL_OPTIONS.indexOf(genOption(gen(p.to))), at: p.pick + FX }));
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
export const PL_CAPTION_OUT = 150;
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
const PL_SELECT = { x: 264, y: 176, w: 261, h: 36 };
/** FakeSelect list rows: 4 px below the control, 4 px padding, 36 px rows. */
const plOptionY = (i: number) => PL_SELECT.y + PL_SELECT.h + 4 + 4 + 36 * i + 18;
const PL_SELECT_AT = { x: PL_SELECT.x + 70, y: PL_SELECT.y + PL_SELECT.h / 2 };
const plOptionAt = (i: number) => ({ x: PL_SELECT.x + 110, y: plOptionY(i) });
/** Below the frame at the wide start (its view ends at y 1050). */
const PL_REST = { x: 900, y: 1100 };
const PL_START = { x: 720, y: 450, zoom: LOOP_SCALE };
// FOCUS 1.35 (view 1185×741): x 247–1433 — the select (264) to the reset buttons (to 1399);
// y 135–875 — from the gap between the page subtitle (to ~131) and the «Поколение» label (~149):
// the page bar with the caption above the column heads, rows 0–11 (row 5 is the pump; row 11 runs
// out at the bottom edge, as a list does).
const PL_FOCUS = { x: 840, y: 505, zoom: 1.35 };
export const PL_GEOMETRY = { select: PL_SELECT };
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
      { at: s(p.open - 6), ...PL_SELECT_AT },
      { at: s(p.open + 3), ...PL_SELECT_AT },
      { at: s(p.pick - 4), ...plOptionAt(p.pickIndex) },
      { at: s(p.pick + 5), ...plOptionAt(p.pickIndex) },
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
  overlayOpacity: (t) => shown(t, PL_CAPTION, PL_CAPTION_OUT),
};

// ---- LoopBoard (180): the Board scene's drag 0–119 (press 30, drop 75, settled by 92; caption
// 60–102) without its pan, then a reset: 120–129 the hero fades out of «В работе», its gap closes and
// «Запланирована» makes room (the scene's settle in reverse); 130–139 it fades back in on top of
// «Запланирована». ----
const BD_RESET = 120;
const BD_HALF = 10;
export type BoardFrame = { scene: number; out: number; heroIn: number };
export const BOARD_LOOP: LoopSpec<BoardFrame> = {
  id: 'LoopBoard',
  dur: dur('LoopBoard'),
  // The scene's START (1.75 → 1.458, view 1097×686): its x (258–1355) as is; the loop's view is taller,
  // so it starts under the topbar (57) at 60 instead of showing a sliver of it — rows 1–3 whole.
  cam: [{ ...toLoop(BOARD_CAM.wide[0]), at: 0, y: 60 + LOOP_H / 2 / toLoop(BOARD_CAM.wide[0]).zoom }],
  // The scene's path through the drop, then back to its idle point below the view.
  cursor: [
    { ...BOARD_CURSOR[0], at: 0 },
    { ...BOARD_CURSOR[0], at: s(HEAD) },
    ...BOARD_CURSOR.filter((p) => p.at > s(HEAD) && p.at <= s(SCENE_CLICKS.board[1] + 10)),
    { ...BOARD_CURSOR[0], at: s(110) },
  ],
  clicks: SCENE_CLICKS.board,
  frame: (t) => {
    if (t < BD_RESET) return { scene: fromScene(t), out: 0, heroIn: 1 };
    if (t < BD_RESET + BD_HALF) return { scene: BD_RESET - 1, out: (t - BD_RESET + 1) / BD_HALF, heroIn: 1 };
    if (t < BD_RESET + 2 * BD_HALF) return { scene: 0, out: 0, heroIn: (t - BD_RESET - BD_HALF) / BD_HALF };
    return { scene: 0, out: 0, heroIn: 1 };
  },
  overlayOpacity: (t) => shown(t, BOARD_CALLOUT_AT, BOARD_CALLOUT_OUT),
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
