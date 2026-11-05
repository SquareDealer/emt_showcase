import type { ReactNode } from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AppShellView } from '@crm/components/AppShellView';
import { PriceListView } from '@crm/features/price-list/PriceListView';
import { navForRole } from '@crm/lib/view-helpers';
import type { Brand } from '@crm/lib/brand';
import { generations, users, woHero } from '../fixtures';
import { VideoProviders } from '../providers/VideoProviders';
import type { ShowcaseProps } from '../schema';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Callout } from '../kit/Callout';
import { Camera } from '../kit/Camera';
import { Cursor } from '../kit/Cursor';
import { FakeSelect } from '../kit/FakeSelect';
import { Highlight } from '../kit/Highlight';
import { LoopCrossfade } from '../kit/LoopCrossfade';
import { PhoneFrame } from '../kit/PhoneFrame';
import { SCENE_CLICKS } from '../timing';
import {
  BookingWindow,
  CALLOUT_ANCHOR as BOOKING_CALLOUT_ANCHOR,
  CALLOUT_AT as BOOKING_CALLOUT_AT,
  CALLOUT_SIDE as BOOKING_CALLOUT_SIDE,
  bookingState,
} from '../scenes/Booking';
import {
  ADD_FROM_PRICE,
  APPLY_AT,
  APPLY_LABOR,
  BLOCK_ANCHOR,
  BLOCK_AT,
  DIALOG,
  EstimateWindow,
  GEN_AT,
  OPTION_WINDOW,
  PICK_AT,
  PICK_INDEX,
  estimateState,
  withDiscounts,
} from '../scenes/Estimate';
import { BoardWindow, CALLOUT_ANCHOR, CALLOUT_AT as BOARD_CALLOUT_AT } from '../scenes/Board';
import { LOOP_DEFS, type LoopId } from './loop-defs';
import {
  BOARD_LOOP,
  BOOKING_LOOP,
  DISCOUNTS_LOOP,
  ESTIMATE_LOOP,
  PL_CAPTION,
  PL_HIGHLIGHT,
  PL_PICKS,
  PL_SELECT,
  PRICE_LIST_LOOP,
  boardLoopState,
  gen,
  genOption,
  plRows,
} from './loops';

// The six feature loops (1600×1000). Timelines, cameras and cursor paths are pure (./loops, tested:
// every loop ends in its first frame's data, camera and cursor); this file only draws them with the
// scenes' own windows and the kit. Captions use the hero's texts and leave before the reset; every
// caption/ring wrapper takes its opacity from the loop's `overlays(t)` (the values the spec checks).

const noop = () => {};
const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});
const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

/** Opacity wrapper in stage coordinates for overlays without an exit of their own. */
function Fade({ opacity, z, children }: { opacity: number; z: number; children: ReactNode }) {
  if (opacity <= 0) return null;
  return <div style={{ position: 'absolute', left: 0, top: 0, opacity, zIndex: z }}>{children}</div>;
}

/** A second window over the first (the reset's dissolve); the windows are in flow, so pin it at 0,0. */
function Over({ opacity, children }: { opacity: number; children: ReactNode }) {
  if (opacity <= 0) return null;
  return <div style={{ position: 'absolute', left: 0, top: 0, opacity, zIndex: 95 }}>{children}</div>;
}

function Loop({ id, theme, children }: { id: LoopId; theme: 'light' | 'dark'; children: ReactNode }) {
  const def = LOOP_DEFS.find((d) => d.id === id)!;
  return (
    <VideoProviders theme={theme}>
      <LoopCrossfade durationInFrames={def.dur} overlap={def.overlap}>
        {children}
      </LoopCrossfade>
    </VideoProviders>
  );
}

// ---- Booking ----
function BookingClip({ theme, brand, callouts, accent }: ShowcaseProps) {
  const t = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = BOOKING_LOOP.frame(t);
  const base = { ...bookingState(f.scene, fps), scroll: f.scroll };
  // The reset: the landed order fades out (its outline goes first), the week is back as at frame 0.
  const state =
    f.heroFade < 1
      ? {
          ...base,
          highlight: false,
          heroStyle: base.heroStyle ? { ...base.heroStyle, opacity: base.heroStyle.opacity * f.heroFade } : undefined,
        }
      : base;
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={BOOKING_LOOP.cam}>
        <BookingWindow theme={theme} brandName={brand.name} state={state} />
        <Fade opacity={BOOKING_LOOP.overlays(t).caption} z={90}>
          {/* The Booking scene's placement: right of the slot, clear of the ghost, the menu and the order. */}
          <Callout text={callouts.booking} at={BOOKING_CALLOUT_AT} anchor={BOOKING_CALLOUT_ANCHOR} side={BOOKING_CALLOUT_SIDE} accent={accent} />
        </Fade>
        <Cursor path={BOOKING_LOOP.cursor} clicks={BOOKING_LOOP.clicks} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}

// ---- Estimate ----
function EstimateClip({ theme, brand, callouts, accent }: ShowcaseProps) {
  const t = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = ESTIMATE_LOOP.frame(t);
  const state = estimateState(f.scene, fps);
  const o = ESTIMATE_LOOP.overlays(t);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={ESTIMATE_LOOP.cam}>
        {/* Keyed by snapshot: the view's own form state starts from each order, whatever frame a
            render tab drew before. */}
        <EstimateWindow key={f.scene >= APPLY_AT ? 'wo1' : 'wo0'} theme={theme} brandName={brand.name} state={state} />
        <Over opacity={f.reset}>
          <EstimateWindow key="reset" theme={theme} brandName={brand.name} state={estimateState(0, fps)} />
        </Over>
        {/* The Estimate scene's wide overlays, same frames (the loop plays the scene from 0). */}
        {state.showSelect ? (
          <FakeSelect
            rect={ADD_FROM_PRICE}
            options={OPTION_WINDOW}
            openAt={SCENE_CLICKS.estimate[0]}
            pickIndex={PICK_INDEX}
            pickAt={PICK_AT}
            placeholder="+ Из прайса…"
          />
        ) : null}
        <Fade opacity={o.ring} z={50}>
          <Highlight rect={APPLY_LABOR} appearAt={GEN_AT} accent={accent} />
        </Fade>
        <Fade opacity={o.generation} z={90}>
          <Callout
            text={callouts.generation}
            at={GEN_AT}
            anchor={{ x: APPLY_LABOR.x + APPLY_LABOR.w, y: APPLY_LABOR.y + APPLY_LABOR.h / 2 }}
            side="right"
            accent={accent}
          />
        </Fade>
        <Fade opacity={o.blockSheet} z={90}>
          <Callout text={callouts.block} at={BLOCK_AT} anchor={{ x: DIALOG.x + DIALOG.w / 2, y: DIALOG.y }} side="top" accent={accent} />
        </Fade>
        <Fade opacity={o.blockLine} z={90}>
          <Callout text={callouts.block} at={APPLY_AT} anchor={BLOCK_ANCHOR} side="bottom" accent={accent} />
        </Fade>
        <Cursor path={ESTIMATE_LOOP.cursor} clicks={ESTIMATE_LOOP.clicks} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}

// ---- Discounts ----
function DiscountsClip({ theme, brand, accent }: ShowcaseProps) {
  const t = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = DISCOUNTS_LOOP.frame(t);
  // estimateState(0): no sheet, no select, no toast, no row animation — the order is the discount
  // sequence's (withDiscounts, exactly what the Estimate scene draws from its frame 195).
  const quiet = estimateState(0, fps);
  const state = withDiscounts(quiet, f);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={DISCOUNTS_LOOP.cam}>
        <EstimateWindow key={state.windowKey} theme={theme} brandName={brand.name} state={state} />
        <Over opacity={f.reset}>
          <EstimateWindow key="reset" theme={theme} brandName={brand.name} state={{ ...quiet, wo: woHero[1] }} />
        </Over>
        <Cursor path={DISCOUNTS_LOOP.cursor} clicks={DISCOUNTS_LOOP.clicks} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}

// ---- Price list ----
/** Dot just above the «Итого по прайсу» column head (x 1160–1259, y 229–264); the pill rises into
 *  the empty right half of the page bar, clear of the select, the counter and «Скопировать из…». */
const PL_CAPTION_ANCHOR = { x: 1212, y: 224 };

function PriceListClip({ theme, brand, callouts, accent }: ShowcaseProps) {
  const t = useCurrentFrame();
  const f = PRICE_LIST_LOOP.frame(t);
  const rows = plRows(f);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={PRICE_LIST_LOOP.cam}>
        <AppWindow theme={theme} route="/price-list">
          <AppShellView
            userName={owner!.name}
            nav={navForRole('owner')}
            theme={theme}
            drawerOpen={false}
            brand={brandFor(brand.name)}
            onOpenSearch={noop}
            onNewIntake={noop}
            onToggleTheme={noop}
            onLogout={noop}
            onOpenDrawer={noop}
            onCloseDrawer={noop}
          >
            {/* Keyed by generation: the rows' inputs start from that generation's overrides, as
                after the app's refetch. */}
            <PriceListView
              key={f.gen}
              tab="works"
              generations={generations}
              generationId={gen(f.gen).id}
              rows={rows}
              withOverride={rows.filter((r) => r.override).length}
              highlightTemplateId={f.highlight ? PL_HIGHLIGHT : undefined}
              onTab={noop}
              onGeneration={noop}
              onSave={noop}
              onClear={noop}
              onEditParts={noop}
              onCopy={noop}
            />
          </AppShellView>
        </AppWindow>
        {PL_PICKS.map((p) =>
          t >= p.open && t < p.at ? (
            <FakeSelect
              key={p.open}
              rect={PL_SELECT}
              options={p.options}
              openAt={p.open}
              pickIndex={p.pickIndex}
              pickAt={p.at}
              value={genOption(gen(p.from))}
            />
          ) : null,
        )}
        <Fade opacity={PRICE_LIST_LOOP.overlays(t).caption} z={90}>
          <Callout text={callouts.generation} at={PL_CAPTION} anchor={PL_CAPTION_ANCHOR} side="top" accent={accent} />
        </Fade>
        <Cursor path={PRICE_LIST_LOOP.cursor} clicks={PRICE_LIST_LOOP.clicks} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}

// ---- Board ----
function BoardClip({ theme, brand, callouts, accent }: ShowcaseProps) {
  const t = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = boardLoopState(BOARD_LOOP.frame(t), fps);
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <Camera keys={BOARD_LOOP.cam}>
        <BoardWindow theme={theme} brandName={brand.name} state={state} />
        <Fade opacity={BOARD_LOOP.overlays(t).caption} z={90}>
          <Callout text={callouts.board} at={BOARD_CALLOUT_AT} anchor={CALLOUT_ANCHOR} side="right" accent={accent} />
        </Fade>
        <Cursor path={BOARD_LOOP.cursor} clicks={BOARD_LOOP.clicks} accent={accent} />
      </Camera>
    </AbsoluteFill>
  );
}

// ---- Master on the phone ----
function MasterMobileClip({ theme }: ShowcaseProps) {
  return (
    <AbsoluteFill>
      <Background theme={theme} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* 418×872 with the bezel (×1.1: 959 px of the 1000); its 180-frame clip ends on its first frame. */}
        <PhoneFrame src="prerender/mobile-master.mp4" scale={1.1} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const LoopBooking = (p: ShowcaseProps) => (
  <Loop id="LoopBooking" theme={p.theme}>
    <BookingClip {...p} />
  </Loop>
);
export const LoopEstimate = (p: ShowcaseProps) => (
  <Loop id="LoopEstimate" theme={p.theme}>
    <EstimateClip {...p} />
  </Loop>
);
export const LoopDiscounts = (p: ShowcaseProps) => (
  <Loop id="LoopDiscounts" theme={p.theme}>
    <DiscountsClip {...p} />
  </Loop>
);
export const LoopPriceList = (p: ShowcaseProps) => (
  <Loop id="LoopPriceList" theme={p.theme}>
    <PriceListClip {...p} />
  </Loop>
);
export const LoopBoard = (p: ShowcaseProps) => (
  <Loop id="LoopBoard" theme={p.theme}>
    <BoardClip {...p} />
  </Loop>
);
export const LoopMasterMobile = (p: ShowcaseProps) => (
  <Loop id="LoopMasterMobile" theme={p.theme}>
    <MasterMobileClip {...p} />
  </Loop>
);
