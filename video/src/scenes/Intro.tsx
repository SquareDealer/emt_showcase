import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ShowcaseProps } from '../schema';
import { Background } from '../kit/Background';
import { BrandMark } from '../kit/BrandMark';
import { useLayout } from '../kit/useLayout';

/** Intro (90 f): mark 0–15, tagline on beat 15 (spring from below), brass rule on beat 30; the
 *  booking is wiped in over 60–90. */
export function IntroScene({ brand, tagline, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';

  const mark = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 15 });
  const line = spring({ frame: frame - 15, fps, config: { damping: 200 }, durationInFrames: 18 });
  const rule = spring({ frame: frame - 30, fps, config: { damping: 200 }, durationInFrames: 18 });

  return (
    <AbsoluteFill>
      <Background theme="dark" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44, maxWidth: social ? 900 : 1500 }}>
          <div
            style={{
              opacity: interpolate(mark, [0, 1], [0.5, 1]),
              transform: `scale(${interpolate(mark, [0, 1], [0.94, 1])})`,
            }}
          >
            <BrandMark name={brand.name} theme="dark" size={social ? 170 : 230} />
          </div>
          {(
            <div
              style={{
                opacity: frame >= 15 ? line : 0,
                transform: `translateY(${(frame >= 15 ? 1 - line : 1) * 36}px)`,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: social ? 52 : 60,
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.94)',
                textWrap: 'balance',
              }}
            >
              {tagline}
            </div>
          )}
          <div style={{ width: 160, height: 4, borderRadius: 2, background: accent, transform: `scaleX(${frame >= 30 ? rule : 0})` }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
