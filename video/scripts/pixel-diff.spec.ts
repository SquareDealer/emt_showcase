import { describe, expect, it } from 'vitest';
import { pixelDiff } from './pixel-diff';

const img = (w: number, h: number, fill: [number, number, number, number]) => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4);
  return { width: w, height: h, data };
};

describe('pixelDiff', () => {
  it('identical images: no differing pixel', () => {
    expect(pixelDiff(img(4, 4, [10, 20, 30, 255]), img(4, 4, [10, 20, 30, 255]))).toEqual({ differing: 0, total: 16, share: 0 });
  });
  it('a pixel differs when any one channel moves by more than the tolerance (16), not at 16', () => {
    const a = img(2, 2, [100, 100, 100, 255]);
    const b = img(2, 2, [100, 100, 100, 255]);
    b.data[0] = 116; // pixel 0, R +16: within tolerance
    b.data[6] = 83; // pixel 1, B −17: differs
    b.data[11] = 200; // pixel 2, A −55: differs
    expect(pixelDiff(a, b)).toEqual({ differing: 2, total: 4, share: 0.5 });
    expect(pixelDiff(a, b, 60).differing).toBe(0);
  });
  it('refuses images of different sizes', () => {
    expect(() => pixelDiff(img(2, 2, [0, 0, 0, 255]), img(2, 3, [0, 0, 0, 255]))).toThrow(/size/);
  });
});
