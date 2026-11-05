import type { ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { VideoProviders } from '../providers/VideoProviders';
import type { ShowcaseProps } from '../schema';
import { APP_H, APP_W } from '../kit/AppWindow';
import { Background } from '../kit/Background';
import { BrandMark } from '../kit/BrandMark';
import { PhoneFrame } from '../kit/PhoneFrame';
import { EstimateWindow, TOTAL_TO, estimateState } from '../scenes/Estimate';
import { BoardWindow, boardState } from '../scenes/Board';
import { FPS } from '../timing';

// Stills (one frame each, `npm run render:stills`): the cover, the OG card and two README
// screenshots. No captions, cursor or rings — the CRM's own views at a settled state of the hero
// story, from the same fixtures (seed data only).

/** Estimate after the story: the block applied, kit line −10 %, order −5 %, total 40 764,50 ₽ —
 *  wo-hero.3 as saved (no draft over the discount form, no demo outline on the kit row). */
const ESTIMATE = { ...estimateState(TOTAL_TO, FPS), highlightLine: undefined, discountDraft: undefined };
/** Board after the drag: the hero order on top of «В работе», settled, not panned (the app's own
 *  view at 1440 px: the fifth column «Выдана» runs past the page edge, as it does in the browser). */
const BOARD = { ...boardState(149, FPS), scroll: 0 };

export const STILLS = {
  Cover: { width: 1920, height: 1080 },
  OG: { width: 1200, height: 630 },
  ReadmeEstimate: { width: 1600, height: 1000 },
  ReadmeBoard: { width: 1600, height: 1000 },
} as const;

/** 1600×1000: the 1440×900 window at full scale, centred on the theme's backdrop. */
function ReadmeFrame({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <VideoProviders theme={theme}>
      <Background theme={theme} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</AbsoluteFill>
    </VideoProviders>
  );
}

export const ReadmeEstimate = ({ theme, brand }: ShowcaseProps) => (
  <ReadmeFrame theme={theme}>
    <EstimateWindow theme={theme} brandName={brand.name} state={ESTIMATE} />
  </ReadmeFrame>
);

export const ReadmeBoard = ({ theme, brand }: ShowcaseProps) => (
  <ReadmeFrame theme={theme}>
    <BoardWindow theme={theme} brandName={brand.name} state={BOARD} />
  </ReadmeFrame>
);

/**
 * Cover 1920×1080 (rendered at --scale=2): the estimate window tilted in perspective — its right side,
 * the summary with «Итого», towards the viewer — the master's phone (the prerendered mobile board,
 * its frame 0) in front of the window's sidebar, the wordmark top-left above the phone.
 */
export const Cover = ({ theme, brand }: ShowcaseProps) => (
  <VideoProviders theme={theme}>
    <Background theme="dark" />
    <div style={{ position: 'absolute', left: 1860 - APP_W, top: 90, perspective: 2400 }}>
      <div style={{ transform: 'rotateY(-12deg) rotateX(5deg) scale(1.02)', transformOrigin: '100% 50%' }}>
        <EstimateWindow theme={theme} brandName={brand.name} state={ESTIMATE} />
      </div>
    </div>
    <div style={{ position: 'absolute', left: 110, top: 84 }}>
      <BrandMark name={brand.name} theme="dark" size={92} />
    </div>
    <div style={{ position: 'absolute', left: 230, top: 190 }}>
      <PhoneFrame src="prerender/mobile-master.mp4" scale={0.88} />
    </div>
  </VideoProviders>
);

/** OG 1200×630, readable at 600 px wide: wordmark + one-line pitch on the left, the estimate's
 *  summary card (discounts and «Итого») at 1.85× on the right. */
/** UI px of the estimate window: the summary card (x 1097–1416) centred with 13.5 px of page on each
 *  side (the parts panel ends at 1080), from under the divider above «Работы + запчасти» (y 420) to
 *  just past the «Оплачено» input (ends 702) — 346×281 UI px at 1.85 fill the 640×520 card. */
const OG_CROP = { x: 1083.5, y: 428, zoom: 1.85 };
const OG_PANEL_W = 500;
const OG_CARD = { left: OG_PANEL_W + 16, top: 55, width: 640, height: 520 };
export const OG = ({ theme, brand, callouts, accent }: ShowcaseProps) => (
  <VideoProviders theme={theme}>
    <Background theme="dark" />
    <div
      style={{
        position: 'absolute',
        left: 64,
        top: 0,
        bottom: 0,
        width: OG_PANEL_W - 64 - 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 34,
      }}
    >
      <BrandMark name={brand.name} theme="dark" size={78} />
      <div style={{ width: 96, height: 4, borderRadius: 2, background: accent }} />
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 40,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          color: 'rgba(255,255,255,0.94)',
          textWrap: 'balance',
        }}
      >
        {callouts.intro}
      </div>
    </div>
    <div
      style={{
        position: 'absolute',
        ...OG_CARD,
        overflow: 'hidden',
        borderRadius: 18,
        boxShadow: '0 0 0 1px rgb(0 0 0 / 0.2), 0 24px 48px -12px rgb(0 0 0 / 0.5)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: APP_W,
          height: APP_H,
          transformOrigin: '0 0',
          transform: `scale(${OG_CROP.zoom}) translate(${-OG_CROP.x}px, ${-OG_CROP.y}px)`,
        }}
      >
        <EstimateWindow theme={theme} brandName={brand.name} state={ESTIMATE} />
      </div>
    </div>
  </VideoProviders>
);
