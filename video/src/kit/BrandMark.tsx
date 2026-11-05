import { Img, staticFile } from 'remotion';
import { SOCIAL_FRAME } from './math';
import { PLAQUE_BG } from './tokens';

/** Wordmark for intro/outro: the logo image already contains the product name, so it is drawn once.
 *  `size` is the logo height in px; `name` is the alt text. */
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
    <Img
      src={staticFile(`brand/garage-crm-logo-${theme}-sidebar.png`)}
      alt={name}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}

/** Social: the frame's top SOCIAL_FRAME.brandH px — a dark band with the wordmark centred in it. */
export function BrandBand({ name, opacity = 1 }: { name: string; opacity?: number }) {
  if (opacity <= 0) return null;
  return (
    <div
      data-demo="brand-band"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        height: SOCIAL_FRAME.brandH,
        background: PLAQUE_BG,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <BrandMark name={name} theme="dark" size={76} />
    </div>
  );
}
