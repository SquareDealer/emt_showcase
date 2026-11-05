// Pure timeline of the social cut's own chrome (the scenes and sounds are the shared assembly's).
import { interpolate } from 'remotion';
import { TRANSITION, sceneStart, type SceneDef } from '../timing';

/** BrandBand opacity at an absolute frame: on until the outro enters, gone once its transition is over. */
export function brandBandOpacity(frame: number, scenes: readonly SceneDef[]): number {
  if (!scenes.some((s) => s.id === 'outro')) return 1;
  const from = sceneStart('outro', scenes);
  return interpolate(frame, [from, from + TRANSITION], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}
