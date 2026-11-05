// Pure timeline of the showcase assembly (Hero / HeroSocial): which transition joins each pair of
// scenes and on which absolute frames the sounds play. ShowcaseAssembly (Hero.tsx) renders exactly
// these values: assemblyPlan() and sfxCues().
import { linearTiming, type TransitionTiming } from '@remotion/transitions';
import { interpolate } from 'remotion';
import { TYPE_KEY_FRAMES } from '../scenes/Search';
import { SCENES, TRANSITION, clicksAbsolute, sceneStart, type SceneDef, type SceneId } from '../timing';

export type TransitionKind = 'fade' | 'slide';

/** The plan's pairs; `slide` is `slide({ direction: 'from-right' })`. */
const PAIRS: Partial<Record<`${SceneId}>${SceneId}`, TransitionKind>> = {
  'intro>booking': 'fade',
  'booking>estimate': 'fade',
  'estimate>board': 'slide',
  'board>docs': 'slide',
  'docs>search': 'fade',
  'search>dashboard': 'slide',
  'dashboard>outro': 'fade',
};

/** Transition between two adjacent scenes; a pair the plan doesn't list (social board→search) fades. */
export function transitionFor(a: SceneId, b: SceneId): TransitionKind {
  return PAIRS[`${a}>${b}`] ?? 'fade';
}

/** Every transition: linear, TRANSITION frames — the overlap `sceneStart()` already assumes. */
export const TRANSITION_TIMING: TransitionTiming = linearTiming({ durationInFrames: TRANSITION });

export type PlanItem =
  | { type: 'scene'; id: SceneId; dur: number }
  | { type: 'transition'; kind: TransitionKind; timing: TransitionTiming; from: SceneId; to: SceneId };

/** TransitionSeries children in order: scene, transition, scene, … */
export function assemblyPlan(scenes: readonly SceneDef[]): PlanItem[] {
  return scenes.flatMap((s, i): PlanItem[] => {
    const scene: PlanItem = { type: 'scene', id: s.id, dur: s.dur };
    if (i === 0) return [scene];
    const prev = scenes[i - 1].id;
    return [{ type: 'transition', kind: transitionFor(prev, s.id), timing: TRANSITION_TIMING, from: prev, to: s.id }, scene];
  });
}

/** The series' length as TransitionSeries computes it: Σ scenes − Σ transitions. */
export function planDuration(plan: readonly PlanItem[], fps: number): number {
  return plan.reduce((sum, p) => (p.type === 'scene' ? sum + p.dur : sum - p.timing.getDurationInFrames({ fps })), 0);
}

// ---- sound effects (absolute frames) ----

export const SFX = {
  click: { src: 'audio/click.wav', volume: 0.5, frames: 15 },
  key: { src: 'audio/key.wav', volume: 0.2, frames: 5 },
  whoosh: { src: 'audio/whoosh.wav', volume: 0.3, frames: 15 },
} as const;

/** Click sounds: the same table the cursors press on (Review Focus 5). */
export function heroClickSfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return clicksAbsolute(scenes);
}

/** Key sounds: one per character Search types into the palette. */
export function heroKeySfx(scenes: readonly SceneDef[] = SCENES): number[] {
  if (!scenes.some((s) => s.id === 'search')) return [];
  const start = sceneStart('search', scenes);
  return TYPE_KEY_FRAMES.map((f) => start + f);
}

/** Whoosh: at the start of each slide transition, i.e. the entering scene's first frame. */
export function heroWhooshSfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return assemblyPlan(scenes).flatMap((p) => (p.type === 'transition' && p.kind === 'slide' ? [sceneStart(p.to, scenes)] : []));
}

export type SfxName = keyof typeof SFX;
export type SfxCue = { name: SfxName; src: string; volume: number; frames: number; at: number };

/** Every sound of the cut, in one list: clicks, then keys, then whooshes (absolute frames). The
 *  assembly renders exactly this list, so a test on it is a test on what plays. */
export function sfxCues(scenes: readonly SceneDef[]): SfxCue[] {
  const cue = (name: SfxName) => (at: number): SfxCue => ({ name, ...SFX[name], at });
  return [
    ...heroClickSfx(scenes).map(cue('click')),
    ...heroKeySfx(scenes).map(cue('key')),
    ...heroWhooshSfx(scenes).map(cue('whoosh')),
  ];
}

// ---- music ----

/** Music level: fade in over the first second, hold 0.8, fade out over the last 3 s. */
export function musicVolume(frame: number, total: number): number {
  return interpolate(frame, [0, 30, total - 90, total], [0, 0.8, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** `musicOffsetFrames` → Audio placement: > 0 skips that many frames of the track, < 0 starts it later. */
export function musicPlacement(offset: number): { from: number; trimBefore: number } {
  return { from: Math.max(0, -offset), trimBefore: Math.max(0, offset) };
}
