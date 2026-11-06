import { describe, expect, it } from 'vitest';
import { SCENE_CHAPTERS } from '../chapters';
import { MIN_HOLD, TITLE_IN, TITLE_OUT } from '../kit/ChapterTitle';
import type { TitleCue } from '../kit/SceneTitles';
import { TITLES as BOARD } from '../scenes/Board';
import { TITLES as BOOKING } from '../scenes/Booking';
import { SOCIAL_TITLES as DASHBOARD_SOCIAL, TITLES as DASHBOARD } from '../scenes/Dashboard';
import { TITLES as DOCS } from '../scenes/Docs';
import { TITLES as ESTIMATE } from '../scenes/Estimate';
import { TITLES as SEARCH } from '../scenes/Search';
import { FRAMES_PER_BEAT, SCENES, SCENES_SOCIAL, TRANSITION, sceneStart, type SceneDef, type SceneId } from '../timing';

const WIDE: Partial<Record<SceneId, readonly TitleCue[]>> = {
  booking: BOOKING,
  estimate: ESTIMATE,
  board: BOARD,
  docs: DOCS,
  search: SEARCH,
  dashboard: DASHBOARD,
};
const SOCIAL: Partial<Record<SceneId, readonly TitleCue[]>> = { ...WIDE, dashboard: DASHBOARD_SOCIAL };

/** Every title of a cut in absolute frames: in, readable from, out, gone. */
export function timetable(scenes: readonly SceneDef[], cues: Partial<Record<SceneId, readonly TitleCue[]>>) {
  return scenes.flatMap((s) =>
    (cues[s.id] ?? []).map((c) => {
      const start = sceneStart(s.id, scenes);
      return { scene: s.id, dur: s.dur, key: c.key, at: c.at, out: c.out, abs: start + c.at, readable: start + c.at + TITLE_IN, absOut: start + c.out, gone: start + c.out + TITLE_OUT };
    }),
  );
}

describe('chapter titles: the timetable', () => {
  for (const [name, scenes, cues] of [
    ['hero', SCENES, WIDE],
    ['social', SCENES_SOCIAL, SOCIAL],
  ] as const) {
    const rows = timetable(scenes, cues);
    it(`${name}: each scene shows its chapters, in order`, () => {
      for (const s of scenes) expect((cues[s.id] ?? []).map((c) => c.key)).toEqual(SCENE_CHAPTERS[s.id] ?? []);
    });
    it(`${name}: every title enters on the beat (absolute frames), after the scene's transition in`, () => {
      for (const r of rows) {
        expect(r.abs % FRAMES_PER_BEAT).toBe(0);
        if (r.scene !== scenes[0].id) expect(r.at).toBeGreaterThanOrEqual(TRANSITION);
      }
    });
    it(`${name}: every title is fully readable ≥ 2.5 s and gone before the scene's transition out`, () => {
      for (const r of rows) {
        expect(r.out - (r.at + TITLE_IN)).toBeGreaterThanOrEqual(MIN_HOLD);
        expect(r.out + TITLE_OUT).toBeLessThanOrEqual(r.dur - TRANSITION);
      }
    });
    it(`${name}: one title at a time`, () => {
      for (let i = 1; i < rows.length; i++) expect(rows[i].abs).toBeGreaterThanOrEqual(rows[i - 1].gone);
    });
  }
  it('hero timetable (absolute frames: in / readable / out / gone)', () => {
    expect(timetable(SCENES, WIDE).map((r) => [r.key, r.abs, r.readable, r.absOut, r.gone])).toEqual([
      ['booking', 105, 128, 210, 222],
      ['generation', 270, 293, 375, 387],
      ['block', 390, 413, 495, 507],
      ['board', 705, 728, 810, 822],
      ['docs', 855, 878, 960, 972],
      ['vin', 1050, 1073, 1155, 1167],
      ['dashboard', 1215, 1238, 1320, 1332],
    ]);
  });
  it('social timetable', () => {
    expect(timetable(SCENES_SOCIAL, SOCIAL).map((r) => [r.key, r.abs, r.readable, r.absOut, r.gone])).toEqual([
      ['booking', 45, 68, 150, 162],
      ['generation', 210, 233, 315, 327],
      ['block', 330, 353, 435, 447],
      ['board', 645, 668, 750, 762],
      ['vin', 840, 863, 945, 957],
      ['dashboard', 990, 1013, 1095, 1107],
    ]);
  });
});
