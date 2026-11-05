import { describe, expect, it } from 'vitest';
import { cameraAt, clickState, countUp, cursorAt, loopLayers, typed } from './math';

const keys = [
  { at: 0, x: 100, y: 200, zoom: 1 },
  { at: 1, x: 500, y: 400, zoom: 2 },
];

describe('cameraAt', () => {
  it('starts at the first key', () => expect(cameraAt(0, 30, keys)).toEqual({ x: 100, y: 200, zoom: 1 }));
  it('hits the second key at its time', () => expect(cameraAt(30, 30, keys)).toEqual({ x: 500, y: 400, zoom: 2 }));
  it('clamps before and after', () => {
    expect(cameraAt(-10, 30, keys)).toEqual({ x: 100, y: 200, zoom: 1 });
    expect(cameraAt(300, 30, keys)).toEqual({ x: 500, y: 400, zoom: 2 });
  });
  it('is deterministic and eased (midpoint = 0.5 for symmetric bezier)', () => {
    expect(cameraAt(45, 30, keys)).toEqual(cameraAt(45, 30, keys));
    const m = cameraAt(15, 30, keys);
    expect(m.x).toBeCloseTo(300, 0);
  });
  it('single key is constant', () => expect(cameraAt(5, 30, [keys[0]])).toEqual({ x: 100, y: 200, zoom: 1 }));
});

describe('cursorAt', () => {
  const path = [
    { at: 0, x: 0, y: 0 },
    { at: 1, x: 100, y: 50 },
  ];
  it('endpoints and clamp', () => {
    expect(cursorAt(0, 30, path)).toEqual({ x: 0, y: 0 });
    expect(cursorAt(30, 30, path)).toEqual({ x: 100, y: 50 });
    expect(cursorAt(99, 30, path)).toEqual({ x: 100, y: 50 });
  });
  it('midpoint of inOut cubic is half', () => expect(cursorAt(15, 30, path).x).toBeCloseTo(50, 5));
});

describe('clickState', () => {
  it('before click', () => expect(clickState(29, [30], 30)).toEqual({ press: 1, ring: 0 }));
  it('squeezed at 33', () => expect(clickState(33, [30], 30).press).toBeCloseTo(0.82, 5));
  it('released at 36', () => expect(clickState(36, [30], 30).press).toBe(1));
  it('ring gone at 48', () => expect(clickState(48, [30], 30).ring).toBe(0));
  it('ring grows after click', () => {
    const a = clickState(32, [30], 30).ring;
    const b = clickState(40, [30], 30).ring;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
  it('picks the latest past click', () => expect(clickState(63, [30, 60], 30).press).toBeCloseTo(0.82, 5));
});

describe('typed', () => {
  it('slices by frames per char', () => expect(typed(10, 0, 'WMW', 5)).toBe('WM'));
  it('empty before start', () => expect(typed(-1, 0, 'WMW')).toBe(''));
  it('caps at full text', () => expect(typed(999, 0, 'WMW')).toBe('WMW'));
});

describe('countUp', () => {
  it('half way', () => expect(countUp(15, 0, 30, 0, 100)).toBe(50));
  it('rounds to kopecks and clamps', () => expect(countUp(99, 0, 30, 0, 100.555)).toBe(100.56));
  it('before start is from', () => expect(countUp(-5, 0, 30, 10, 20)).toBe(10));
});

describe('guards', () => {
  it('countUp with equal frames steps', () => {
    expect(countUp(4, 5, 5, 0, 10)).toBe(0);
    expect(countUp(5, 5, 5, 0, 10)).toBe(10);
  });
  it('duplicate camera keys do not throw', () => {
    const k = [
      { at: 0, x: 0, y: 0, zoom: 1 },
      { at: 1, x: 10, y: 0, zoom: 1 },
      { at: 1, x: 50, y: 0, zoom: 2 },
    ];
    expect(() => cameraAt(30, 30, k)).not.toThrow();
    expect(cameraAt(90, 30, k).x).toBe(50);
  });
  it('rounds half-kopeck up', () => expect(countUp(1, 0, 1, 0, 1.005)).toBe(1.01));
});

describe('loopLayers', () => {
  it('frame 0: base head plus fully opaque tail continuation clip(D)', () =>
    expect(loopLayers(0, 60, 10)).toEqual([
      { clipFrame: 0, opacity: 1 },
      { clipFrame: 60, opacity: 1 },
    ]));
  it('mid blend', () => expect(loopLayers(5, 60, 10)[1]).toEqual({ clipFrame: 65, opacity: 0.5 }));
  it('last frame is clip(D-1) only', () => expect(loopLayers(59, 60, 10)).toEqual([{ clipFrame: 59, opacity: 1 }]));
});
