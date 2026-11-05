import { Img, staticFile } from 'remotion';

/** Logo + product name lockup for intro/outro. */
export function BrandMark({
  name,
  theme = 'light',
  size = 64,
}: {
  name: string;
  theme?: 'light' | 'dark';
  size?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.3 }}>
      <Img
        src={staticFile(`brand/garage-crm-logo-${theme}-sidebar.png`)}
        style={{ height: size, width: 'auto' }}
      />
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.6,
          letterSpacing: '-0.02em',
          color: theme === 'dark' ? '#fff' : 'oklch(0.23 0.02 240)',
        }}
      >
        {name}
      </span>
    </div>
  );
}
