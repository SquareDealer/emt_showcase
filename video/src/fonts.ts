// Inter + JetBrains Mono — the CRM's --font-sans / --font-mono — with Cyrillic and «₽».
//
// Bundled from @fontsource (woff2 via webpack asset/resource), not fetched from Google at render
// time: @remotion/google-fonts loads from fonts.gstatic.com, which fails behind a TLS-intercepting
// proxy (ERR_CERT_AUTHORITY_INVALID in this sandbox) and makes renders depend on the network.
// Each `<weight>.css` declares every subset with its unicode-range, so Cyrillic, Latin and
// Latin-ext («₽» U+20BD) all resolve to the same family the CRM CSS asks for: 'Inter',
// 'JetBrains Mono'.
import { cancelRender, continueRender, delayRender } from 'remotion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

export const fontFamily = { sans: 'Inter', mono: 'JetBrains Mono' };

const FACES: [family: string, weights: number[]][] = [
  [fontFamily.sans, [400, 500, 600, 700]],
  [fontFamily.mono, [400, 500]],
];
// Touches every subset the CRM uses: Latin, Cyrillic, Latin-ext (₽), punctuation (… · −).
const SAMPLE = 'Aa Яя Ёё ₽ … · − 0123456789';

const handle = delayRender('Loading Inter + JetBrains Mono (latin, cyrillic)');
Promise.all(
  FACES.flatMap(([family, weights]) =>
    weights.map(async (w) => {
      const spec = `${w} 16px '${family}'`;
      const faces = await document.fonts.load(spec, SAMPLE);
      if (faces.length === 0) throw new Error(`Font not loaded: ${spec}`);
    }),
  ),
).then(
  () => continueRender(handle),
  // Fail the render instead of silently falling back to a system font.
  (err: unknown) => cancelRender(err),
);
