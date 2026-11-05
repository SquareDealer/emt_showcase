import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
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
import { Callout } from '../kit/Callout';
import { Cursor } from '../kit/Cursor';
import { cursorAt, typed, type CamKey, type CursorPoint } from '../kit/math';
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
/** Empty right part of the `.client-meta` row (x 631–1406, y 184.5–256): the wide callout's pill. */
const META_Y = 220;

const [CLICK_HIT] = SCENE_CLICKS.search;
/** The app's `palette-in` (150 ms) as a spring. */
export const OPEN_FRAMES = 5;
/** «WMWSV32» typed 15–50: a character every 5 frames (TypeText's default). */
export const TYPE_FROM = 15;
export const FRAMES_PER_CHAR = 5;
/** The click's effects land 3 frames after the press: the palette closes, the route switches. */
export const SWITCH_AT = CLICK_HIT + 3;
export const MOVE_FROM = 75;
export const MOVE_TO = 135;
/** Social: the camera holds on the whole card until the callout is gone (the pill is above the window). */
export const SOCIAL_MOVE_FROM = 90;
/** The callout leaves before the camera moves off it (social: before its camera starts to move). */
const CALLOUT_OUT = { wide: 102, social: SOCIAL_MOVE_FROM - 6 };
/** `.content` scroll at the end (UI px): wide — just enough for row 10 to clear the window's bottom
 *  edge; social — the page's end (1057 − 900), the whole orders panel in the window. */
export const SCROLL = { wide: 40, social: 157 } as const;

export const QUERY = HERO.r56.vin.slice(0, 7);

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
/** kit/math's camera curve, so the page scroll and the camera move as one. */
const CAM_EASE = Easing.bezier(0.65, 0, 0.35, 1);

// ---- cursor ----
/** Click point on the hero hit: its vertical centre (between the VIN and the owner's name), left of its middle. */
export const CLICK_POINT = { x: HIT.x + 190, y: HIT.y + HIT.h / 2 };
// Rests below the window (out of view) while the first characters are typed, comes up from 34 as the
// hits narrow to the hero and rests on it from 52 (hover), presses at 60, then leaves below-right of
// the card (out of every view by 95).
const CURSOR: CursorPoint[] = [
  { at: 0, x: 1180, y: 1000 },
  { at: s(34), x: 1180, y: 1000 },
  { at: s(CLICK_HIT - 8), ...CLICK_POINT },
  { at: s(CLICK_HIT + 6), ...CLICK_POINT },
  { at: s(95), x: 1300, y: 1010 },
];

/** Scene-local state: a pure function of the frame. */
export function searchState(frame: number, fps: number, social = false) {
  const q = typed(frame, TYPE_FROM, QUERY, FRAMES_PER_CHAR);
  return {
    open: frame < SWITCH_AT,
    q,
    hits: q ? searchByPrefix[q] : [],
    /** 0 → 1: the palette's fade/drop-in. */
    openP: spring({ frame, fps, config: { damping: 200 }, durationInFrames: OPEN_FRAMES }),
    cursor: cursorAt(frame, fps, CURSOR),
    scroll: interpolate(frame, [social ? SOCIAL_MOVE_FROM : MOVE_FROM, MOVE_TO], [0, social ? SCROLL.social : SCROLL.wide], {
      ...clamp,
      easing: CAM_EASE,
    }),
  };
}

const noop = () => {};
/** Behind the palette: the Board scene's last frame (hero «В работе», board panned to «Выдана»). */
const BOARD_END = boardState(BOARD_LAST_FRAME, FPS);

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
        state={BOARD_END}
        overlays={
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
// (738). The palette (410–1030) sits left, the callout's pill fills the right (1046–~1400) level with
// the hit. After the switch the same view shows the back link, the card head (actions end at 1406), the
// stats and the top of both panels.
// END 1.667× (view 1152×648): x 264–1416 — both panels whole (274–1406); y in the page: 276.3–924.3 —
// from the gap above the panels (grid at 280) to the line under row 10 (324.8 + 54.5·11 = 924.3):
// the panel head and rows 0–10, every row whole. The page is scrolled by 40 (window y = page y − 40),
// so the view's bottom (884.3) stays inside the 900-px window.
const TOP = { x: 840, y: 414, zoom: 1.6 };
const END_ZOOM = 1920 / 1152;
const END_TOP_PAGE = ROW_Y0 + ROW_H * 11 - 1080 / END_ZOOM;
const END = { x: 840, y: END_TOP_PAGE + 540 / END_ZOOM - SCROLL.wide, zoom: END_ZOOM };
// SOCIAL (1080×1350). WHOLE 1.406× (view 768×960 UI px, the Board scene's social framing): x 266–1034 —
// the palette (410–1030) and, after the switch, the back link, avatar (from 274), name, phone, stats and
// the vehicles panel; y −60–900 — the window's full height plus a band of background above it for the
// callout's pill. ORDERS 1.5× (view 720×900): x 698–1418 — the orders panel (710–1406) edge to edge;
// y 0–900 — the window's full height: the page scrolled to its end (157) puts the panel at window y
// 124–876 under the whole topbar, all 13 rows whole. The social camera holds until the callout is gone.
const SOCIAL_WHOLE = { x: 650, y: 420, zoom: 1080 / 768 };
const SOCIAL_ORDERS = { x: 1058, y: 450, zoom: 1.5 };
export const cameraKeys = (social: boolean): CamKey[] =>
  social
    ? [
        { at: 0, ...SOCIAL_WHOLE },
        { at: s(SOCIAL_MOVE_FROM), ...SOCIAL_WHOLE },
        { at: s(MOVE_TO), ...SOCIAL_ORDERS },
      ]
    : [
        { at: 0, ...TOP },
        { at: s(MOVE_FROM), ...TOP },
        { at: s(MOVE_TO), ...END },
      ];

/** The callout's dot (window px). */
export const calloutAnchor = (social: boolean, scroll: number) =>
  social
    ? // On the topbar right of the search box (264–684), the pill above the window in the background
      // band (as in the Board scene): it covers neither the palette nor the card. The topbar doesn't scroll.
      { x: 760, y: 14 }
    : // Right of the palette level with the hit; after the switch the same spot is the empty right part
      // of the stats row: below «Изменить»/«Удалить» (end 152.5), above the panels (280). It rides with
      // the page's scroll, so it never slides over the panels.
      { x: HIT.x + HIT.w + 9, y: META_Y - scroll };

/** 1 → 0 over `dur` frames from `from`. */
const fadeOut = (frame: number, from: number, dur = 6) => interpolate(frame, [from, from + dur], [1, 0], clamp);

/**
 * Search (150 f): ⌘K palette opens over the board (0) → «WMWSV32» typed 15–50, the hits narrow with
 * each prefix to the hero R56 → click on it (60; effects 63): the palette closes, the client's card
 * opens — callout «Любая машина по VIN — за секунду» (60) → 75–135 down the order history: the timing
 * chain in progress on top, the R56's diagnostics and the past visits under it.
 */
export function SearchScene({ theme, brand, callouts, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = searchState(frame, fps, social);
  const calloutOpacity = fadeOut(frame, social ? CALLOUT_OUT.social : CALLOUT_OUT.wide);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={cameraKeys(social)}>
        <SearchWindow theme={theme} brandName={brand.name} state={state} />
        {calloutOpacity > 0 ? (
          <div style={{ position: 'absolute', left: 0, top: 0, opacity: calloutOpacity, zIndex: 90 }}>
            <Callout
              text={callouts.vin}
              at={CLICK_HIT}
              anchor={calloutAnchor(social, state.scroll)}
              side={social ? 'top' : 'right'}
              accent={accent}
            />
          </div>
        ) : null}
        <Cursor path={CURSOR} clicks={SCENE_CLICKS.search} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}
