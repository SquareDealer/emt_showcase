// Pure timeline of the showcase assembly (Hero / HeroSocial): which transition joins each pair of
// scenes and on which absolute frames the sounds play. ShowcaseAssembly (Hero.tsx) renders exactly
// these values: assemblyPlan() and sfxCues().
import { linearTiming, type TransitionTiming } from '@remotion/transitions';
import { interpolate } from 'remotion';
import { DROP_AT } from '../scenes/Board';
import { LAND_AT } from '../scenes/Booking';
import { DC_KEY_FRAMES } from '../scenes/discounts';
import { DISCOUNTS_FROM, TOAST_IN } from '../scenes/Estimate';
import { TYPE_KEY_FRAMES } from '../scenes/Search';
import { FPS, SCENES, TRANSITION, clicksAbsolute, sceneStart, type SceneDef, type SceneId } from '../timing';

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
// Minimal SaaS sounds rendered with earshot's bank (public/audio/README.md: id, seed, role per file).

/** Level of each sound (Audio `volume`, linear) — the one table, set by earshot readings of the hero mix
 *  (change S): clicks and keys ≥ 8 LU under the pops, the ding and the whooshes; the bright clicks no
 *  longer the mix's peaks (0.45 → 0.32); the ding (0.25 → 0.32) carries the estimate block's landing on
 *  its own, the pop (0.32 → 0.28) the booking and board landings. */
export const SFX_VOLUME = { click: 0.32, key: 0.22, whoosh: 0.28, pop: 0.28, ding: 0.32 } as const;

export type SfxName = keyof typeof SFX_VOLUME;

/** Sample rate of every SFX file (earshot renders 48 kHz stereo 24-bit). */
export const SFX_RATE = 48000;

/** Each sound's takes, used round-robin by cue index: the file and its length in samples
 *  (assembly.spec reads the WAV headers). */
export const SFX_TAKES: Record<SfxName, readonly { src: string; samples: number }[]> = {
  click: [
    { src: 'audio/click_1.wav', samples: 1554 },
    { src: 'audio/click_2.wav', samples: 1554 },
  ],
  key: [
    { src: 'audio/key_1.wav', samples: 7646 },
    { src: 'audio/key_2.wav', samples: 7613 },
    { src: 'audio/key_3.wav', samples: 7174 },
    { src: 'audio/key_4.wav', samples: 6830 },
  ],
  whoosh: [{ src: 'audio/whoosh_1.wav', samples: 36960 }],
  pop: [
    { src: 'audio/pop_1.wav', samples: 8621 },
    { src: 'audio/pop_2.wav', samples: 8662 },
  ],
  ding: [{ src: 'audio/ding_1.wav', samples: 15216 }],
};

/** Whole frames a file needs to play to its end. */
export const takeFrames = (samples: number) => Math.ceil((samples * FPS) / SFX_RATE);

/** A whoosh starts this many frames into its slide: its apex (≈ 135 ms ≈ 4 f in) lands mid-transition. */
export const WHOOSH_LEAD = 3;
/** A pop starts a frame before its landing: its peak (≈ 42 ms) is on the landing frame. */
export const POP_LEAD = 1;

const absolute = (scenes: readonly SceneDef[], id: SceneId, local: readonly number[]): number[] => {
  const s = scenes.find((x) => x.id === id);
  if (!s) return [];
  const start = sceneStart(id, scenes);
  return local.filter((f) => f >= 0 && f < s.dur).map((f) => start + f);
};

/** Click sounds: the same table the cursors press on (Review Focus 5). */
export function heroClickSfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return clicksAbsolute(scenes);
}

/** Key sounds: one per typed character — the discounts Estimate types («10», «5»; ./discounts) and
 *  the VIN Search types into the palette — in time order. */
export function heroKeySfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return [
    ...absolute(scenes, 'estimate', DC_KEY_FRAMES.map((t) => DISCOUNTS_FROM + t)),
    ...absolute(scenes, 'search', TYPE_KEY_FRAMES),
  ].sort((a, b) => a - b);
}

/** Whoosh: WHOOSH_LEAD frames into each slide transition (the entering scene's start + 3). */
export function heroWhooshSfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return assemblyPlan(scenes).flatMap((p) =>
    p.type === 'transition' && p.kind === 'slide' ? [sceneStart(p.to, scenes) + WHOOSH_LEAD] : [],
  );
}

/** Where content lands with a pop, from each scene's own constant: the booked order replaces the ghost
 *  (Booking LAND_AT), the dragged card drops into «В работе» (Board DROP_AT, 3 frames after the drop
 *  click). The estimate block (Estimate APPLY_AT) gets no pop: its success toast's ding, 2 frames
 *  later, marks it — a pop there piled click, pop and ding into 170 ms. */
export function contentLandings(scenes: readonly SceneDef[] = SCENES): number[] {
  return [...absolute(scenes, 'booking', [LAND_AT]), ...absolute(scenes, 'board', [DROP_AT])].sort((a, b) => a - b);
}

/** Pop: a frame before each landing (POP_LEAD). */
export function heroPopSfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return contentLandings(scenes).map((f) => f - POP_LEAD);
}

/** Ding: the success toast appears (Estimate TOAST_IN, «Блок добавлен в смету», 2 frames after the block
 *  lands at APPLY_AT — the ding marks that landing; Booking has no toast). */
export function heroDingSfx(scenes: readonly SceneDef[] = SCENES): number[] {
  return absolute(scenes, 'estimate', [TOAST_IN]);
}

export type SfxCue = { name: SfxName; src: string; volume: number; frames: number; at: number };

const SFX_FRAMES: Record<SfxName, (scenes: readonly SceneDef[]) => number[]> = {
  click: heroClickSfx,
  key: heroKeySfx,
  whoosh: heroWhooshSfx,
  pop: heroPopSfx,
  ding: heroDingSfx,
};

/** Every sound of the cut, in one list: clicks, keys, whooshes, pops, then dings (absolute frames;
 *  each role's takes alternate by cue index). The assembly renders exactly this list, so a test on it
 *  is a test on what plays. */
export function sfxCues(scenes: readonly SceneDef[]): SfxCue[] {
  return (Object.keys(SFX_FRAMES) as SfxName[]).flatMap((name) =>
    SFX_FRAMES[name](scenes).map((at, i): SfxCue => {
      const take = SFX_TAKES[name][i % SFX_TAKES[name].length];
      return { name, src: take.src, volume: SFX_VOLUME[name], frames: takeFrames(take.samples), at };
    }),
  );
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
