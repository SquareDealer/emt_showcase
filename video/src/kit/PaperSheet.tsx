import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

/** A PDF page raster (public/docs/…) sliding in as a sheet of paper. `src` is relative to public/. */
export function PaperSheet({ src, appearAt, width = 760 }: { src: string; appearAt: number; width?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < appearAt) return null;
  const p = spring({ frame: frame - appearAt, fps, config: { damping: 200 }, durationInFrames: 18 });
  return (
    <div
      style={{
        width,
        background: '#fff',
        borderRadius: 4,
        boxShadow: '0 30px 60px -12px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.08)',
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px) rotate(${(1 - p) * -1.5}deg)`,
      }}
    >
      <Img src={staticFile(src)} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
