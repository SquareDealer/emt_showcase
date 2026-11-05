import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ShowcaseProps } from '../schema';
import { Background } from '../kit/Background';
import { BrandMark } from '../kit/BrandMark';
import { useLayout } from '../kit/useLayout';

/** Intro (75 f): mark 0–15, tagline on beat 15 (spring from below), brass rule on beat 30. */
export function IntroScene({ brand, callouts, accent }: ShowcaseProps) {
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
              opacity: interpolate(mark, [0, 1], [0.35, 1]),
              transform: `scale(${interpolate(mark, [0, 1], [0.94, 1])})`,
            }}
          >
            <BrandMark name={brand.name} theme="dark" size={social ? 96 : 128} />
          </div>
          {frame >= 15 && (
            <div
              style={{
                opacity: line,
                transform: `translateY(${(1 - line) * 36}px)`,
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
              {callouts.intro}
            </div>
          )}
          {frame >= 30 && (
            <div style={{ width: 160 * rule, height: 4, borderRadius: 2, background: accent }} />
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
