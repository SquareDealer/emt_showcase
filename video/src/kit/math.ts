// Pure kit math: every value is a function of (frame, fps, data). Time in keys is in seconds,
// coordinates are UI pixels of the 1440×900 CRM window.
import { Easing, interpolate, spring } from 'remotion';

export type CamKey = { at: number; x: number; y: number; zoom: number };
export type CursorPoint = { at: number; x: number; y: number };

const CAM_EASE = Easing.bezier(0.65, 0, 0.35, 1);
const CURSOR_EASE = Easing.inOut(Easing.cubic);

function along<T extends { at: number }>(
  t: number,
  keys: T[],
  fields: (keyof T & string)[],
  easing: (n: number) => number,
): Record<string, number> {
  if (keys.length === 0) throw new Error('keys must not be empty');
  const out: Record<string, number> = {};
  if (keys.length === 1) {
    for (const f of fields) out[f] = keys[0][f] as number;
    return out;
  }
  // interpolate needs strictly increasing inputs: nudge duplicate/unsorted times apart (a step).
  const times: number[] = [];
  for (const k of keys) times.push(times.length && k.at <= times[times.length - 1] ? times[times.length - 1] + 1e-6 : k.at);
  for (const f of fields) {
    out[f] = interpolate(
      t,
      times,
      keys.map((k) => k[f] as number),
      { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }
  return out;
}

export function cameraAt(frame: number, fps: number, keys: CamKey[]): { x: number; y: number; zoom: number } {
  const r = along(frame / fps, keys, ['x', 'y', 'zoom'], CAM_EASE);
  return { x: r.x, y: r.y, zoom: r.zoom };
}

export function cursorAt(frame: number, fps: number, path: CursorPoint[]): { x: number; y: number } {
  const r = along(frame / fps, path, ['x', 'y'], CURSOR_EASE);
  return { x: r.x, y: r.y };
}

const PRESS_FRAMES = 6;
const RING_FRAMES = 18;

/** `press`: cursor scale 1→0.82→1 over 6 frames; `ring`: 0..1 growth over 18 frames, else 0. */
export function clickState(frame: number, clickFrames: number[], fps: number): { press: number; ring: number } {
  let d = -1;
  for (const c of clickFrames) {
    const dc = frame - c;
    if (dc >= 0 && (d < 0 || dc < d)) d = dc;
  }
  if (d < 0) return { press: 1, ring: 0 };
  const press = interpolate(d, [0, PRESS_FRAMES / 2, PRESS_FRAMES], [1, 0.82, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ring =
    d < RING_FRAMES
      ? spring({ frame: d, fps, config: { damping: 200 }, durationInFrames: RING_FRAMES })
      : 0;
  return { press, ring };
}

export function typed(frame: number, startFrame: number, text: string, framesPerChar = 5): string {
  const n = Math.floor((frame - startFrame) / framesPerChar);
  return n <= 0 ? '' : text.slice(0, Math.min(n, text.length));
}

export function countUp(frame: number, fromFrame: number, toFrame: number, from: number, to: number): number {
  if (toFrame <= fromFrame) return Math.round((frame < fromFrame ? from : to + Number.EPSILON) * 100) / 100;
  const v = interpolate(frame, [fromFrame, toFrame], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Layers of LoopCrossfade at output frame `frame` (0 <= frame < D): the base clip(frame), plus for
 * frame < overlap the tail continuation clip(D + frame) on top at opacity 1 - frame/overlap.
 */
export function loopLayers(
  frame: number,
  D: number,
  overlap: number,
): { clipFrame: number; opacity: number }[] {
  const layers = [{ clipFrame: frame, opacity: 1 }];
  if (frame < overlap) layers.push({ clipFrame: D + frame, opacity: 1 - frame / overlap });
  return layers;
}
