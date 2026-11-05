// Pure timeline of the social cut's own chrome (the scenes and sounds are the shared assembly's).
import { interpolate } from 'remotion';
import { sceneStart, type SceneDef } from '../timing';

/** The band's fade: the first BAND_FADE frames of the dashboard → outro transition — gone before the
 *  outro's own large mark (which enters at 0.5 opacity) shows through the cross-fade: no double logo. */
export const BAND_FADE = 6;

/** BrandBand opacity at an absolute frame: on until the outro enters, gone BAND_FADE frames into it. */
export function brandBandOpacity(frame: number, scenes: readonly SceneDef[]): number {
  if (!scenes.some((s) => s.id === 'outro')) return 1;
  const from = sceneStart('outro', scenes);
  return interpolate(frame, [from, from + BAND_FADE], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
