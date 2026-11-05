import { describe, expect, it } from 'vitest';
import {
  FRAMES_PER_BEAT,
  SCENES,
  SCENES_SOCIAL,
  clicksAbsolute,
  sceneStart,
  totalDuration,
} from './timing';

describe('timing', () => {
  it('hero total is 1110 frames', () => expect(totalDuration()).toBe(1110));
  it('booking starts at 60', () => expect(sceneStart('booking')).toBe(60));
  it('every scene start is on the beat grid (hero and social)', () => {
    for (const s of SCENES) expect(sceneStart(s.id) % FRAMES_PER_BEAT).toBe(0);
    for (const s of SCENES_SOCIAL) expect(sceneStart(s.id, SCENES_SOCIAL) % FRAMES_PER_BEAT).toBe(0);
  });
  it('every absolute click is on the beat grid', () => {
    for (const c of clicksAbsolute()) expect(c % FRAMES_PER_BEAT).toBe(0);
  });
  it('social drops intro and docs and shortens booking', () => {
    const ids: string[] = SCENES_SOCIAL.map((s) => s.id);
    expect(ids).not.toContain('intro');
    expect(ids).not.toContain('docs');
    expect(SCENES_SOCIAL.find((s) => s.id === 'booking')?.dur).toBe(150);
    expect(totalDuration(SCENES_SOCIAL)).toBeGreaterThan(0);
  });
});
