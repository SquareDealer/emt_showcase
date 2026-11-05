import { AbsoluteFill, useVideoConfig } from 'remotion';
import { SOCIAL_FRAME, type Layout } from './math';
import { PLAQUE_BG } from './tokens';
import { useLayout } from './useLayout';

/** The caption band belongs to the social cut's frame only: social layout AND exactly 1080×1350. */
export function captionBandFits(layout: Layout, width: number, height: number): boolean {
  return layout === 'social' && width === SOCIAL_FRAME.width && height === SOCIAL_FRAME.height;
}

/**
 * Frame backdrop behind the CRM window (same gradients the scaffold used inline).
 *
 * `captionBand`: in the social cut (a 1080×1350 composition — not any portrait one, so MobileMaster's
 * 390×844 is untouched) the bottom SOCIAL_FRAME.captionH px are painted PLAQUE_BG, so the caption zone
 * stays dark between plaques instead of showing the gradient. It sits under the window; the Callout
 * plaques draw on top as before. Wide layouts render exactly as without it.
 */
export function Background({ theme, captionBand = false }: { theme: 'light' | 'dark'; captionBand?: boolean }) {
  const layout = useLayout();
  const { width, height } = useVideoConfig();
  const band = captionBand && captionBandFits(layout, width, height);
  return (
    <>
      <AbsoluteFill
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(120% 90% at 50% 0%, oklch(0.32 0.03 240), oklch(0.14 0.01 240))'
              : 'radial-gradient(120% 90% at 50% 0%, oklch(0.93 0.02 235), oklch(0.78 0.03 240))',
        }}
      />
      {band ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: SOCIAL_FRAME.captionH,
            background: PLAQUE_BG,
          }}
        />
      ) : null}
    </>
  );
}
