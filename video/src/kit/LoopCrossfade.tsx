import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import type { ReactNode } from 'react';
import { loopLayers } from './math';

/**
 * Seamless loop of `durationInFrames` (D). Contract: `children` is a clip that is at least
 * D + overlap frames long (it reads its own frame via useCurrentFrame). Output frame f shows
 * clip(f); during the first `overlap` frames the clip's continuation clip(D + f) is laid on top
 * with opacity 1 - f/overlap, so output frame 0 == clip(D), which continues straight from
 * clip(D - 1) (the last output frame), and then dissolves into the head clip(f). The clip only
 * has to be continuous across its own tail, not from its last frame back to its first.
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
  const layers = loopLayers(frame, durationInFrames, overlap);
  return (
    <AbsoluteFill>
      {layers.map((l, i) => (
        // Sequence offset makes the child's useCurrentFrame() equal l.clipFrame.
        <Sequence key={i} from={frame - l.clipFrame} layout="none">
          <AbsoluteFill style={{ opacity: l.opacity }}>{children}</AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
