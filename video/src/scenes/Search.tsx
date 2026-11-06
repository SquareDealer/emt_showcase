import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AppShellView } from '@crm/components/AppShellView';
import { SearchPaletteView } from '@crm/components/SearchPaletteView';
import { ClientCardView } from '@crm/features/clients/ClientCardView';
import { navForRole } from '@crm/lib/view-helpers';
import type { Brand } from '@crm/lib/brand';
import { HERO } from '../../../demo/seed/hero';
import { clientHero, searchByPrefix, users, woHero } from '../fixtures';
import type { ShowcaseProps } from '../schema';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { Cursor } from '../kit/Cursor';
import { SceneTitles, type TitleCue } from '../kit/SceneTitles';
import { CAM_EASE, SOCIAL_STAGE, cursorAt, socialKeyForView, typed, type CamKey, type CursorPoint } from '../kit/math';
import { useLayout } from '../kit/useLayout';
import { FPS, SCENE_CLICKS } from '../timing';
import { BOARD_LAST_FRAME, BoardWindow, boardState } from './Board';

// ---------------------------------------------------------------------------------------------
// Target geometry, UI pixels of the 1440×900 AppWindow (top-left = 0,0). Measured from the
// rendered DOM: a throwaway composition rendered SearchWindow at zoom 1 with the states of frames
// 50 (palette, «WMWSV32» typed) and 100 (client card, no scroll), waited for document.fonts.ready
// and printed getBoundingClientRect() of each node minus the `.crm-root` rect into the PNG.
//   PALETTE  `.palette` x 410 y 108 w 620 (centred in the window; video.css pins the app's 12vh/70vh
//            to the 900-px window): input row 109–159.5, group «Автомобили» 167.5–194.5, the only hit
//            of «WMWSV32» 194.5–248, foot 256–291 → h 184. With 50 hits (prefixes W…WMW) it grows to
//            its 630-px max height (bottom 738).
//   HIT      the first `[data-demo="search-hit"]` of «WMWSV32» (the hero R56): x 419 y 194.5 w 602 h 53.5.
//   CARD     (client card, `.content` from y 57) back link 274,81 (h 19.5); `client-head` 274,116.5
//            1132×52 — name 342–628, `.client-head-actions` («Изменить», «Удалить») x 1181–1406,
//            y 116.5–152.5; `.client-meta` y 184.5–256 with the two stats at x 274–631 (the rest of
//            the row is empty); `.card-grid` from y 280: vehicles panel x 274–694 (h 181), orders
//            panel `client-orders` x 710–1406, head 281–324.8, rows `order-row` at 324.8 + 54.5·k
//            (13 rows: wo-hero.4 + 12 exported), panel bottom 1033; `.shell` is 1057 tall, so the
//            page scrolls by at most 157 in the 900-px window.
// ---------------------------------------------------------------------------------------------
export const HIT = { x: 419, y: 194.5, w: 602, h: 53.5 };
export const ROW_Y0 = 324.8;
export const ROW_H = 54.5;
/** `.card-grid` top: the end view's top edge sits in the gap above it. */
export const GRID_TOP = 280;
const [CLICK_HIT] = SCENE_CLICKS.search;
/** ⌘K: the palette opens a beat after the transition has revealed the board (0–30), so the app's own
 *  dimmed, 2-px-blurred backdrop is a state the viewer sees the app enter — never part of a transition. */
export const PALETTE_AT = 30;
/** The app's `palette-in` (150 ms) as a spring. */
export const OPEN_FRAMES = 5;
/** «WMWSV32» typed 45–80: a character every 5 frames (TypeText's default). */
export const TYPE_FROM = PALETTE_AT + 15;
export const FRAMES_PER_CHAR = 5;
/** The click's effects land 3 frames after the press: the palette closes, the route switches. */
export const SWITCH_AT = CLICK_HIT + 3;
export const MOVE_FROM = 105;
export const MOVE_TO = 165;
/** Social: the camera holds on the card head until 120, then settles on the orders by SOCIAL_SETTLE (a
 *  15-frame move, as the other social moves) and holds them to the transition (195). */
export const SOCIAL_MOVE_FROM = 120;
export const SOCIAL_SETTLE = 135;
/** Chapter 06: in as the hits narrow to the hero (75: «WMWSV3», one hit — the palette is short again,
 *  frame y ≤ 345, far above the slate), through the click and down the order history; out at 180. */
export const TITLES: readonly TitleCue[] = [{ key: 'vin', at: 75, out: 180 }];
/** `.content` scroll at the end (UI px): wide — just enough for row 10 to clear the window's bottom
 *  edge; social — none (its orders shot is the panel head and the first nine rows). */
export const SCROLL = { wide: 40, social: 0 } as const;

export const QUERY = HERO.r56.vin.slice(0, 7);
/** Scene-local frames where `typed(frame, TYPE_FROM, QUERY, FRAMES_PER_CHAR)` gains a character —
 *  the Hero's key sounds (one per character). */
export const TYPE_KEY_FRAMES: readonly number[] = Array.from({ length: QUERY.length }, (_, i) => TYPE_FROM + (i + 1) * FRAMES_PER_CHAR);

const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});

const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

// ---- data (fixtures only) ----
for (let n = 1; n <= QUERY.length; n++) {
  if (!searchByPrefix[QUERY.slice(0, n)]) throw new Error(`Search: fixtures/search/${QUERY.slice(0, n)}.json missing`);
}
const HERO_HIT = searchByPrefix[QUERY][0];
if (HERO_HIT?.type !== 'vehicle' || HERO_HIT.id !== HERO.r56.vehicleId || HERO_HIT.client?.id !== HERO.client.id) {
  throw new Error(`Search: the first hit of «${QUERY}» is not the hero R56 (${HERO_HIT?.id})`);
}
// HIT was measured with a single hit under one group head («Автомобили»).
if (searchByPrefix[QUERY].length !== 1) throw new Error(`Search: «${QUERY}» has ${searchByPrefix[QUERY].length} hits — re-measure HIT`);
if (clientHero.client.id !== HERO.client.id) throw new Error('Search: client-hero.json is not the hero client');
const CURRENT = woHero[4];
if (CURRENT.vehicle?.client?.id !== HERO.client.id || clientHero.orders.some((o) => o.id === CURRENT.id)) {
  throw new Error('Search: wo-hero.4 must be the hero client\'s order and not already in client-hero.json');
}
if (!clientHero.orders.some((o) => o.id === HERO.diagnosticsOrderId)) throw new Error('Search: no diagnostics order in client-hero.json');
/**
 * The card's order list after the earlier scenes: the app lists /work-orders by created_at DESC, so
 * the hero order (created on DEMO_NOW, in progress since the Board scene) is on top, then the history
 * exported in client-hero.json (exported before the hero copy existed).
 */
export const ORDERS = [CURRENT, ...clientHero.orders];
if (ORDERS.length !== 13) throw new Error(`Search: ${ORDERS.length} orders on the card — re-measure the rows`);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const s = (f: number) => f / FPS;

// ---- cursor ----
/** Click point on the hero hit: its vertical centre (between the VIN and the owner's name), left of its middle. */
export const CLICK_POINT = { x: HIT.x + 190, y: HIT.y + HIT.h / 2 };
// Rests below the window (out of view) while the first characters are typed, comes up from 64 as the
// hits narrow to the hero and rests on it from 82 (hover), presses at 90; from the switch (93) it heads
// down-left — past the vehicles panel, through the empty page under it — and is out of every view (left
// of x 264, below the window) by 114, so it never rests on the card's text.
export const CURSOR_GONE = 114;
/** Window px left of every view (wide ≥ 264, social ≥ 263) and below the window. */
export const CURSOR_PARK = { x: 200, y: 1000 };
const CURSOR: CursorPoint[] = [
  { at: 0, x: 1180, y: 1000 },
  { at: s(64), x: 1180, y: 1000 },
  { at: s(CLICK_HIT - 8), ...CLICK_POINT },
  { at: s(SWITCH_AT), ...CLICK_POINT },
  { at: s(CURSOR_GONE), ...CURSOR_PARK },
];

/** Scene-local state: a pure function of the frame. */
export function searchState(frame: number, fps: number, social = false) {
  const q = typed(frame, TYPE_FROM, QUERY, FRAMES_PER_CHAR);
  return {
    open: frame < SWITCH_AT,
    /** The palette is up (⌘K pressed): from PALETTE_AT to the switch. */
    palette: frame >= PALETTE_AT && frame < SWITCH_AT,
    q,
    hits: q ? searchByPrefix[q] : [],
    /** 0 → 1: the palette's fade/drop-in. */
    openP: spring({ frame: frame - PALETTE_AT, fps, config: { damping: 200 }, durationInFrames: OPEN_FRAMES }),
    cursor: cursorAt(frame, fps, CURSOR),
    scroll: interpolate(frame, [social ? SOCIAL_MOVE_FROM : MOVE_FROM, MOVE_TO], [0, social ? SCROLL.social : SCROLL.wide], {
      ...clamp,
      // kit/math's camera curve, so the page scroll and the camera move as one.
      easing: CAM_EASE,
    }),
    /** Behind the palette: the Board scene's last frame in the same layout. */
    board: social ? BOARD_END_SOCIAL : BOARD_END,
  };
}

const noop = () => {};
/** Behind the palette: the Board scene's last frame (hero «В работе»; wide: board panned to «Выдана»,
 *  social: not panned). */
const BOARD_END = boardState(BOARD_LAST_FRAME, FPS);
const BOARD_END_SOCIAL = boardState(BOARD_LAST_FRAME, FPS, true);

/** The CRM window at a given state (no camera) — also what the coordinates above were measured on. */
export function SearchWindow({
  theme,
  brandName,
  state,
}: {
  theme: 'light' | 'dark';
  brandName: string;
  state: ReturnType<typeof searchState>;
}) {
  if (state.open) {
    const p = state.openP;
    return (
      <BoardWindow
        theme={theme}
        brandName={brandName}
        state={state.board}
        overlays={
          state.palette ? (
          <div data-demo="search-open" style={{ display: 'contents' }}>
            {/* The app's `palette-in` keyframes (fade, −6 px, 0.99 scale), driven by the frame. The
                backdrop's own `backdrop-filter: blur(2px)` mirrors the board's clipped (panned) left
                edge in headless Chrome, so the same 2-px blur is put on the shell under it instead. */}
            <style>{`[data-demo="search-open"] .palette-backdrop { opacity: ${p}; backdrop-filter: none; }
[data-demo="search-open"] .palette { transform: translateY(${-6 * (1 - p)}px) scale(${0.99 + 0.01 * p}); }
.shell:has(> [data-demo="search-open"]) > :is(.sidebar, .main) { filter: blur(${2 * p}px); }`}</style>
            {/* GlobalSearch's props once the debounce has settled on each prefix (the export holds the
                API's answer per prefix): first hit active, no spinner. */}
            <SearchPaletteView
              q={state.q}
              settledQ={state.q}
              hits={state.hits}
              active={0}
              onQ={noop}
              onKeyDown={noop}
              onHover={noop}
              onPick={noop}
              onClose={noop}
            />
          </div>
          ) : undefined
        }
      />
    );
  }
  // GlobalSearch.go: navigate(`/clients/${hit.client.id}`) — a fresh window on the client's route
  // (its MemoryRouter reads the route on mount), so the sidebar's «Клиенты» is active.
  return (
    <AppWindow key="client" theme={theme} route={`/clients/${HERO.client.id}`}>
      {/* The page's scroll: the app scrolls the document under the sticky topbar; here `.content`
          slides up by the same amount (the topbar stays on top, as in the app). */}
      <style>{`[data-demo="search-scroll"] .content { transform: translateY(${-state.scroll}px); }`}</style>
      <div data-demo="search-scroll" style={{ display: 'contents' }}>
        <AppShellView
          userName={owner!.name}
          nav={navForRole('owner')}
          theme={theme}
          drawerOpen={false}
          brand={brandFor(brandName)}
          onOpenSearch={noop}
          onNewIntake={noop}
          onToggleTheme={noop}
          onLogout={noop}
          onOpenDrawer={noop}
          onCloseDrawer={noop}
        >
          <ClientCardView
            client={clientHero.client}
            vehicles={clientHero.vehicles}
            orders={ORDERS}
            onEdit={noop}
            onDelete={noop}
            onAddVehicle={noop}
            onEditVehicle={noop}
            onNewWorkOrder={noop}
            onOpenOrder={noop}
          />
        </AppShellView>
      </div>
    </AppWindow>
  );
}

// ---- camera (seconds, UI px at frame centre) ----
// WIDE. TOP 1.6× (view 1200×675): x 240–1440 — the content area right of the sidebar to the window's
// edge; y 76.5–751.5 — from just above the back link (81) down past the palette's foot at its tallest
// (738; the long lists of the first prefixes only — from 75, one hit, the palette ends at frame y 345,
// far above the chapter slate). After the switch the same view shows the back link, the card head (actions end at 1406), the
// stats and the top of both panels.
// END 1.667× (view 1152×648): x 264–1416 — both panels whole (274–1406); y in the page: 276.3–924.3 —
// from the gap above the panels (grid at 280) to the line under row 10 (324.8 + 54.5·11 = 924.3):
// the panel head and rows 0–10, every row whole (the slate, out by 192, covers the left of rows 9–10
// during 165–192 only). The page is scrolled by 40 (window y = page y − 40),
// so the view's bottom (884.3) stays inside the 900-px window.
const TOP = { x: 840, y: 414, zoom: 1.6 };
const END_ZOOM = 1920 / 1152;
const END_TOP_PAGE = ROW_Y0 + ROW_H * 11 - 1080 / END_ZOOM;
const END = { x: 840, y: END_TOP_PAGE + 540 / END_ZOOM - SCROLL.wide, zoom: END_ZOOM };
// SOCIAL (stage 1080×970 between the bands), one zone at a time:
//   PALETTE 1.7 (view 635×571): x 402–1038 — the palette (410–1030) edge to edge; y 100–670 — its input
//           and the hits (the one hero hit from 75; the 50-hit list of the first prefixes runs past the
//           stage's bottom edge).
//   HEAD    2.45 by 106 (view 441×396): x 264–704 — the back link, avatar, name, phone, stats and the
//           vehicles panel (274–694), short of the orders panel (710); y 75–471 — back link (81) to the
//           vehicles panel's bottom (461).
//   ORDERS  1.95 from 120 by 135 (view 554×498): x 704–1258 — the orders panel from its left edge: titles,
//           cars, dates and the status chips (end 1251); the amounts (from 1267) are left out whole, not
//           cut; y 263–760.8 — under the stats (256), the panel head and rows 0–7, the bottom edge on the
//           line under row 7. The page doesn't scroll.
const SOCIAL_PALETTE = { x: 720, y: 385, zoom: 1.7 };
const SOCIAL_HEAD = { x: 484, y: 273, zoom: 2.45 };
/** Status chips end at x 1251, the amounts start at 1267 (measured on a full-scale still). */
export const ORDER_CHIPS_END = 1251;
export const ORDER_AMOUNTS_X = 1267;
const ORDERS_ZOOM = 1080 / (1258 - 704);
const ORDERS_BOTTOM = ROW_Y0 + ROW_H * 8;
const SOCIAL_ORDERS = socialKeyForView(704, ORDERS_BOTTOM - SOCIAL_STAGE.height / ORDERS_ZOOM, ORDERS_ZOOM);
export const SOCIAL_ZONES = {
  palette: { x: 410, y: 108, w: 620, h: HIT.y + HIT.h - 108 },
  head: { x: 274, y: 81, w: 694 - 274, h: 461 - 81 },
  orders: { x: 710, y: 281, w: ORDER_CHIPS_END - 710, h: ORDERS_BOTTOM - 281 },
};
export const CAM: { wide: CamKey[]; social: CamKey[] } = {
  wide: [
    { at: 0, ...TOP },
    { at: s(MOVE_FROM), ...TOP },
    { at: s(MOVE_TO), ...END },
  ],
  social: [
    { at: 0, ...SOCIAL_PALETTE },
    { at: s(SWITCH_AT), ...SOCIAL_PALETTE },
    { at: s(SWITCH_AT + 13), ...SOCIAL_HEAD },
    { at: s(SOCIAL_MOVE_FROM), ...SOCIAL_HEAD },
    { at: s(SOCIAL_SETTLE), ...SOCIAL_ORDERS },
  ],
};

/**
 * Search (225 f): the board (revealed by the transition, 0–30) → ⌘K palette opens over it (30) →
 * «WMWSV32» typed 45–80, the hits narrow with each prefix to the hero R56, chapter 06 (75–180) →
 * click on it (90; effects 93): the palette closes, the client's card opens → 105–165 down the order
 * history: the timing chain in progress on top, the R56's diagnostics and the past visits under it,
 * held to the transition (195).
 */
export function SearchScene({ theme, brand, chapters, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = searchState(frame, fps, social);
  return (
    <AbsoluteFill>
      <Background theme={theme} captionBand />
      <Camera keys={social ? CAM.social : CAM.wide}>
        <SearchWindow theme={theme} brandName={brand.name} state={state} />
        <Cursor path={CURSOR} clicks={SCENE_CLICKS.search} accent={accent} />
      </Camera>
      <SceneTitles cues={TITLES} chapters={chapters} accent={accent} />
    </AbsoluteFill>
  );
}
