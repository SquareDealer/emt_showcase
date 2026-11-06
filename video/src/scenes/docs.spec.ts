import { describe, expect, it } from 'vitest';
import { SCENE_CLICKS } from '../timing';
import { SLATE_TOP, TITLE_OUT } from '../kit/ChapterTitle';
import { BLOCK, TITLES, docsState, ORDER_DX, SMETA_DX, DOCS_CAMERA, SHEET_H, SHEET_W, toScreen, ZOOM_BLOCK, ZOOM_PAIR } from './Docs';

const at = (f: number) => docsState(f, 30);

describe('docs scene state', () => {
  it('no clicks', () => expect(SCENE_CLICKS.docs).toEqual([]));

  it('the order sheet has risen by 30; smeta appears at 75 and is fanned 6° by the end', () => {
    expect(at(0).riseY).toBeGreaterThan(400);
    expect(at(30).riseY).toBeLessThan(5);
    expect(at(74).smetaVisible).toBe(false);
    expect(at(75).smetaVisible).toBe(true);
    expect(at(75).smetaX).toBe(0);
    expect(at(119).smetaRot).toBeCloseTo(6, 3);
    expect(at(119).orderX).toBeCloseTo(ORDER_DX, 0);
  });

  it('chapter 05 never covers the block the camera settles on (45–75): it sits above the slate', () => {
    const [t] = TITLES;
    for (let f = Math.max(t.at, 45); f <= 75; f++) {
      expect(toScreen(f, { x: BLOCK.x, y: BLOCK.y + BLOCK.h }).y).toBeLessThanOrEqual(SLATE_TOP);
    }
    expect(t.out + TITLE_OUT).toBeLessThanOrEqual(150);
  });

  it('never upscales the raster past 1:1', () => {
    for (const k of DOCS_CAMERA) expect(k.zoom).toBeLessThanOrEqual(1);
  });

  it('at 45 the whole block is on screen, centred', () => {
    const tl = toScreen(45, { x: BLOCK.x, y: BLOCK.y });
    const br = toScreen(45, { x: BLOCK.x + BLOCK.w, y: BLOCK.y + BLOCK.h });
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(1920);
    expect(br.y).toBeLessThanOrEqual(1080);
    expect(br.x - tl.x).toBeCloseTo(BLOCK.w * ZOOM_BLOCK, 3);
    expect((tl.x + br.x) / 2).toBeCloseTo(960, 3);
  });

  it('final view holds both sheets (left of the order, right of the fanned smeta)', () => {
    const l = toScreen(119, { x: ORDER_DX, y: 0 });
    const r = toScreen(119, { x: SMETA_DX + SHEET_W + 244, y: 0 });
    expect(l.x).toBeGreaterThanOrEqual(0);
    expect(r.x).toBeLessThanOrEqual(1920);
    // the order sheet's right edge stays left of the smeta's fanned left edge at mid-height of the content
    expect(ORDER_DX + SHEET_W).toBeLessThan(SMETA_DX + (2339 - 1000) * Math.sin((6 * Math.PI) / 180));
    expect(DOCS_CAMERA.at(-1)!.zoom).toBe(ZOOM_PAIR);
  });

  it('final view: both sheets keep their top on screen, the fanned smeta corner included (≈24 px)', () => {
    const st = at(119);
    expect(toScreen(119, { x: st.orderX, y: st.riseY }).y).toBeGreaterThan(0);
    // the smeta turns about its foot's centre: its top-left corner is its highest point
    const a = (st.smetaRot * Math.PI) / 180;
    const [px, py] = [SHEET_W / 2, SHEET_H];
    const corner = { x: st.smetaX + px + -px * Math.cos(a) + py * Math.sin(a), y: py + -px * Math.sin(a) - py * Math.cos(a) };
    const y = toScreen(119, corner).y;
    expect(y).toBeGreaterThan(10);
    expect(y).toBeLessThan(40);
  });
});
