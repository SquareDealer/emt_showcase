// The discount sequence — the chain kit's line discount 10 %, then the order discount 5 % — as one
// pure timeline on its own clock `t`. LoopDiscounts plays it as is (t = loop frame); the Estimate
// scene plays it from DISCOUNTS_FROM (t = frame − DISCOUNTS_FROM, a multiple of 15, so its clicks stay
// on the beat). Both draw the same states, the same cursor targets and the same totals.
import { orderTotal } from '@crm/lib/format';
import { woHero } from '../fixtures';
import { countUp, typed, type CursorPoint } from '../kit/math';
import { FPS } from '../timing';

const [, WO1, WO2, WO3] = woHero;
/** «Итого» of wo-hero.1 → .2 → .3 through the PricingService mirror: 44 400 → 42 910 → 40 764,50. */
export const DISCOUNT_TOTALS = [orderTotal(WO1), orderTotal(WO2), orderTotal(WO3)] as const;

/** A click's effect lands 3 frames after the press (every scene's convention). */
const FX = 3;
/** Clicks (t): ✎ on the kit row, its discount field, ✓, the order-discount type. One beat apart at
 *  least, so every state is on screen a beat before the next action. */
export const DC_CLICKS = [30, 45, 75, 105] as const;
const [DC_PENCIL, DC_INPUT, DC_SAVE, DC_TYPE] = DC_CLICKS;
/** ✎ shows on the kit row once the pointer is over it (it lands at 27). */
export const DC_HOVER = 25;
/** The kit line's edit form opens. */
export const DC_EDIT = DC_PENCIL + FX;
/** Typing pace of both discount fields (kit `typed()`): frames per character. */
export const DC_PER_CHAR = 5;
/** What is typed: the kit line's discount, then the order's (both in %). */
export const DC_KIT_VALUE = '10';
export const DC_ORDER_VALUE = '5';
/** «10» is typed into its discount field, 5 frames a character: «1» at 53, «10» at 58. */
export const DC_TYPE_10 = DC_INPUT + FX;
/** ✓: wo-hero.2 — the row shows «−1 490 ₽ (10%)», «Итого» counts 44 400 → 42 910 over DC_COUNT. */
export const DC_SNAP2 = DC_SAVE + FX;
/** «%» chosen: the order-discount input appears (empty), «5» is typed from here (at 113). */
export const DC_DTYPE = DC_TYPE + FX;
/** The order discount applies (the app's onBlur), a beat after the type click: wo-hero.3. */
export const DC_SNAP3 = DC_TYPE + 15;
/** The frames (t) where a typed discount gains a character — one key sound each: «1» 53, «10» 58,
 *  «5» 113. The same constants `discountsAt` types with. */
export const DC_KEY_FRAMES: readonly number[] = [
  ...Array.from(DC_KIT_VALUE, (_, i) => DC_TYPE_10 + (i + 1) * DC_PER_CHAR),
  ...Array.from(DC_ORDER_VALUE, (_, i) => DC_DTYPE + (i + 1) * DC_PER_CHAR),
];
/** Both count-downs last a beat. */
export const DC_COUNT = 15;
/** «Итого» settles on 40 764,50 ₽. */
export const DC_SETTLED = DC_SNAP3 + DC_COUNT;

export type DiscountsState = {
  snap: 1 | 2 | 3;
  /** «Итого» shown (wo-hero.{snap}'s total_cached is overridden with it). */
  total: number;
  /** The kit line's edit form with this discount typed; null = the read-only row. */
  edit: string | null;
  /** The pointer is over the kit row (its ✎ / 🗑 show). */
  hoverKit: boolean;
  discountDraft: { type: 'percent'; value: string } | null;
  /** The app's row outline on the kit line, from the save on. */
  kitOutline: boolean;
};

/** The sequence's state at t (t < 0 behaves as 0: wo-hero.1, nothing set). */
export function discountsAt(t: number): DiscountsState {
  const snap = t >= DC_SNAP3 ? 3 : t >= DC_SNAP2 ? 2 : 1;
  return {
    snap,
    total:
      snap === 1
        ? DISCOUNT_TOTALS[0]
        : snap === 2
          ? countUp(t, DC_SNAP2, DC_SNAP2 + DC_COUNT, DISCOUNT_TOTALS[0], DISCOUNT_TOTALS[1])
          : countUp(t, DC_SNAP3, DC_SETTLED, DISCOUNT_TOTALS[1], DISCOUNT_TOTALS[2]),
    edit: t >= DC_EDIT && t < DC_SNAP2 ? typed(t, DC_TYPE_10, DC_KIT_VALUE, DC_PER_CHAR) : null,
    hoverKit: t >= DC_HOVER && t < DC_EDIT,
    discountDraft: t >= DC_DTYPE ? { type: 'percent', value: typed(t, DC_DTYPE, DC_ORDER_VALUE, DC_PER_CHAR) } : null,
    kitOutline: t >= DC_SNAP2,
  };
}

/** The EstimateWindow key for a state: the view's own form state starts from each order (and from
 *  the edit form) whatever frame a render tab drew before. */
export const discountsKey = (d: DiscountsState) => `wo${d.snap}${d.edit !== null ? '-edit' : ''}`;

// ---- geometry, UI px of the 1440×900 window ----
// Measured on EstimateWindow (wo-hero.1, the kit line hovered / in edit; getBoundingClientRect −
// `.crm-root`): the kit row's ✎ x 1001 y 656.3 30×30; the edit form's discount input x 791 y 657.3
// 52×30 and its ✓ x 1033 y 657.3 30×30.
/** The order-discount type `[data-demo="wo-discount"] select` (snapshot 2, type «нет»). */
export const DISC_TYPE = { x: 1307, y: 471.5, w: 92, h: 30 };
export const DC_PENCIL_AT = { x: 1016, y: 671 };
export const DC_INPUT_AT = { x: 817, y: 672 };
export const DC_CHECK_AT = { x: 1048, y: 672 };
/** After the click on the discount field the pointer drifts down-right, off the digits being typed
 *  and on the way to ✓ (over the next row's «—» discount cell). */
const DC_INPUT_ASIDE = { x: 900, y: 708 };
export const DC_TYPE_AT = { x: DISC_TYPE.x + 30, y: DISC_TYPE.y + DISC_TYPE.h / 2 };

/**
 * The pointer from its landing on ✎ (DC_PENCIL − 3) to the order discount applied (DC_SNAP3 + 4), in
 * seconds of a clock that starts at t = −shift (LoopDiscounts: 0; the scene: DISCOUNTS_FROM). Each
 * user adds its own way in before and its own way out after. The hops between targets a beat apart
 * ease steadily (sine), leave as soon as the press is down and arrive a few frames before the next
 * click: their top speed stays ≤ 75 frame px per frame up to the social kit shot's 2.5×.
 */
export function discountsCursor(shift: number): CursorPoint[] {
  const at = (t: number) => (t + shift) / FPS;
  return [
    { at: at(DC_PENCIL - 3), ...DC_PENCIL_AT },
    { at: at(DC_PENCIL + 1), ...DC_PENCIL_AT },
    { at: at(DC_INPUT - 2), ...DC_INPUT_AT, ease: 'steady' },
    { at: at(DC_INPUT + 2), ...DC_INPUT_AT },
    { at: at(DC_INPUT + 9), ...DC_INPUT_ASIDE, ease: 'steady' },
    { at: at(DC_SAVE - 14), ...DC_INPUT_ASIDE },
    { at: at(DC_SAVE - 3), ...DC_CHECK_AT, ease: 'steady' },
    { at: at(DC_SAVE + 3), ...DC_CHECK_AT },
    { at: at(DC_TYPE - 4), ...DC_TYPE_AT, ease: 'steady' },
    { at: at(DC_SNAP3 + 4), ...DC_TYPE_AT },
  ];
}
