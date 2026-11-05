import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useCameraState, useCameraZoom } from './Camera';
import { SOCIAL_FRAME, frameToUi } from './math';
import { ACCENT, PLAQUE_BG } from './tokens';
import { useLayout } from './useLayout';

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** Social caption type size (px on screen): 52–56 per the plan; two balanced lines at most in 1080 − 2·64. */
export const PLAQUE_FONT = 54;

/**
 * Wide: brass dot at `anchor` (UI pixels) and a caption pill on `side`.
 * Social: the caption is the bottom plaque — the frame's lowest SOCIAL_FRAME.captionH px, pinned to the
 * frame whatever the camera does (`anchor`/`side` are optional there and unused); scenes frame their zone above it.
 */
export function Callout({
  text,
  at,
  anchor,
  side,
  accent = ACCENT,
}: {
  text: string;
  at: number;
  /** Wide only (required there); the social plaque doesn't point at anything. */
  anchor?: { x: number; y: number };
  side?: Side;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();
  const zoom = useCameraZoom();
  if (frame < at) return null;
  const p = spring({ frame: frame - at, fps, config: { damping: 200 }, durationInFrames: 12 });
  if (layout === 'social') return <Plaque text={text} p={p} accent={accent} />;
  if (!anchor || !side) throw new Error(`Callout «${text}»: the wide layout needs anchor and side`);
  const fontSize = 30;
  const gap = 18;
  const dot = 14;
  const slide = (1 - p) * 10;
  const pos: Record<Side, React.CSSProperties> = {
    right: { left: dot / 2 + gap, top: 0, transform: `translate(${slide}px, -50%)` },
    left: { right: dot / 2 + gap, top: 0, transform: `translate(${-slide}px, -50%)` },
    bottom: { top: dot / 2 + gap, left: 0, transform: `translate(-50%, ${slide}px)` },
    top: { bottom: dot / 2 + gap, left: 0, transform: `translate(-50%, ${-slide}px)` },
  };
  return (
    <div
      data-demo="callout"
      style={{
        position: 'absolute',
        left: anchor.x,
        top: anchor.y,
        width: 0,
        height: 0,
        opacity: p,
        zIndex: 90,
        // Keep on-screen size constant while the camera zooms.
        transform: `scale(${1 / zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -dot / 2,
          top: -dot / 2,
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 0 ${6 * p}px color-mix(in oklch, ${accent} 35%, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          ...pos[side],
          whiteSpace: 'nowrap',
          padding: '12px 22px',
          borderRadius: 12,
          background: 'rgba(16,20,26,0.92)',
          color: '#fff',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize,
          lineHeight: 1.2,
          boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** Plaque line breaks: a dash or an arrow never starts a line; a short preposition/conjunction or a
 *  number never ends one («по VIN», «в 2 клика», «до копейки») — the space after it becomes a no-break space. */
export const plaqueText = (text: string) =>
  text
    .replace(/ (—|→)/g, '\u00a0$1')
    .replace(/(?<=^|[\s\u00a0])(в|к|с|у|о|и|а|по|до|за|на|из|от|во|со|не|об|\d+) /giu, '$1\u00a0');

/** The social caption: a full-width dark band over the frame's bottom, brass rule, white type. */
function Plaque({ text, p, accent }: { text: string; p: number; accent: string }) {
  const { width, height } = useVideoConfig();
  const cam = useCameraState();
  const top = height - SOCIAL_FRAME.captionH;
  // Inside a Camera: the frame point (0, top) in UI px, scaled back to frame px; outside: as is.
  const at = cam ? frameToUi(0, top, cam, cam.centre) : { x: 0, y: top };
  const zoom = cam?.zoom ?? 1;
  return (
    <div
      data-demo="callout"
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        width,
        height: SOCIAL_FRAME.captionH,
        opacity: p,
        zIndex: 90,
        transform: `scale(${1 / zoom})`,
        transformOrigin: '0 0',
        background: PLAQUE_BG,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: '0 64px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: 72, height: 6, borderRadius: 3, background: accent, transform: `scaleX(${p})` }} />
      <div
        style={{
          transform: `translateY(${(1 - p) * 16}px)`,
          color: '#fff',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: PLAQUE_FONT,
          lineHeight: 1.18,
          letterSpacing: '-0.005em',
          textAlign: 'center',
          textWrap: 'balance',
        }}
      >
        {plaqueText(text)}
      </div>
    </div>
  );
}
