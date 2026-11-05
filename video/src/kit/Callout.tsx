import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useCameraZoom } from './Camera';
import { ACCENT } from './tokens';
import { useLayout } from './useLayout';

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** Brass dot at `anchor` (UI pixels) and a caption pill on `side`; text size follows the layout. */
export function Callout({
  text,
  at,
  anchor,
  side,
  accent = ACCENT,
}: {
  text: string;
  at: number;
  anchor: { x: number; y: number };
  side: Side;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();
  const zoom = useCameraZoom();
  if (frame < at) return null;
  const p = spring({ frame: frame - at, fps, config: { damping: 200 }, durationInFrames: 12 });
  const fontSize = layout === 'social' ? 38 : 30;
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
