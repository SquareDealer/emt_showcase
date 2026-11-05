import { useId, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AppShellView } from '@crm/components/AppShellView';
import { BoardCard, BoardView, type Columns } from '@crm/features/board/BoardView';
import { navForRole } from '@crm/lib/view-helpers';
import { STATUS_ORDER } from '@crm/lib/types';
import type { Brand } from '@crm/lib/brand';
import type { WorkOrderStatus } from '@crm/lib/types';
import { boardOwner, users, woHero } from '../fixtures';
import type { ShowcaseProps } from '../schema';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { Cursor } from '../kit/Cursor';
import { Callout } from '../kit/Callout';
import { cursorAt, type CamKey, type CursorPoint } from '../kit/math';
import { useLayout } from '../kit/useLayout';
import { FPS, SCENE_CLICKS } from '../timing';

// ---------------------------------------------------------------------------------------------
// Target geometry, UI pixels of the 1440×900 AppWindow (top-left = 0,0). Measured from the
// rendered DOM: a throwaway composition rendered BoardWindow at zoom 1 with the states of frames
// 0 (hero prepended to «Запланирована»), 100 (hero on top of «В работе») and 149 (board panned),
// waited for document.fonts.ready and printed getBoundingClientRect() of each node minus the
// `.crm-root` rect into the PNG.
//   COLS     `.board-col[data-status]`: x 264 + 256·i, w 244 (grid minmax(244px, 1fr) + 12-px gaps; the
//            five columns overflow the 1152-px page, «Выдана» is cut at 1416); heads y 155 h 45,
//            bodies from 200. Counters `.board-count`: «Запланирована» x 463 w 31.7, others 24 wide.
//   CARD     the hero `[data-demo="board-card"][data-id="hero-copy"]` on top of «Запланирована»:
//            x 273 y 208 w 226 h 155 — the same box as every card of the board (all have a time and
//            a master); rows at y 208 + 163·k (8-px `.board-col-body` gap), so rows end at 363, 526,
//            689, 852 and the gaps between them are 8 px.
//   SLOT     the hero on top of «В работе» after the drop: x 529 y 208 (the scheduled box + 256).
//   PAN      `.board` scrollWidth 1268 − clientWidth 1152 = 116: panned by that, «Выдана» ends at the
//            page's edge (1416) and the columns sit at x 148 + 256·i.
// ---------------------------------------------------------------------------------------------
const COL_X0 = 264;
const COL_PITCH = 256;
const COL_W = 244;
const CARD = { x: 273, y: 208, w: 226, h: 155 };
const SLOT_STEP = CARD.h + 8;
const SLOT = { x: CARD.x + COL_PITCH, y: CARD.y };
const PAN = 116;
/** «В работе»'s counter `.board-count`: x 727 y 167 w 24 h 20 — the callout dot sits 33 px above its centre. */
const CALLOUT_ANCHOR = { x: 739, y: 134 };

/** Left edge of a column before the pan. */
const colX = (status: WorkOrderStatus) => COL_X0 + COL_PITCH * STATUS_ORDER.indexOf(status);

/** Last frame of the Board scene (SCENES: 150 f) — what the Docs scene shows blurred behind the paper. */
export const BOARD_LAST_FRAME = 149;

const [CLICK_PRESS, CLICK_DROP] = SCENE_CLICKS.board;
// The press lands at 30 and the drag starts with it (ghost + floating card); the drop's effects
// (data moved, counters, settle) land 3 frames after the drop press, like every scene's click.
const DROP_AT = CLICK_DROP + 3;
/** Floating card glides into the slot over SETTLE frames, then cross-fades into the real card. */
const SETTLE = 10;
const SWAP_AT = DROP_AT + SETTLE;
const SWAP = 4;
const CALLOUT_AT = 60;
const CALLOUT_OUT = 102;
const PAN_FROM = 90;
const PAN_TO = 140;

/** Brand for the sidebar: trimmed logos (the originals' padding reads tiny at 44px). */
const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});

const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

// ---- data (fixtures only) ----
const HERO_BEFORE = woHero[3];
const HERO_AFTER = woHero[4];
if (HERO_BEFORE.status !== 'scheduled' || HERO_AFTER.status !== 'in_progress' || HERO_BEFORE.id !== HERO_AFTER.id) {
  throw new Error(
    `Board: expected wo-hero.3 scheduled → wo-hero.4 in_progress of one order, got ${HERO_BEFORE.status} → ${HERO_AFTER.status}`,
  );
}
const HERO_ID = HERO_BEFORE.id;
if (STATUS_ORDER.some((s) => boardOwner[s].some((w) => w.id === HERO_ID))) {
  throw new Error('board.owner.json already holds the hero order (it is exported before the hero copy)');
}
// CARD/SLOT and the slide-by-one-slot assume every card of the two columns has the hero's height
// (a time row and a master row); a card without them is shorter and the columns would jump.
for (const w of [HERO_BEFORE, ...boardOwner.scheduled, ...boardOwner.in_progress]) {
  if (!w.scheduled_at || !w.assigned_master) throw new Error(`Board: card ${w.id} has no time/master — re-measure`);
}

export const COLUMNS_BEFORE: Columns = { ...boardOwner, scheduled: [HERO_BEFORE, ...boardOwner.scheduled] };
export const COLUMNS_AFTER: Columns = { ...boardOwner, in_progress: [HERO_AFTER, ...boardOwner.in_progress] };

// ---- cursor ----
const s = (f: number) => f / FPS;
/** Grab point on the hero card (over the client's name, clear of the grip): offset from its top-left. */
const GRAB = { x: 118, y: 74 };
const GRAB_AT = { x: CARD.x + GRAB.x, y: CARD.y + GRAB.y };
/** Where the cursor lets go: the slot's grab point, a little off, so the settle is a short glide. */
const DROP_POINT = { x: SLOT.x + GRAB.x + 9, y: SLOT.y + GRAB.y + 13 };
// Idles low on «В работе», glides onto the hero card, then carries it in a shallow arc (lifted ~26 px
// mid-way) to «В работе» and lets go; after the drop it leaves below the window (out of every view).
const CURSOR: CursorPoint[] = [
  { at: 0, x: 700, y: 760 },
  { at: s(6), x: 700, y: 760 },
  { at: s(CLICK_PRESS - 6), ...GRAB_AT },
  { at: s(CLICK_PRESS + 4), ...GRAB_AT },
  { at: s(52), x: (GRAB_AT.x + DROP_POINT.x) / 2, y: GRAB_AT.y - 26 },
  { at: s(CLICK_DROP - 6), ...DROP_POINT },
  { at: s(CLICK_DROP + 10), ...DROP_POINT },
  { at: s(115), x: 1240, y: 980 },
];

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Scene-local state: a pure function of the frame. */
export function boardState(frame: number, fps: number, social = false) {
  const dropped = frame >= DROP_AT;
  const dragging = frame >= CLICK_PRESS && frame < SWAP_AT + SWAP;
  const cursor = cursorAt(frame, fps, CURSOR);
  // The column under the cursor shows the app's own `over` look (`.board-col-body.over`).
  const overInProgress =
    frame >= CLICK_PRESS && !dropped && cursor.x >= colX('in_progress') && cursor.x <= colX('in_progress') + COL_W;
  const lift = spring({ frame: frame - CLICK_PRESS, fps, config: { damping: 200 }, durationInFrames: 5 });
  const settle = spring({ frame: frame - DROP_AT, fps, config: { damping: 200 }, durationInFrames: SETTLE });
  /** The neighbours make room / close the gap as the card settles. */
  const shift = 1 - settle;
  // Floating card: top-left = cursor − grab offset (the card never jumps to the cursor tip); after
  // the drop it glides from where it was let go into the slot.
  const atDrop = cursorAt(DROP_AT, fps, CURSOR);
  const floatX = dropped ? interpolate(settle, [0, 1], [atDrop.x - GRAB.x, SLOT.x]) : cursor.x - GRAB.x;
  const floatY = dropped ? interpolate(settle, [0, 1], [atDrop.y - GRAB.y, SLOT.y]) : cursor.y - GRAB.y;
  /** 0 → 1: lifted look (scale 1.03, rotate 1.5°); back to 0 while settling. */
  const lifted = dropped ? 1 - settle : lift;
  const swap = interpolate(frame, [SWAP_AT, SWAP_AT + SWAP], [0, 1], clamp);
  return {
    cursor,
    columns: dropped ? COLUMNS_AFTER : COLUMNS_BEFORE,
    ghostId: frame >= CLICK_PRESS && !dropped ? HERO_ID : undefined,
    overStatus: overInProgress ? ('in_progress' as const) : undefined,
    hoverId: frame >= CLICK_PRESS - 8 && frame < CLICK_PRESS ? HERO_ID : undefined,
    rowStyle: (status: WorkOrderStatus, index: number, id: string): CSSProperties | undefined => {
      if (!dropped) return undefined;
      // The hero's own card waits under the floating one and shows once it has settled (the floating
      // card then fades out on top of it — no double-transparent dip).
      if (id === HERO_ID) return frame < SWAP_AT ? { opacity: 0 } : undefined;
      if (shift <= 0) return undefined;
      // «Запланирована» closes the hero's gap; «В работе» moves down by one slot.
      if (status === 'scheduled') return { transform: `translateY(${SLOT_STEP * shift}px)` };
      if (status === 'in_progress' && index > 0) return { transform: `translateY(${-SLOT_STEP * shift}px)` };
      return undefined;
    },
    float: dragging
      ? {
          wo: dropped ? HERO_AFTER : HERO_BEFORE,
          x: floatX,
          y: floatY,
          scale: 1 + 0.03 * lifted,
          rotate: 1.5 * lifted,
          opacity: 1 - swap,
        }
      : null,
    // Social holds on two columns: no pan.
    scroll: social ? 0 : interpolate(frame, [PAN_FROM, PAN_TO], [0, PAN], {
      ...clamp,
      // The camera's own curve (kit/math CAM_EASE), so the pan and the camera slide move as one.
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    }),
  };
}

const noop = () => {};

/** The CRM window at a given state (no camera) — also what the coordinates above were measured on. */
export function BoardWindow({
  theme,
  brandName,
  state,
  overlays,
}: {
  theme: 'light' | 'dark';
  brandName: string;
  state: ReturnType<typeof boardState>;
  /** The shell's overlay slot (the Search scene opens the ⌘K palette over the board). */
  overlays?: ReactNode;
}) {
  const { float } = state;
  // rowStyle is per column position; resolve the column from the id.
  const statusOf = new Map(STATUS_ORDER.flatMap((s) => state.columns[s].map((w) => [w.id, s] as const)));
  // Scope the per-frame pan rule to this window: two live BoardWindows (a loop's cross-fade, the
  // board → search fade) must not pan each other through one global selector.
  const panId = useId();
  return (
    <AppWindow theme={theme} route="/board">
      {/* The board's horizontal pan (the app's grab-pan scrolls `.board`). Chrome measures a scrollLeft
          set here but the still doesn't paint it, so the columns slide by the same amount inside the
          `.board` clip instead — the same picture. */}
      <style>{`[data-board-pan="${panId}"] .board-col { transform: translateX(${-state.scroll}px); }`}</style>
      <div data-demo="board-pan" data-board-pan={panId} style={{ display: 'contents' }}>
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
          overlays={overlays}
        >
          <BoardView
            columns={state.columns}
            showMaster
            activeId={null}
            overStatus={state.overStatus}
            ghostId={state.ghostId}
            hoverId={state.hoverId}
            rowStyle={(i, id) => state.rowStyle(statusOf.get(id)!, i, id) ?? {}}
            onOpen={noop}
            onDragStart={noop}
            onDragEnd={noop}
          />
        </AppShellView>
      </div>
      {float && float.opacity > 0 ? (
        // The app's DragOverlay: a `BoardCard dragging` (its CSS: shadow-lg, primary border, rotate
        // 1.5°) of the source card's size. The wrapper adds the lift scale and, while the card lifts
        // or settles, counter-rotates so the tilt eases in and out instead of snapping.
        <div
          data-demo="board-drag-overlay"
          style={{
            position: 'absolute',
            left: float.x,
            top: float.y,
            width: CARD.w,
            opacity: float.opacity,
            transform: `scale(${float.scale}) rotate(${float.rotate - 1.5}deg)`,
            transformOrigin: `${GRAB.x}px ${GRAB.y}px`,
            zIndex: 20,
          }}
        >
          <BoardCard wo={float.wo} showMaster dragging />
        </div>
      ) : null}
    </AppWindow>
  );
}

// ---- camera (seconds, UI px at frame centre) ----
// START 1.75× (view 1097×617 UI px): x 258–1355 from the gap between the sidebar and «Запланирована»
// across «В работе» to the callout right of it; y 75–692 shows the page title, the column heads and
// three card rows and ends inside the 8-px gap under the 3rd row (689–697).
// From 90 the board pans by 116 while the camera slides right and pushes in a little, so the columns
// pass one pitch to the left. FINAL 1.908× (view 1006×566): y 130–696 — below the page subtitle (it
// doesn't pan, the frame edge would cut it) down to the row-4 gap; x 402.5–1408.7 — from the gap left
// of «В работе» (the hero now on top of it, column border at 404) to past the right edge of «Выдана»'s
// cards (1407; only that column's 9-px padding and border are outside). Every card in view is whole.
const START = { x: 806.5, y: 383.5, zoom: 1.75 };
const FINAL = { x: 905.6, y: 413, zoom: 1080 / 566 };
// SOCIAL (stage 1080×970 between the bands): two columns, held. 2.1× (view 514×462 UI px): x 257–771 —
// «Запланирована» (264) and «В работе» (to 764) whole, clear of the sidebar (240) and of «Ожидание»
// (776); y 65–527 — the page title (81) and subtitle, the column heads, two card rows (to 526), above the
// third (534). The drag and the drop happen inside it; the board doesn't pan (boardState(…, social)).
export const SOCIAL_ZONE = { x: COL_X0, y: 81, w: COL_PITCH + COL_W, h: CARD.y + SLOT_STEP * 2 - 8 - 81 };
const SOCIAL_TWO_COLS = { x: COL_X0 + (COL_PITCH + COL_W) / 2, y: 296, zoom: 2.1 };
export const CAM: { wide: CamKey[]; social: CamKey[] } = {
  wide: [
    { at: 0, ...START },
    { at: s(PAN_FROM), ...START },
    { at: s(PAN_TO), ...FINAL },
  ],
  social: [{ at: 0, ...SOCIAL_TWO_COLS }],
};

/** 1 → 0 over `dur` frames from `from` (the callout has no exit of its own). */
const fadeOut = (frame: number, from: number, dur = 6) => interpolate(frame, [from, from + dur], [1, 0], clamp);

/**
 * Board (150 f): the hero order on top of «Запланирована» → press (30): the card lifts out as the
 * app's drag overlay, the source stays as a ghost → carried to «В работе» (its column lights up
 * `over`), callout (60) → drop (75; effects 78): counters 46→45 / 4→5, the card settles into the
 * slot and the neighbours make room → 90–150 the board pans across «Ожидание», «Готова», «Выдана».
 */
export function BoardScene({ theme, brand, callouts, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = boardState(frame, fps, social);
  const calloutOpacity = fadeOut(frame, CALLOUT_OUT);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={social ? CAM.social : CAM.wide}>
        <BoardWindow theme={theme} brandName={brand.name} state={state} />
        {calloutOpacity > 0 ? (
          <div style={{ position: 'absolute', left: 0, top: 0, opacity: calloutOpacity, zIndex: 90 }}>
            {/* Wide: dot just above «В работе»'s counter, pill to its right in the empty band between
                the page subtitle (ends at x 680) and the column heads (from y 155): it covers no column
                head, no card, neither the dragged card nor the target slot. Social: the bottom plaque. */}
            <Callout text={callouts.board} at={CALLOUT_AT} anchor={CALLOUT_ANCHOR} side="right" accent={accent} />
          </div>
        ) : null}
        <Cursor path={CURSOR} clicks={SCENE_CLICKS.board} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}
