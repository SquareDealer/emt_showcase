export const FPS = 30;
export const BPM = 120;
export const FRAMES_PER_BEAT = 15;
/** Every scene-to-scene transition (kit/CameraWipe): 1 s, two beats — the scene starts stay on the
 *  15-frame grid because every duration is a multiple of 15. */
export const TRANSITION = 30;

export const SCENES = [
  { id: 'intro', dur: 90 },
  { id: 'booking', dur: 210 },
  { id: 'estimate', dur: 465 },
  { id: 'board', dur: 180 },
  { id: 'docs', dur: 180 },
  { id: 'search', dur: 225 },
  { id: 'dashboard', dur: 210 },
  { id: 'outro', dur: 120 },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];
export type SceneDef = { readonly id: SceneId; readonly dur: number };

/** Social durations that differ from the hero (the cut stays ≤ 40 s): the dashboard's social shots
 *  take a beat each (load settled at 90, held under its chapter title), no hero load move at 150; the
 *  outro holds its title from 48 and fades out over its last 15 frames. */
export const SOCIAL_DUR: Partial<Record<SceneId, number>> = { dashboard: 180, outro: 90 };

/** Social cut (≤ 40 s): no intro/docs, a shorter dashboard and outro. */
export const SCENES_SOCIAL: readonly SceneDef[] = SCENES.filter((s) => s.id !== 'intro' && s.id !== 'docs').map(
  (s) => ({ id: s.id, dur: SOCIAL_DUR[s.id] ?? s.dur }),
);

/** Absolute start frame of a scene: sum of previous durations minus one transition per index. */
export function sceneStart(id: SceneId, scenes: readonly SceneDef[] = SCENES): number {
  const idx = scenes.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Unknown scene: ${id}`);
  let sum = 0;
  for (let i = 0; i < idx; i++) sum += scenes[i].dur;
  return sum - TRANSITION * idx;
}

export function totalDuration(scenes: readonly SceneDef[] = SCENES): number {
  return scenes.reduce((a, s) => a + s.dur, 0) - TRANSITION * (scenes.length - 1);
}

/** Scene-local click frames; filled by the scene tasks. Single source for cursor and click sounds. */
export const SCENE_CLICKS: Record<SceneId, number[]> = {
  intro: [],
  booking: [75, 105],
  estimate: [45, 75, 120, 150, 300, 315, 345, 375],
  board: [30, 75],
  docs: [],
  search: [90],
  dashboard: [],
  outro: [],
};

export type ClickTable = Record<SceneId, number[]>;

export function clicksAbsolute(scenes: readonly SceneDef[] = SCENES, clicks: ClickTable = SCENE_CLICKS): number[] {
  return scenes.flatMap((s) => clicks[s.id].map((f) => sceneStart(s.id, scenes) + f));
}

/** Absolute clicks that are not on the beat grid (must be empty). */
export function offBeatClicks(scenes: readonly SceneDef[] = SCENES, clicks: ClickTable = SCENE_CLICKS): number[] {
  return clicksAbsolute(scenes, clicks).filter((c) => c % FRAMES_PER_BEAT !== 0);
}
