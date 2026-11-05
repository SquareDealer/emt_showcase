import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ShowcaseProps } from '../schema';
import { Background } from '../kit/Background';
import { BrandMark } from '../kit/BrandMark';
import { useLayout } from '../kit/useLayout';

export const OUTRO_FEATURES = 'Запись · Смета · Доска · Документы · Поиск';

/** Outro (120 f): mark 0–15, features on 15, title on 30, subtitle/cta on 45, fade-out 105–120. */
export function OutroScene({ brand, outro, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const social = useLayout() === 'social';

  const enter = (at: number) => spring({ frame: frame - at, fps, config: { damping: 200 }, durationInFrames: 18 });
  const mark = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 15 });
  const fade = interpolate(frame, [105, 120], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rise = (p: number) => ({ opacity: p, transform: `translateY(${(1 - p) * 24}px)` });

  return (
    <AbsoluteFill>
      <Background theme="dark" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: fade }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, maxWidth: social ? 960 : 1500 }}>
          <div
            style={{
              opacity: interpolate(mark, [0, 1], [0.35, 1]),
              transform: `scale(${interpolate(mark, [0, 1], [0.94, 1])})`,
              marginBottom: 10,
            }}
          >
            <BrandMark name={brand.name} theme="dark" size={social ? 120 : 168} />
          </div>
          {frame >= 15 && (
            <div
              style={{
                ...rise(enter(15)),
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: social ? 36 : 44,
                letterSpacing: '0.01em',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.82)',
              }}
            >
              {OUTRO_FEATURES}
            </div>
          )}
          {frame >= 30 && outro.title !== '' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, ...rise(enter(30)) }}>
              <div style={{ width: 120, height: 4, borderRadius: 2, background: accent }} />
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  fontSize: social ? 34 : 42,
                  textAlign: 'center',
                  color: '#fff',
                }}
              >
                {outro.title}
              </div>
            </div>
          )}
          {frame >= 45 && outro.subtitle !== '' && (
            <div
              style={{
                ...rise(enter(45)),
                fontFamily: "'Inter', sans-serif",
                fontWeight: 400,
                fontSize: social ? 32 : 36,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {outro.subtitle}
            </div>
          )}
          {frame >= 45 && outro.cta !== '' && (
            <div
              style={{
                ...rise(enter(45)),
                padding: '16px 34px',
                borderRadius: 14,
                background: accent,
                color: 'oklch(0.2 0.02 70)',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: social ? 32 : 36,
                textAlign: 'center',
              }}
            >
              {outro.cta}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
