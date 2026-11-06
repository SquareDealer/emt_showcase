// Pure timeline of the social cut's own chrome (the scenes and sounds are the shared assembly's).
import { CAM_EASE } from '../kit/math';
import { wipeNormal, wipeOffset, wipePolygon, type Pt } from '../kit/CameraWipe';
import { SOCIAL_FRAME } from '../kit/math';
import { TRANSITION, sceneStart, type SceneDef } from '../timing';
import { transitionFor } from './assembly';

/**
 * The brand band over the frame at an absolute frame: whole until the outro's transition starts, then
 * the part of the band the incoming outro has not yet covered — it leaves with the wipe's edge, so the
 * outro's own large mark (on the revealed side) and the band's never show side by side. `null` once the
 * wipe has passed (the outro has the frame), else the band's visible polygon (frame px).
 */
export function brandBandRegion(frame: number, scenes: readonly SceneDef[]): Pt[] | null {
  const { width: w, height: h } = SOCIAL_FRAME;
  const full: Pt[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const i = scenes.findIndex((s) => s.id === 'outro');
  if (i < 1) return full;
  const spec = transitionFor(scenes[i - 1].id, 'outro');
  if (spec.kind !== 'wipe') throw new Error('the outro is wiped in');
  const from = sceneStart('outro', scenes);
  if (frame < from) return full;
  if (frame >= from + TRANSITION) return null;
  const e = CAM_EASE((frame - from) / TRANSITION);
  const n = wipeNormal(spec.from);
  // The band keeps the side the edge has not reached: p·n ≤ c, i.e. p·(−n) ≥ −c.
  const c = wipeOffset(e, n, w, h);
  const rest = wipePolygon(-c, { x: -n.x, y: -n.y }, w, h);
  return rest.length >= 3 ? rest : null;
}
