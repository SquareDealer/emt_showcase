import { Img, staticFile } from 'remotion';

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
