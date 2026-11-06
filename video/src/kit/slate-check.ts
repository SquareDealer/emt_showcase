// Test helper: is a UI rect clear of the wide chapter slate (frame bottom-left, SLATE_W_MAX × SLATE_H)
// under a scene's camera at a frame?
import type { ChapterKey } from '../chapters';
import { SLATE_TOP, SLATE_W_MAX } from './ChapterTitle';
import { cameraAt, cameraCentre, uiToFrame, type CamKey } from './math';

export type UiRect = { x: number; y: number; w: number; h: number };

/** Each hero slate's width (frame px), measured on full-scale stills (the dark run's right edge at
 *  y 1060); 2 px of margin added. */
export const SLATE_W: Record<ChapterKey, number> = {
  booking: 1043,
  generation: 814,
  block: 1099,
  board: 883,
  docs: 1107,
  vin: 1044,
  dashboard: 1044,
};

export function clearOfSlate(r: UiRect, keys: CamKey[], frame: number, key?: ChapterKey, fps = 30): boolean {
  const cam = cameraAt(frame, fps, keys);
  const c = cameraCentre('wide', 1920, 1080);
  const a = uiToFrame(r.x, r.y, cam, c);
  const b = uiToFrame(r.x + r.w, r.y + r.h, cam, c);
  return b.y <= SLATE_TOP || a.x >= (key ? SLATE_W[key] : SLATE_W_MAX);
}
