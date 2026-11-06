import { describe, expect, it } from 'vitest';
import { CAM_EASE } from './math';
import { CARD_GROW, cardOpen, wipeEdge, wipeLayers, wipeNormal, wipeOffset, wipePolygon, type Pt } from './CameraWipe';

const area = (pts: Pt[]) => Math.abs(pts.reduce((a, p, i) => a + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;
const [W, H] = [1920, 1080];

describe('wipe geometry', () => {
  for (const from of ['right', 'bottom'] as const) {
    const n = wipeNormal(from);
    it(`${from}: nothing revealed at 0, everything at 1, the revealed area grows every frame`, () => {
      expect(wipePolygon(wipeOffset(0, n, W, H), n, W, H).length).toBe(0);
      expect(area(wipePolygon(wipeOffset(1, n, W, H), n, W, H))).toBeCloseTo(W * H, 3);
      let prev = -1;
      for (let f = 0; f <= 30; f++) {
        const a = area(wipePolygon(wipeOffset(CAM_EASE(f / 30), n, W, H), n, W, H));
        expect(a).toBeGreaterThanOrEqual(prev);
        prev = a;
      }
    });
    it(`${from}: a diagonal edge (not a flat curtain) from the ${from} side; the edge segment spans the frame mid-way`, () => {
      const c = wipeOffset(0.5, n, W, H);
      const edge = wipeEdge(c, n, W, H);
      expect(edge).toHaveLength(2);
      const [a, b] = edge;
      // Slanted: the segment is neither horizontal nor vertical.
      expect(Math.abs(a.x - b.x)).toBeGreaterThan(50);
      expect(Math.abs(a.y - b.y)).toBeGreaterThan(50);
      // The revealed side is towards `from`.
      const probe = from === 'right' ? { x: W - 1, y: H / 2 } : { x: W / 2, y: H - 1 };
      expect(probe.x * n.x + probe.y * n.y).toBeGreaterThanOrEqual(c);
    });
    it(`${from}: both layers move the same way (continuous camera), the outgoing pushes in, the incoming settles at rest`, () => {
      const l = wipeLayers(0.5, from, W, H);
      const dir = from === 'right' ? 'dx' : 'dy';
      expect(l.out[dir]).toBeLessThan(0);
      expect(l.in[dir]).toBeGreaterThan(0);
      expect(l.out.scale).toBeGreaterThan(1);
      expect(wipeLayers(1, from, W, H).in).toEqual({ dx: 0, dy: 0 });
      expect(wipeLayers(0, from, W, H).out).toEqual({ dx: -0, dy: -0, scale: 1 });
    });
  }
  it('the camera curve eases in and out without overshoot', () => {
    for (let i = 0; i <= 100; i++) {
      const v = CAM_EASE(i / 100);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('card opening', () => {
  const card = { x: 1100, y: 300, w: 470, h: 611 };
  it('grows out of the card\'s centre to the card, then to the whole frame; the shot always covers its clip', () => {
    const FRAME = { x: 0, y: 0, w: W, h: H };
    const c0 = cardOpen(0, card, FRAME);
    expect(c0.rect.w).toBe(0);
    expect(c0.rect.x).toBeCloseTo(card.x + card.w / 2);
    const atCard = cardOpen(CARD_GROW, card, FRAME);
    expect(atCard.rect.w).toBeGreaterThan(card.w);
    expect(cardOpen(1, card, FRAME)).toEqual({ rect: FRAME, scale: 1, centre: { x: W / 2, y: H / 2 } });
    for (let i = 0; i <= 30; i++) {
      const { rect, scale, centre } = cardOpen(CAM_EASE(i / 30), card, FRAME);
      // The scaled shot (W·scale × H·scale around `centre`) contains the clip rect.
      expect(centre.x - (W * scale) / 2).toBeLessThanOrEqual(rect.x + 1e-6);
      expect(centre.x + (W * scale) / 2).toBeGreaterThanOrEqual(rect.x + rect.w - 1e-6);
      expect(centre.y - (H * scale) / 2).toBeLessThanOrEqual(rect.y + 1e-6);
      expect(centre.y + (H * scale) / 2).toBeGreaterThanOrEqual(rect.y + rect.h - 1e-6);
    }
  });
  it('social: opens to the stage between the bands, the stage mapped onto the clip', () => {
    const STAGE = { x: 0, y: 120, w: 1080, h: 970 };
    const end = cardOpen(1, { x: 300, y: 400, w: 300, h: 400 }, STAGE);
    expect(end).toEqual({ rect: STAGE, scale: 1, centre: { x: 540, y: 605 } });
    for (let i = 0; i <= 30; i++) {
      const { rect, scale } = cardOpen(CAM_EASE(i / 30), { x: 300, y: 400, w: 300, h: 400 }, STAGE);
      expect(STAGE.w * scale).toBeGreaterThanOrEqual(rect.w - 1e-6);
      expect(STAGE.h * scale).toBeGreaterThanOrEqual(rect.h - 1e-6);
    }
  });
});
