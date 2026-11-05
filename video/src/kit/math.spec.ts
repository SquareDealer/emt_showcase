import { describe, expect, it } from 'vitest';
import { SOCIAL_FRAME, SOCIAL_STAGE, cameraAt, cameraCentre, clickState, countUp, cursorAt, frameToUi, loopLayers, maxPointerStep, pingPong, socialKeyForView, stageView, typed } from './math';

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

describe('round-2 fixes', () => {
  it('unsorted camera keys are sorted, not shifted', () => {
    const k = [
      { at: 0, x: 0, y: 0, zoom: 1 },
      { at: 2, x: 200, y: 0, zoom: 1 },
      { at: 1, x: 100, y: 0, zoom: 1 },
    ];
    expect(cameraAt(30, 30, k).x).toBe(100);
    expect(cameraAt(60, 30, k).x).toBe(200);
  });
  it('kopeck rounding', () => {
    const r = (v: number) => countUp(1, 0, 1, 0, v);
    expect(r(2.135)).toBe(2.14);
    expect(r(4.015)).toBe(4.02);
    expect(r(1.005)).toBe(1.01);
    expect(r(-2.135)).toBe(-2.14);
  });
  it('x.xx5 sweep 0..1000', () => {
    for (let i = 0; i < 1000; i++) {
      for (let c = 0; c < 100; c++) {
        const lit = `${i}.${String(c).padStart(2, '0')}5`;
        const expected = Number(`${i * 100 + c + 1}e-2`);
        expect(countUp(1, 0, 1, 0, Number(lit))).toBe(expected);
      }
    }
  });
});

describe('round2 guards', () => {
  const r = (v: number) => countUp(1, 0, 1, 0, v);
  it('tiny, zero and negative zero', () => {
    expect(r(1e-7)).toBe(0);
    expect(r(0)).toBe(0);
    expect(Object.is(r(-0), 0)).toBe(true);
    expect(Object.is(r(-1e-7), 0)).toBe(true);
  });
  it('huge values pass through', () => expect(r(1e21)).toBe(1e21));
});

describe('pingPong', () => {
  // 0 at `from`, `amplitude` over [from + rise, from + rise + hold], back to 0 at `to`.
  const pp = (f: number) => pingPong(f, 30, 130, 200, 20);
  it('rests at 0 outside [from, to]', () => {
    expect(pp(-5)).toBe(0);
    expect(pp(30)).toBe(0);
    expect(pp(130)).toBe(0);
    expect(pp(500)).toBe(0);
  });
  it('reaches the amplitude after the rise and holds it', () => {
    expect(pp(70)).toBe(200);
    expect(pp(80)).toBe(200);
    expect(pp(90)).toBe(200);
  });
  it('is eased and symmetric: mid-rise = mid-fall = half', () => {
    expect(pp(50)).toBeCloseTo(100, 5);
    expect(pp(110)).toBeCloseTo(100, 5);
    expect(pp(35)).toBeCloseTo(pp(125), 9);
    expect(pp(35)).toBeLessThan(200 * (5 / 40)); // ease-in: slower than linear at the start
  });
  it('monotone up, then down', () => {
    for (let f = 30; f < 70; f++) expect(pp(f + 1)).toBeGreaterThanOrEqual(pp(f));
    for (let f = 90; f < 130; f++) expect(pp(f + 1)).toBeLessThanOrEqual(pp(f));
  });
  it('no hold: peaks at the midpoint', () => {
    expect(pingPong(50, 0, 100, 10)).toBe(10);
    expect(pingPong(25, 0, 100, 10)).toBeCloseTo(5, 5);
  });
  it('rejects a hold that leaves no room to move', () => {
    expect(() => pingPong(0, 0, 10, 1, 10)).toThrow();
  });
});

describe('social stage geometry', () => {
  it('wide: the camera key sits at the frame centre and the stage is the whole frame', () => {
    expect(cameraCentre('wide', 1920, 1080)).toEqual({ x: 960, y: 540 });
    expect(stageView({ x: 720, y: 450, zoom: 2 }, 'wide', 1920, 1080)).toEqual({ l: 240, t: 180, r: 1200, b: 720 });
  });
  it('social: 120-px brand band on top, 260-px caption plaque at the bottom, the key at the stage centre', () => {
    expect(SOCIAL_FRAME).toEqual({ width: 1080, height: 1350, brandH: 120, captionH: 260 });
    expect(cameraCentre('social', 1080, 1350)).toEqual({ x: 540, y: 605 });
    const v = stageView({ x: 1000, y: 500, zoom: 2 }, 'social', 1080, 1350);
    expect(v).toEqual({ l: 1000 - 270, t: 500 - 242.5, r: 1000 + 270, b: 500 + 242.5 });
  });
  it('frameToUi inverts the camera: the key maps to the centre, frame px shrink by the zoom', () => {
    const cam = { x: 1000, y: 500, zoom: 2 };
    const c = cameraCentre('social', 1080, 1350);
    expect(frameToUi(540, 605, cam, c)).toEqual({ x: 1000, y: 500 });
    expect(frameToUi(0, 1090, cam, c)).toEqual({ x: 1000 - 270, y: 500 + 242.5 });
    expect(frameToUi(0, 120, cam, c)).toEqual({ x: 730, y: 257.5 });
  });
});

describe('socialKeyForView', () => {
  it('is the inverse of stageView in the social frame (round trip, both ways)', () => {
    for (const [l, t, z] of [[488, 190, 1.8], [704, 263.2, 1080 / 554], [261.6, 371.7, 1.9], [0, 0, 1.7]]) {
      const key = socialKeyForView(l, t, z);
      const v = stageView(key, 'social', 1080, 1350);
      expect(v.l).toBeCloseTo(l, 9);
      expect(v.t).toBeCloseTo(t, 9);
      expect(v.r - v.l).toBeCloseTo(SOCIAL_STAGE.width / z, 9);
      expect(v.b - v.t).toBeCloseTo(SOCIAL_STAGE.height / z, 9);
      expect(key.zoom).toBe(z);
    }
    const cam = { x: 1107, y: 614.7, zoom: 1.7 };
    const v = stageView(cam, 'social', 1080, 1350);
    const back = socialKeyForView(v.l, v.t, cam.zoom);
    expect(back.x).toBeCloseTo(cam.x, 9);
    expect(back.y).toBeCloseTo(cam.y, 9);
  });
  it('the stage is 1080×970 (the frame minus the two bands) and the key carries no `at`', () => {
    expect(SOCIAL_STAGE).toEqual({ width: 1080, height: 970 });
    expect('at' in socialKeyForView(0, 0, 2)).toBe(false);
  });
  it('keeps the stated edges exact (the scenes\' views did not move)', () => {
    expect(socialKeyForView(488, 190, 1.8)).toEqual({ x: 788, y: 190 + 485 / 1.8, zoom: 1.8 });
    expect(socialKeyForView(770 - 540 / 1.7, 190, 1.7).x).toBe(770);
  });
});

describe('cursor easing per segment', () => {
  const path = [
    { at: 0, x: 0, y: 0 },
    { at: 1, x: 300, y: 100 },
    { at: 1, x: 310, y: 100 },
    { at: 2, x: 0, y: 400 },
    { at: 3, x: 900, y: 50 },
  ];
  it('a path with a steady point gives exactly the cubic numbers on its other segments (old frames unchanged)', () => {
    const mixed = path.map((p, i) => (i === 4 ? { ...p, ease: 'steady' as const } : p));
    for (let f = 0; f <= 60; f++) expect(cursorAt(f, 30, mixed)).toEqual(cursorAt(f, 30, path));
    for (const f of [0, 30, 60, 90, 120]) expect(cursorAt(f, 30, mixed)).toEqual(cursorAt(f, 30, path));
    expect(cursorAt(70, 30, mixed)).not.toEqual(cursorAt(70, 30, path));
  });
  it('a steady hop tops out at π/2 × its average speed (cubic: 3×), still at rest at both ends', () => {
    const hop = (ease?: 'steady') => [
      { at: 0, x: 0, y: 0 },
      { at: 1, x: 300, y: 0, ease },
    ];
    const peak = (p: ReturnType<typeof hop>) =>
      Math.max(...Array.from({ length: 30 }, (_, f) => cursorAt(f + 1, 30, p).x - cursorAt(f, 30, p).x));
    expect(peak(hop('steady'))).toBeLessThan(10 * 1.58);
    expect(peak(hop())).toBeGreaterThan(10 * 2.5);
    expect(cursorAt(1, 30, hop('steady')).x).toBeLessThan(1);
    expect(300 - cursorAt(29, 30, hop('steady')).x).toBeLessThan(1);
  });
});

describe('maxPointerStep', () => {
  const cam = [{ at: 0, x: 0, y: 0, zoom: 2 }];
  const path = [
    { at: 0, x: 0, y: 0 },
    { at: 1 / 30, x: 10, y: 0 },
    { at: 2 / 30, x: 1000, y: 0 },
  ];
  it('is |Δ UI px| × zoom, at its frame', () => {
    expect(maxPointerStep(path, cam, 30, 0, 1)).toEqual({ max: 20, at: 0 });
    expect(maxPointerStep(path, cam, 30, 0, 2)).toEqual({ max: 1980, at: 1 });
  });
  it('skips steps the viewer never sees (out of view at both ends)', () => {
    const seen = (_: number, p: { x: number }) => p.x < 100;
    expect(maxPointerStep(path, cam, 30, 0, 3, seen).max).toBe(1980); // 10 → 1000 starts in view
    expect(maxPointerStep([{ at: 0, x: 500, y: 0 }, { at: 1 / 30, x: 900, y: 0 }], cam, 30, 0, 1, seen).max).toBe(0);
  });
});
