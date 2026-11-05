import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ChevronDown } from 'lucide-react';
import type { Rect } from './Highlight';

/**
 * A native <select> can't be shown open in a still, so this draws the closed control and its list
 * with the CRM's tokens. Opens at `openAt`, highlights then picks `pickIndex` at `pickAt`; after
 * the pick the list closes and the chosen option is the value.
 */
export function FakeSelect({
  rect,
  options,
  openAt,
  pickIndex,
  pickAt,
  placeholder,
  value,
}: {
  rect: Rect;
  options: string[];
  openAt: number;
  pickIndex: number;
  pickAt: number;
  placeholder?: string;
  /** The control's current value until the pick (ink); without it the placeholder shows (faint). */
  value?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const picked = frame >= pickAt;
  const open = frame >= openAt && !picked;
  const p = spring({ frame: frame - openAt, fps, config: { damping: 200 }, durationInFrames: 8 });
  const rowH = 36;
  const hover = frame >= openAt + 9 ? pickIndex : -1;
  return (
    <div style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: 60 }}>
      <div
        className="select"
        data-demo="fake-select"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%',
          borderColor: open ? 'var(--primary)' : undefined,
          boxShadow: open ? '0 0 0 3px var(--ring)' : undefined,
          backgroundImage: 'none',
        }}
      >
        <span style={{ color: picked || value !== undefined ? 'var(--ink)' : 'var(--faint)' }}>
          {picked ? options[pickIndex] : (value ?? placeholder ?? '')}
        </span>
        <ChevronDown size={16} color="gray" />
      </div>
      {open ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: rect.h + 4,
            padding: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-md)',
            opacity: p,
            transform: `translateY(${(1 - p) * -4}px)`,
          }}
        >
          {options.map((o, i) => (
            <div
              key={o}
              style={{
                height: rowH,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--text-sm)',
                color: i === hover ? 'var(--primary-on)' : 'var(--ink)',
                background: i === hover ? 'var(--primary)' : 'transparent',
              }}
            >
              {o}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
