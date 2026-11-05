import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ACCENT } from './tokens';

export type Rect = { x: number; y: number; w: number; h: number };

/** Dims everything except `rect` (UI pixels) and rings it in the accent colour. */
export function Highlight({
  rect,
  appearAt,
  accent = ACCENT,
}: {
  rect: Rect;
  appearAt: number;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - appearAt, fps, config: { damping: 200 }, durationInFrames: 15 });
  if (frame < appearAt) return null;
  const grow = (1 - p) * 12;
  return (
    <div
      data-demo="highlight"
      style={{
        position: 'absolute',
        left: rect.x - grow,
        top: rect.y - grow,
        width: rect.w + grow * 2,
        height: rect.h + grow * 2,
        borderRadius: 10,
        boxShadow: `0 0 0 9999px rgba(0,0,0,${0.45 * p})`,
        outline: `2px solid ${accent}`,
        outlineOffset: 2,
        opacity: p,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
}
