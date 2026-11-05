import { describe, expect, it } from 'vitest';
import { captionBandFits } from './Background';

describe('Background caption band', () => {
  it('only in the 1080×1350 social frame — not wide, not MobileMaster 390×844', () => {
    expect(captionBandFits('social', 1080, 1350)).toBe(true);
    expect(captionBandFits('social', 390, 844)).toBe(false);
    expect(captionBandFits('wide', 1920, 1080)).toBe(false);
    expect(captionBandFits('wide', 1600, 1000)).toBe(false);
  });
});
