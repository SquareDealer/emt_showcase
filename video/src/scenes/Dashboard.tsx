import { AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AppShellView } from '@crm/components/AppShellView';
import { DashboardView } from '@crm/features/dashboard/DashboardView';
import type { DashboardData } from '@crm/features/dashboard/types';
import { navForRole } from '@crm/lib/view-helpers';
import type { Brand } from '@crm/lib/brand';
import { dashboard, users } from '../fixtures';
import type { ShowcaseProps } from '../schema';
import { AppWindow } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { SceneTitles, type TitleCue } from '../kit/SceneTitles';
import { countUp, type CamKey } from '../kit/math';
import { useLayout } from '../kit/useLayout';
import { FPS } from '../timing';

// ---------------------------------------------------------------------------------------------
// Target geometry, UI pixels of the 1440×900 AppWindow (top-left = 0,0). Measured from the
// rendered DOM: a throwaway composition rendered DashboardWindow at zoom 1 in its rest state
// (frame 149), waited for document.fonts.ready and printed getBoundingClientRect() of each node
// minus the `.crm-root` rect into the PNG.
//   HEAD     `.dash-head` 274,81 h 27.5 (to 108.5); topbar 0–57, sidebar 0–240.
//   KPIS     `.dash-kpi` y 132.5–245.7, x 274–640.7 / 656.7–1023.4 / 1039.3–1406; values y 173–205,
//            the delta line y 209–228.7.
//   REVENUE  `[data-demo="revenue"]` x 274–960.8, y 269.7–876; title y 286.7–305.5; plot x 299–935.8,
//            y 345.4–805.5 (top gridline at 371.4 = October's bar top); ticks to 833; note y 841–859.
//            Value labels (h 19.5): Jun x 317 y 501.3, Jul 423 / 486.4, Aug 529.2 / 480, Sep 635.3–705.5 /
//            463.3, Oct 741.5–811.7 / 345.9, Nov 855.4 / 559.4. Bars x 321.3 + 106.1·i, w 61.6; Oct from 745.8.
//   LOAD     `[data-demo="load"]` x 976.8–1406, y 269.7–459; rows y 317.4 / 362.9 / 408.4 (h 33.5), the
//            numbers end at x 1381.
//   TOP      `[data-demo="top"]` x 976.8–1406, y 474.9–876; title 491.9; rows y 534.8 + 69.7·k (h 33.5);
//            names from x 1001.8.
// Camera views were checked against an ink mask of the rest frame (a script over the zoom-1 PNG): no
// view edge crosses a line of text; only bar bodies are cropped (the load view's bottom edge).
// ---------------------------------------------------------------------------------------------

/** Bars, load and top bars grow and the KPIs count up over 0–GROW (spring). */
export const GROW = 45;
/** `highlight='revenue'` from REVENUE_AT, `highlight='load'` from the load beat to the end: wide
 *  LOAD_AT (after chapter 07 has gone), social SOCIAL_LOAD_AT (the title is in the band there). */
export const REVENUE_AT = 45;
export const LOAD_AT = 150;
export const SOCIAL_LOAD_AT = 90;
export const loadAt = (social: boolean) => (social ? SOCIAL_LOAD_AT : LOAD_AT);
/** Chapter 07. Wide: in as the camera settles on the revenue chart (framed above the slate), out as it
 *  moves on to the load. Social (the bottom band): from 30, out before the transition (150). */
export const TITLES: readonly TitleCue[] = [{ key: 'dashboard', at: 45, out: 150 }];
export const SOCIAL_TITLES: readonly TitleCue[] = [{ key: 'dashboard', at: 30, out: 135 }];

const brandFor = (name: string): Brand => ({
  name,
  logoLight: staticFile('brand/garage-crm-logo-light-sidebar.png'),
  logoDark: staticFile('brand/garage-crm-logo-dark-sidebar.png'),
});

const owner = users.find((u) => u.role === 'owner');
if (!owner) throw new Error('fixtures/users.json: no owner');

// ---- data (fixtures only): the geometry above was measured on this shape ----
/** The plot (y 345.4–805.5): the view's scale tops out at 1.06 × the highest month. */
const PLOT_BOTTOM = 805.5;
const PLOT_H = 460.1;
const LABEL_H = 19.5;
const LABEL_GAP = 6;
/** Top edge (window px) of a month's value label — DashboardView's `bottom: calc(h% + 6px)`. */
export const labelTop = (v: number, max: number) => PLOT_BOTTOM - (v / (max * 1.06)) * PLOT_H - LABEL_GAP - LABEL_H;
{
  const rev = dashboard.revenueByMonth.map((m) => m.revenue);
  if (rev.length !== 6 || !dashboard.partialLast) throw new Error('Dashboard: expected 6 months with the current one partial — re-measure');
  if (dashboard.masterLoad.length !== 3 || dashboard.topWorks.length !== 5) throw new Error('Dashboard: 3 masters / 5 top works expected — re-measure');
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const s = (f: number) => f / FPS;

/** Scene-local state: a pure function of the frame. Social: no 'revenue' ring — the chart shot crops the
 *  panel's sides, the ring would show as two stray stripes; the camera carries the emphasis. The load
 *  panel is whole in its shot, so 'load' stays. */
export function dashboardState(frame: number, fps: number, social = false) {
  // Exactly 1 from GROW on: the numbers at rest are the fixture's, not a spring's 0.9999.
  const progress = frame >= GROW ? 1 : spring({ frame, fps, config: { damping: 200 }, durationInFrames: GROW });
  // The KPIs follow the bars' curve: kit countUp over a virtual frame GROW·progress (exact at GROW).
  const count = (to: number) => countUp(GROW * progress, 0, GROW, 0, to);
  const k = dashboard.kpi;
  const data: DashboardData = {
    ...dashboard,
    kpi: {
      ...k,
      revenue: count(k.revenue),
      orders: Math.round(count(k.orders)),
      avgTicket: Math.round(count(k.avgTicket)),
    },
  };
  const highlight: 'revenue' | 'load' | undefined =
    frame >= loadAt(social) ? 'load' : frame >= REVENUE_AT && !social ? 'revenue' : undefined;
  return { progress, data, highlight };
}

const noop = () => {};

/** The CRM window at a given state (no camera) — also what the coordinates above were measured on. */
export function DashboardWindow({
  theme,
  brandName,
  deltaLabel,
  state,
}: {
  theme: 'light' | 'dark';
  brandName: string;
  deltaLabel: string;
  state: ReturnType<typeof dashboardState>;
}) {
  // The dashboard is video-only and has no route in the CRM: a route that matches no nav item.
  return (
    <AppWindow theme={theme} route="/overview">
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
        <DashboardView data={state.data} progress={state.progress} highlight={state.highlight} deltaLabel={deltaLabel} />
      </AppShellView>
    </AppWindow>
  );
}

// ---- camera (seconds, UI px at frame centre) ----
// WIDE. OVERVIEW 1.15× — the whole window with a margin, while the KPIs count up and the bars grow.
// REVENUE 1.45× (view 1324×745): x 116–1440 — the revenue panel on the left and the right column to the
// window's edge; y 246–991 — under the KPI cards (end 245.7), the whole panel (269.7–876 → frame
// 35–916) above the chapter slate (frame y ≥ 924); the window's bottom edge (frame 948) shows over the
// backdrop right of the slate.
// LOAD 2.32× (view 828×466): x 608–1436 — between August's and September's labels (599.4 | 635.3) to the
// window's edge, the load panel with its margin; y 120–585.5 — the KPI cards whole (the first one cut in
// its empty right part), the load panel, the top works' title and first row; the edge under it crops
// only bar bodies (Sep–Nov).
const OVERVIEW = { x: 720, y: 450, zoom: 1.15 };
const REVENUE = { x: 1440 - 960 / 1.45, y: 877 - 375 / 1.45, zoom: 1.45 };
const LOAD = { x: 1022, y: 352.75, zoom: 2.32 };
// SOCIAL (stage 1080×970 between the bands), one zone at a time:
//   KPI   1.7 (view 635×571): x 273.4–908.6 — the revenue card whole (274–640.7) counting up, the orders
//         card's figure; y 130.7–701 — the KPI row (from 132.5) and the bars growing under it.
//   CHART 1.7 from 45 by 60, held to 75: x 299.7–935 — the plot (Jun's label from 317 to Nov's), the panel's own
//         padding cut; y 267.4–838 — the panel's top and title (286.7) to the month ticks (833); the
//         footnote (841) wholly under the edge.
//   LOAD  2.38 from 75 by 90 (its ring springs in from 90), held to the fade into the outro (105–120 in
//         the social cut's 120 frames) (view 454×408): x 964.6–1418.4 — the right column, clear of the revenue
//         panel (960.8); y 262–669.6 — the load panel whole, the top works' title and first two rows.
export const SOCIAL_ZONES = {
  kpi: { x: 274, y: 132.5, w: 366.7, h: 113.2 },
  chart: { x: 317, y: 286.7, w: 603, h: 833 - 286.7 },
  load: { x: 976.8, y: 269.7, w: 1406 - 976.8, h: 459 - 269.7 },
};
const SOCIAL_KPI = { x: 591, y: 416, zoom: 1.7 };
const SOCIAL_CHART = { x: 617.4, y: 552.7, zoom: 1.7 };
const SOCIAL_LOAD = { x: 1191.5, y: 465.8, zoom: 2.38 };
/** Each move takes MOVE frames from its beat (45, 90). */
export const MOVE = 20;
const keysThrough = ([a, b, c]: { x: number; y: number; zoom: number }[]): CamKey[] => [
  { at: 0, ...a },
  { at: s(REVENUE_AT), ...a },
  { at: s(REVENUE_AT + MOVE), ...b },
  { at: s(LOAD_AT), ...b },
  { at: s(LOAD_AT + MOVE), ...c },
];
/** Social moves take a beat each, on the beat (chart 45→60, load 75→90), so every settled shot holds
 *  a beat in the social cut's 120 frames: the chart 60–75, the load 90–105 (then the fade). */
export const SOCIAL_MOVE = 15;
export const SOCIAL_LOAD_FROM = SOCIAL_LOAD_AT - SOCIAL_MOVE;
export const CAM: { wide: CamKey[]; social: CamKey[] } = {
  wide: keysThrough([OVERVIEW, REVENUE, LOAD]),
  social: [
    { at: 0, ...SOCIAL_KPI },
    { at: s(REVENUE_AT), ...SOCIAL_KPI },
    { at: s(REVENUE_AT + SOCIAL_MOVE), ...SOCIAL_CHART },
    { at: s(SOCIAL_LOAD_FROM), ...SOCIAL_CHART },
    { at: s(SOCIAL_LOAD_AT), ...SOCIAL_LOAD },
  ],
};

/**
 * Dashboard (wide 210 f, social 180): the owner's overview for the last full month — the bars, load and
 * top works grow and the KPIs count up 0–45 → camera on the revenue chart (45, ring), chapter 07
 * (45–150) → camera on the masters' load (150, ring), held to the transition (180). Social: chart 45–60,
 * load 75–90, title 30–135 in the band.
 */
export function DashboardScene({ theme, brand, chapters, accent, dashboardDeltaLabel }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';
  const state = dashboardState(frame, fps, social);
  return (
    <AbsoluteFill>
      <Background theme={theme} captionBand />
      <Camera keys={social ? CAM.social : CAM.wide}>
        <DashboardWindow theme={theme} brandName={brand.name} deltaLabel={dashboardDeltaLabel} state={state} />
      </Camera>
      <SceneTitles cues={social ? SOCIAL_TITLES : TITLES} chapters={chapters} accent={accent} />
    </AbsoluteFill>
  );
}
