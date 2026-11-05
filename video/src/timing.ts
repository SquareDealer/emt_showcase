export const FPS = 30;
export const BPM = 120;
export const FRAMES_PER_BEAT = 15;
export const TRANSITION = 15;

export const SCENES = [
  { id: 'intro', dur: 75 },
  { id: 'booking', dur: 180 },
  { id: 'estimate', dur: 270 },
  { id: 'board', dur: 150 },
  { id: 'docs', dur: 120 },
  { id: 'search', dur: 150 },
  { id: 'dashboard', dur: 150 },
  { id: 'outro', dur: 120 },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];
export type SceneDef = { readonly id: SceneId; readonly dur: number };

/** Social cut: no intro/docs, shorter booking. */
export const SCENES_SOCIAL: readonly SceneDef[] = SCENES.filter((s) => s.id !== 'intro' && s.id !== 'docs').map(
  (s) => (s.id === 'booking' ? { id: s.id, dur: 150 } : { id: s.id, dur: s.dur }),
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
  estimate: [45, 75, 120, 150],
  board: [],
  docs: [],
  search: [],
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
