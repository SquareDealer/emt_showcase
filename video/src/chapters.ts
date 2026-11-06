// The film's chapters: which scene carries which title, and each title's place in a cut. The copy is
// in schema.ts (`chapters`); the frames each scene shows its titles on are the scene's own TITLES.
import { SCENES, SCENES_SOCIAL, type SceneDef, type SceneId } from './timing';

export type ChapterKey = 'booking' | 'generation' | 'block' | 'board' | 'docs' | 'vin' | 'dashboard';

/** The titles of each scene, in the order they show (the estimate carries two chapters). */
export const SCENE_CHAPTERS: Partial<Record<SceneId, readonly ChapterKey[]>> = {
  booking: ['booking'],
  estimate: ['generation', 'block'],
  board: ['board'],
  docs: ['docs'],
  search: ['vin'],
  dashboard: ['dashboard'],
};

/** The chapters of a cut, in order. */
export const chaptersOf = (scenes: readonly SceneDef[]): ChapterKey[] => scenes.flatMap((s) => SCENE_CHAPTERS[s.id] ?? []);

/** «n / total» of a chapter in a cut (hero: 7 chapters; social has no docs: 6). */
export function chapterIndex(key: ChapterKey, scenes: readonly SceneDef[]): { n: number; total: number } {
  const all = chaptersOf(scenes);
  const i = all.indexOf(key);
  if (i < 0) throw new Error(`chapter ${key} is not in this cut`);
  return { n: i + 1, total: all.length };
}

/** The cut a scene is drawn in, by layout (the social cut is the only portrait one). */
export const cutScenes = (social: boolean): readonly SceneDef[] => (social ? SCENES_SOCIAL : SCENES);
