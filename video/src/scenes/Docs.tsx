import { AbsoluteFill, spring } from 'remotion';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { ShowcaseProps } from '../schema';
import { Background } from '../kit/Background';
import { Camera } from '../kit/Camera';
import { PaperSheet } from '../kit/PaperSheet';
import { SceneTitles, type TitleCue } from '../kit/SceneTitles';
import { cameraAt, type CamKey } from '../kit/math';
import { FPS } from '../timing';

// ---------------------------------------------------------------------------------------------
// Geometry in PNG pixels: the order sheet's top-left is (0,0) and PaperSheet is `SHEET_W` = the PNG's
// own width, so one stage unit = one PNG pixel and the camera zoom IS the on-screen scale of the raster
// (zoom 1 = 1:1 of the PNG's pixels). Both PNGs are 1654×2339 (A4 at 200 dpi).
//
// BLOCK measurement: `public/docs/order-pdf.png` loaded with PIL, converted to greyscale; rows with any
// pixel < 200 grouped into ink bands (a band = consecutive rows with ink). The title of the block
// «Замена цепи ГРМ (R56/N14)» + its table are the band 927–950 (heading) and 961–1204 (table); columns
// with ink span 88–1564. Verified against the image: heading text y≈927, last table row ends 1204.
// Below it the totals boxes (1232–1438).
// ---------------------------------------------------------------------------------------------
export const SHEET_W = 1654;
export const SHEET_H = 2339;
export const BLOCK = { x: 88, y: 927, w: 1564 - 88, h: 1204 - 927 };
const BLOCK_C = { x: BLOCK.x + BLOCK.w / 2, y: BLOCK.y + BLOCK.h / 2 };

/** Camera zooms ≤ 1 only: the raster is never upscaled past 1:1 of its pixels (crisp text). */
export const ZOOM_WHOLE = 0.5; // frame 0–30: the whole page rises
export const ZOOM_BLOCK = 0.75; // 45–75: the block fills ~1110 of 1920 px, 150 dpi-equivalent text
export const ZOOM_PAIR = 0.53; // 105–: both sheets
/** On screen (1920×1080) the block's centre sits at the frame's centre (block x 406–1513, y 436–644:
 *  above the chapter slate). */
const BLOCK_SCREEN_X = 960;

const RISE_END = 30;
const BLOCK_AT = 45;
const SMETA_AT = 75;
/** Chapter 05: in as the sheet has risen, out once both documents have been held side by side. */
export const TITLES: readonly TitleCue[] = [{ key: 'docs', at: 30, out: 135 }];
const PAIR_AT = 105;
/** Offsets of the sheets at the end, PNG px: order slides left, smeta out to the right (fan 6°, pivot at its foot). */
export const ORDER_DX = -250;
export const SMETA_DX = 1380;
const FAN_DEG = 6;
const RISE_PX = 500;

const s = (f: number) => f / FPS;

export const DOCS_CAMERA: CamKey[] = [
  { at: 0, x: SHEET_W / 2, y: 1170, zoom: ZOOM_WHOLE },
  { at: s(RISE_END), x: SHEET_W / 2, y: 1170, zoom: ZOOM_WHOLE },
  // key point = PNG point at the screen centre: block centre at x 600 ⇒ key.x = c + (960 − 600)/zoom
  { at: s(BLOCK_AT), x: BLOCK_C.x + (960 - BLOCK_SCREEN_X) / ZOOM_BLOCK, y: BLOCK_C.y, zoom: ZOOM_BLOCK },
  { at: s(SMETA_AT), x: BLOCK_C.x + (960 - BLOCK_SCREEN_X) / ZOOM_BLOCK, y: BLOCK_C.y, zoom: ZOOM_BLOCK },
  // pair: x from −250 (order's left) to 3278 (smeta's top-right after the fan) → centre 1514. y 900: the
  // fanned smeta's highest point (its top-left corner, PNG y ≈ −74 after the 6° turn) lands ≈24 px below
  // the frame's top edge, the order sheet's top at ≈63 px — both whole sheets' tops on screen.
  { at: s(PAIR_AT), x: 1514, y: 900, zoom: ZOOM_PAIR },
];

/** Scene-local state: a pure function of the frame. */
export function docsState(frame: number, fps: number) {
  const rise = spring({ frame, fps, config: { damping: 200 }, durationInFrames: RISE_END });
  const out = spring({ frame: frame - SMETA_AT, fps, config: { damping: 200 }, durationInFrames: 24 });
  return {
    riseY: (1 - rise) * RISE_PX,
    orderX: ORDER_DX * out,
    smetaVisible: frame >= SMETA_AT,
    smetaX: SMETA_DX * out,
    smetaRot: FAN_DEG * out,
  };
}

/** Screen position (1920×1080) of a PNG point at a given frame. */
export const toScreen = (frame: number, p: { x: number; y: number }, w = 1920, h = 1080) => {
  const c = cameraAt(frame, FPS, DOCS_CAMERA);
  return { x: w / 2 + (p.x - c.x) * c.zoom, y: h / 2 + (p.y - c.y) * c.zoom };
};

/**
 * Docs (180 f): the documents on the brand's dark ground (no UI behind them — the board is left by the
 * transition, not blurred under the paper); the order PDF (PNG) rises 0–30, chapter 05 (30–135); the
 * camera settles on the «Замена цепи ГРМ» block by 45; at 75 the estimate PDF slides out from behind,
 * fanned 6°, and the camera pulls back to both (105), held to the transition (150). No clicks.
 */
export function DocsScene({ chapters, accent }: ShowcaseProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = docsState(frame, fps);
  return (
    <AbsoluteFill>
      <Background theme="dark" />
      <Camera keys={DOCS_CAMERA}>
        {st.smetaVisible ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translateX(${st.smetaX}px) rotate(${st.smetaRot}deg)`,
              transformOrigin: `${SHEET_W / 2}px ${SHEET_H}px`,
            }}
          >
            <PaperSheet src="docs/smeta.png" appearAt={SMETA_AT} width={SHEET_W} />
          </div>
        ) : null}
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${st.orderX}px, ${st.riseY}px)` }}>
          <PaperSheet src="docs/order-pdf.png" appearAt={0} width={SHEET_W} />
        </div>
      </Camera>
      <SceneTitles cues={TITLES} chapters={chapters} accent={accent} />
    </AbsoluteFill>
  );
}
