import { OffthreadVideo, staticFile } from 'remotion';

/** 390×844 device with rounded bezel playing a pre-rendered clip from public/. */
export function PhoneFrame({ src, scale = 1 }: { src: string; scale?: number }) {
  return (
    <div
      style={{
        width: 390 + 28,
        height: 844 + 28,
        padding: 14,
        boxSizing: 'border-box',
        borderRadius: 64,
        background: '#14181d',
        boxShadow: '0 40px 80px -20px rgba(0,0,0,.5), inset 0 0 0 2px #2b3138',
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ width: 390, height: 844, borderRadius: 50, overflow: 'hidden', background: '#000' }}>
        <OffthreadVideo src={staticFile(src)} muted style={{ width: 390, height: 844 }} />
      </div>
    </div>
  );
}
