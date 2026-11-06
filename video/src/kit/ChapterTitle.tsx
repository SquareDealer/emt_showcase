import type { CSSProperties, ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SOCIAL_FRAME } from './math';
import { ACCENT, PLAQUE_BG } from './tokens';
import { useLayout } from './useLayout';

// ---------------------------------------------------------------------------------------------
// Chapter titles («титр главы»): one fixed slate per chapter instead of a pill pointing at the UI.
// Wide (hero, loops): a square dark-ink slab flush to the frame's bottom-left corner — the brass index
// «01 / 07» (mono, tabular) and a short brass hairline beside the title (a side column, not a kicker
// above it), the title in Inter 600, one quieter line under it. Social: the same grid in the frame's
// bottom band (SOCIAL_FRAME.captionH), larger for a 50 % feed preview. The slate is drawn outside the
// scene's Camera, so it never moves with the UI; scenes frame their subject above it while it shows.
// Everything is a pure function of the frame: titleState() below is what the component draws.
// ---------------------------------------------------------------------------------------------

/** The CRM's dark ink for the slate (the social bands use the same). */
export const SLATE_BG = PLAQUE_BG;
/** Title and second line on the slate: dark-theme ink and a lighter muted (≥ 7:1 on SLATE_BG). */
export const TITLE_INK = 'oklch(0.97 0.004 240)';
export const LINE_INK = 'oklch(0.78 0.012 240)';

/** Wide type sizes at 1080 px frame height (loops scale by height). */
export const WIDE_TYPE = { index: 20, title: 44, line: 22 } as const;
/** Social type sizes (px on the 1080×1350 frame; ≥ 52 / ≥ 30 for a 50 % preview). */
export const SOCIAL_TYPE = { index: 26, title: 54, line: 30 } as const;
/**
 * Wide slate height at 1080 px (measured on full-scale stills: its top edge at y 925–926) and the frame
 * y above which a wide title never draws: scenes keep their subject above this line, or right of the
 * slate, while a title shows (scene specs check it).
 */
export const SLATE_H = 156;
export const SLATE_TOP = 1080 - SLATE_H;
/** The slate's width at 1080 px is content-sized; the widest (docs) measured 1105 px on a full-scale
 *  still. Scenes keep a subject that sits low in the frame right of this x while a title shows. */
export const SLATE_W_MAX = 1110;

/** Frames from `at` until every line is in (fully readable), and from `out` until the slate is gone. */
export const TITLE_IN = 23;
export const TITLE_OUT = 12;
/** A title is held readable at least this long (2.5 s at 30 fps). */
export const MIN_HOLD = 75;

const EASE_IN = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_OUT = Easing.in(Easing.quad);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 → 1 (soft ease-out) over [from, from + dur], then back to 0 (ease-in) over [back, back + bdur]. */
const reveal = (f: number, from: number, dur: number, back: number, bdur: number) =>
  Math.min(
    interpolate(f, [from, from + dur], [0, 1], { ...clamp, easing: EASE_IN }),
    interpolate(f, [back, back + bdur], [1, 0], { ...clamp, easing: EASE_OUT }),
  );

/**
 * The slate at frame `f` for a title in at `at` and out at `out` (scene-local frames): the panel's
 * wipe from the left edge, then the index row, the title and the second line rising from their masks;
 * the exit reverses it faster (text drops first, the panel retracts to the edge). 0 = hidden, 1 = in.
 */
export function titleState(f: number, at: number, out: number) {
  return {
    panel: reveal(f, at, 12, out + 3, 9),
    marker: reveal(f, at + 3, 14, out + 2, 7),
    title: reveal(f, at + 5, 14, out, 8),
    line: reveal(f, at + 9, 14, out, 8),
  };
}

/** Drawn at all (anything of the slate visible). */
export const titleVisible = (f: number, at: number, out: number) => f >= at && f < out + TITLE_OUT;
/** Every line fully in. */
export const titleReadable = (f: number, at: number, out: number) => {
  const s = titleState(f, at, out);
  return s.panel === 1 && s.marker === 1 && s.title === 1 && s.line === 1;
};

/** Line breaks for wrapped (social) titles: a dash or an arrow never starts a line; a short
 *  preposition/conjunction or a number never ends one («по VIN», «в 2 клика», «из тех же»). */
export const titleText = (text: string) =>
  text
    .replace(/ (—|→)/g, ' $1')
    .replace(/(?<=^|[\s ])(в|к|с|у|о|и|а|по|до|за|на|из|от|во|со|не|об|\d+) /giu, '$1 ');

/** «01 / 07»: the chapter's place in its cut. */
export const indexLabel = (n: number, total: number) => `${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;

/** A line that rises from under its own bottom edge (the mask): p 0 → below, 1 → in place. */
function Mask({ p, children, style }: { p: number; children: ReactNode; style?: CSSProperties }) {
  return (
    // Clipped at the bottom only, so ascenders and accents (Й, Ё) are never cut while the line rises.
    <div style={{ clipPath: 'inset(-0.5em -0.3em 0 -0.3em)', ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 110}%)`, opacity: p > 0 ? 1 : 0 }}>{children}</div>
    </div>
  );
}

export type ChapterCopy = { title: string; line: string };

/**
 * A chapter title, frame-fixed (place it outside the scene's Camera). `index` is the chapter's place in
 * the cut (hero «01 / 07», social «01 / 06»); without it (the feature loops) only the hairline marks
 * the slate. `at`/`out` are scene-local frames: in on `at` (a beat), readable from at + TITLE_IN, out
 * from `out`, gone at out + TITLE_OUT.
 */
export function ChapterTitle({
  copy,
  index,
  at,
  out,
  accent = ACCENT,
}: {
  copy: ChapterCopy;
  index?: { n: number; total: number };
  at: number;
  out: number;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const social = useLayout() === 'social';
  if (!titleVisible(frame, at, out)) return null;
  const s = titleState(frame, at, out);
  const u = social ? 1 : height / 1080;
  const type = social ? SOCIAL_TYPE : WIDE_TYPE;
  const titleLh = social ? 1.14 : 1.25;
  const marker = (
    // Level with the title's first line (its line box's middle), however many lines the title takes.
    <Mask p={s.marker} style={{ gridColumn: 1, gridRow: 1, marginTop: ((type.title * titleLh - type.index) / 2) * u }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 * u, whiteSpace: 'nowrap' }}>
        {index ? (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
              fontSize: type.index * u,
              lineHeight: 1,
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
              color: accent,
            }}
          >
            {indexLabel(index.n, index.total)}
          </span>
        ) : null}
        <span
          style={{
            width: 28 * u,
            height: 2 * u,
            background: accent,
            transform: `scaleX(${s.marker})`,
            transformOrigin: '0 50%',
          }}
        />
      </div>
    </Mask>
  );
  const grid = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto auto',
        columnGap: 22 * u,
        rowGap: (social ? 10 : 6) * u,
        // The index row sits on the title's first line (beside it, not a kicker above it).
        alignItems: 'start',
        justifyContent: 'start',
      }}
    >
      {marker}
      <Mask p={s.title} style={{ gridColumn: 2, gridRow: 1 }}>
        <div
          data-demo="chapter-title"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: type.title * u,
            lineHeight: titleLh,
            letterSpacing: '-0.012em',
            color: TITLE_INK,
            whiteSpace: social ? 'normal' : 'nowrap',
            textWrap: 'balance',
          }}
        >
          {social ? titleText(copy.title) : copy.title}
        </div>
      </Mask>
      <Mask p={s.line} style={{ gridColumn: 2, gridRow: 2 }}>
        <div
          data-demo="chapter-line"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            fontSize: type.line * u,
            lineHeight: 1.35,
            letterSpacing: '0.002em',
            color: LINE_INK,
            whiteSpace: social ? 'normal' : 'nowrap',
            textWrap: 'pretty',
          }}
        >
          {social ? titleText(copy.line) : copy.line}
        </div>
      </Mask>
    </div>
  );
  if (social) {
    // The frame's bottom band (Background paints it SLATE_BG between titles): the text only.
    return (
      <div
        data-demo="chapter"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width,
          height: SOCIAL_FRAME.captionH,
          zIndex: 90,
          background: SLATE_BG,
          display: 'flex',
          alignItems: 'center',
          padding: '0 56px 6px',
          boxSizing: 'border-box',
        }}
      >
        {grid}
      </div>
    );
  }
  return (
    <div
      data-demo="chapter"
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        zIndex: 90,
        background: SLATE_BG,
        padding: `${30 * u}px ${56 * u}px ${34 * u}px`,
        // The slab wipes out of the frame's left edge and back into it.
        clipPath: `inset(0 ${(1 - s.panel) * 100}% 0 0)`,
      }}
    >
      {grid}
    </div>
  );
}
