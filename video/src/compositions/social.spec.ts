import { describe, expect, it } from 'vitest';
import { SCENES_SOCIAL, TRANSITION, sceneStart, totalDuration } from '../timing';
import { brandBandRegion } from './social';
import { SOCIAL_FRAME } from '../kit/math';
import { outroFade } from '../scenes/Outro';

describe('social brand band', () => {
  const outro = sceneStart('outro', SCENES_SOCIAL);
  const area = (pts: { x: number; y: number }[]) =>
    Math.abs(pts.reduce((a, p, i) => a + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;
  const FULL = SOCIAL_FRAME.width * SOCIAL_FRAME.height;
  it('is whole from the first frame until the outro\'s transition starts', () => {
    expect(outro).toBe(1110);
    for (const f of [0, 1, 300, outro - 1, outro]) expect(area(brandBandRegion(f, SCENES_SOCIAL)!)).toBeCloseTo(FULL, 3);
  });
  it('leaves with the wipe\'s edge: the uncovered part shrinks every frame, gone once the outro has the frame', () => {
    let prev = FULL + 1;
    for (let f = outro + 1; f < outro + TRANSITION; f++) {
      const r = brandBandRegion(f, SCENES_SOCIAL);
      const a = r ? area(r) : 0;
      expect(a).toBeLessThanOrEqual(prev);
      prev = a;
    }
    // Half the frame is covered at the transition's midpoint (the eased curve is symmetric).
    expect(area(brandBandRegion(outro + TRANSITION / 2, SCENES_SOCIAL)!) / FULL).toBeCloseTo(0.5, 1);
    expect(brandBandRegion(outro + TRANSITION, SCENES_SOCIAL)).toBeNull();
    expect(brandBandRegion(totalDuration(SCENES_SOCIAL) - 1, SCENES_SOCIAL)).toBeNull();
  });
  it('a cut without an outro keeps the band to the end', () => {
    const noOutro = SCENES_SOCIAL.filter((s) => s.id !== 'outro');
    expect(brandBandRegion(totalDuration(noOutro) - 1, noOutro)).not.toBeNull();
  });
});

describe('outro fade', () => {
  it('fades over the last 15 frames of the cut it plays in: hero 105–120 (as delivered), social 75–90', () => {
    expect(outroFade(104, false)).toBe(1);
    expect(outroFade(105, false)).toBe(1);
    expect(outroFade(112.5, false)).toBeCloseTo(0.5);
    expect(outroFade(120, false)).toBe(0);
    expect(SCENES_SOCIAL.find((s) => s.id === 'outro')!.dur).toBe(90);
    expect(outroFade(75, true)).toBe(1);
    expect(outroFade(82.5, true)).toBeCloseTo(0.5);
    expect(outroFade(90, true)).toBe(0);
  });
});
