import { describe, expect, it } from 'vitest';
import { SCENES_SOCIAL, TRANSITION, sceneStart, totalDuration } from '../timing';
import { BAND_FADE, brandBandOpacity } from './social';
import { outroFade } from '../scenes/Outro';

describe('social brand band', () => {
  const outro = sceneStart('outro', SCENES_SOCIAL);
  it('is on from the first frame through the dashboard', () => {
    expect(outro).toBe(810);
    for (const f of [0, 1, 300, outro]) expect(brandBandOpacity(f, SCENES_SOCIAL)).toBe(1);
  });
  it('fades out in the first 6 frames of the dashboard → outro transition, before the outro\'s own mark shows', () => {
    expect(BAND_FADE).toBeLessThanOrEqual(6);
    expect(BAND_FADE).toBeLessThan(TRANSITION);
    expect(brandBandOpacity(outro + BAND_FADE / 2, SCENES_SOCIAL)).toBeCloseTo(0.5);
    for (let f = outro + BAND_FADE; f <= outro + TRANSITION; f++) expect(brandBandOpacity(f, SCENES_SOCIAL)).toBe(0);
    expect(brandBandOpacity(totalDuration(SCENES_SOCIAL) - 1, SCENES_SOCIAL)).toBe(0);
  });
  it('a cut without an outro keeps the band to the end', () => {
    const noOutro = SCENES_SOCIAL.filter((s) => s.id !== 'outro');
    expect(brandBandOpacity(totalDuration(noOutro) - 1, noOutro)).toBe(1);
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
