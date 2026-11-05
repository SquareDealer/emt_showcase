import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import type { ReactNode } from 'react';

/**
 * Seamless loop of `durationInFrames`. `children` is authored as a clip of
 * `durationInFrames + overlap` frames (its own frame 0..D+overlap-1). Output frame f shows clip
 * time f+overlap; during the first `overlap` frames the clip's head (time f) is cross-faded
 * out over it, so the end of the clip (time D+overlap-1) flows into the head of the next loop.
 */
export function LoopCrossfade({
  durationInFrames,
  overlap = 10,
  children,
}: {
  durationInFrames: number;
  overlap?: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const headOpacity = interpolate(frame, [0, overlap], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill>
      <Sequence from={-overlap} durationInFrames={durationInFrames + overlap} layout="none">
        <AbsoluteFill>{children}</AbsoluteFill>
      </Sequence>
      {frame < overlap ? (
        <Sequence from={0} durationInFrames={overlap} layout="none">
          <AbsoluteFill style={{ opacity: headOpacity }}>{children}</AbsoluteFill>
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
}
