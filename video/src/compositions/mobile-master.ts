import { Easing, interpolate } from 'remotion';
import { navForRole } from '@crm/lib/view-helpers';
import { HERO } from '../../../demo/seed/hero';
import { boardMaster, users } from '../fixtures';
import { clickState, pingPong } from '../kit/math';

// ---------------------------------------------------------------------------------------------
// MobileMaster (390×844, 180 f): the master's phone. The CRM's own ≤900 px / ≤560 px breakpoints
// switch on because the composition (= the browser viewport) is 390 px wide — no video CSS fakes
// the mobile layout. Pre-rendered by `npm run prerender:mobile` to public/prerender/mobile-master.mp4,
// which PhoneFrame plays inside the bezel (LoopMasterMobile).
//
// Geometry at 390 px (app-shell.css @media ≤900 px, index.css tokens, 1rem = 16 px):
//   hamburger  topbar 57 px high, padding-left 24, a 44×44 icon button → centre (46, 28.5)
//   close «×»  drawer 260 px wide, brand row 57 px, button 44 px at right 12 → centre (226, 28.5)
//   board      `.page` padding 16 → `.board` is 358 px wide; five columns of 244 px (the
//              minmax(244px, 1fr) minimum) with 12-px gaps = 1268 px → scroll range 910.
// ---------------------------------------------------------------------------------------------
export const MOBILE_W = 390;
export const MOBILE_H = 844;
export const MOBILE_FRAMES = 180;

/** Tap on the hamburger; the drawer slides in from +3 (every scene's click → effect delay). */
export const TAP_OPEN = 15;
/** Tap on the drawer's «×»; frame 60 still shows the menu fully open. */
export const TAP_CLOSE = 60;
const EFFECT_DELAY = 3;
const SLIDE = 12;
/** Board pan: out to «Выдана» (rise 45 f), hold 15 f, back by the last frame. */
const PAN_FROM = 75;
const PAN_HOLD = 15;
export const PAN_MAX = 5 * 244 + 4 * 12 - (MOBILE_W - 2 * 16);

// z: the CRM's --z-sticky 200 (topbar), --z-backdrop 300, --z-drawer 400. The hamburger tap sits
// above the topbar but under the drawer, so the menu slides over the fading mark; the «×» tap is on
// the drawer itself, so above it.
const HAMBURGER = { x: 46, y: 28.5, z: 250 };
const DRAWER_CLOSE = { x: 226, y: 28.5, z: 1000 };
/** The tap mark shows a few frames before each tap (finger landing) and fades with its ring. */
const TAP_LEAD = 5;
const TAP_TAIL = 16;

const found = users.find((u) => u.id === HERO.masterId);
if (!found || found.role !== 'master') throw new Error('fixtures/users.json: HERO.masterId is not a master');
export const MASTER = found;
export const MASTER_NAV = navForRole(MASTER.role);
/** /work-orders/board as HERO.logins.master — the API's own role scoping, not a client filter. */
export const MOBILE_COLUMNS = boardMaster;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
/** The app's --ease (ease-out-ish) for the drawer slide. */
const DRAWER_EASE = Easing.bezier(0.2, 0, 0, 1);

/** Composition state: a pure function of the frame. */
export function mobileMasterState(frame: number, fps: number) {
  const openAt = TAP_OPEN + EFFECT_DELAY;
  const closeAt = TAP_CLOSE + EFFECT_DELAY;
  const drawer =
    frame < closeAt
      ? interpolate(frame, [openAt, openAt + SLIDE], [0, 1], { ...clamp, easing: DRAWER_EASE })
      : interpolate(frame, [closeAt, closeAt + SLIDE], [1, 0], { ...clamp, easing: DRAWER_EASE });
  const near = (t: number) => frame >= t - TAP_LEAD && frame < t + TAP_TAIL;
  const tapAt = near(TAP_OPEN) ? TAP_OPEN : near(TAP_CLOSE) ? TAP_CLOSE : null;
  const tap =
    tapAt === null
      ? null
      : {
          ...(tapAt === TAP_OPEN ? HAMBURGER : DRAWER_CLOSE),
          ...clickState(frame, [tapAt], fps),
          opacity: interpolate(frame, [tapAt - TAP_LEAD, tapAt, tapAt + 8, tapAt + TAP_TAIL], [0, 1, 1, 0], clamp),
        };
  return {
    drawer,
    /** The app's `drawerOpen` (backdrop, `.sidebar.open`, dialog role) from the tap's effect until slid out. */
    drawerOpen: frame >= openAt && frame < closeAt + SLIDE,
    // Whole pixels: text stays crisp, and the eased tail (0.36 px at the last frame) snaps to 0, so
    // the last frame is pixel-identical to frame 0.
    scroll: Math.round(pingPong(frame, PAN_FROM, MOBILE_FRAMES, PAN_MAX, PAN_HOLD)),
    tap,
  };
}
