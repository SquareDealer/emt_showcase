import { useCurrentFrame, useVideoConfig } from 'remotion';
import { ACCENT } from './tokens';
import { clickState, cursorAt, type CursorPoint } from './math';

/** Arrow cursor following `path`, squeezed on `clicks` (absolute scene frames) with an expanding ring. */
export function Cursor({
  path,
  clicks,
  accent = ACCENT,
}: {
  path: CursorPoint[];
  clicks: number[];
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { x, y } = cursorAt(frame, fps, path);
  const { press, ring } = clickState(frame, clicks, fps);
  const ringSize = 14 + ring * 46;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 100 }}>
      {ring > 0 && ring < 1 ? (
        <div
          data-demo="click-ring"
          style={{
            position: 'absolute',
            left: -ringSize / 2,
            top: -ringSize / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: '50%',
            border: `3px solid ${accent}`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          maxWidth: 'none', // CRM reset caps svg at 100% of the 0-width anchor
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `scale(${press})`,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))',
        }}
      >
        <path
          d="M3 2 L3 19 L7.6 14.8 L10.6 21.5 L13.4 20.3 L10.5 13.7 L16.8 13.4 Z"
          fill="#fff"
          stroke="#111"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
