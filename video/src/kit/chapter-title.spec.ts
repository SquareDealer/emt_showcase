import { describe, expect, it } from 'vitest';
import { chapterIndex, chaptersOf, SCENE_CHAPTERS } from '../chapters';
import { defaultProps } from '../schema';
import { SCENES, SCENES_SOCIAL } from '../timing';
import {
  LINE_INK,
  SLATE_BG,
  SOCIAL_TYPE,
  TITLE_IN,
  TITLE_OUT,
  WIDE_TYPE,
  indexLabel,
  titleReadable,
  titleState,
  titleText,
  titleVisible,
} from './ChapterTitle';

const NB = ' ';

describe('chapter title timeline', () => {
  it('hidden before `at`, every line in by at + TITLE_IN, held, gone by out + TITLE_OUT', () => {
    const [at, out] = [45, 150];
    expect(titleVisible(at - 1, at, out)).toBe(false);
    expect(titleState(at, at, out)).toEqual({ panel: 0, marker: 0, title: 0, line: 0 });
    expect(titleReadable(at + TITLE_IN - 1, at, out)).toBe(false);
    for (let f = at + TITLE_IN; f <= out; f++) expect(titleReadable(f, at, out)).toBe(true);
    expect(titleReadable(out + 2, at, out)).toBe(false);
    expect(titleState(out + TITLE_OUT, at, out)).toEqual({ panel: 0, marker: 0, title: 0, line: 0 });
    expect(titleVisible(out + TITLE_OUT, at, out)).toBe(false);
  });
  it('line by line: the index row, then the title, then the second line; the exit is faster than the entrance', () => {
    const [at, out] = [0, 200];
    const firstIn = (k: 'marker' | 'title' | 'line') => [...Array(40).keys()].find((f) => titleState(f, at, out)[k] > 0)!;
    expect(firstIn('marker')).toBeLessThan(firstIn('title'));
    expect(firstIn('title')).toBeLessThan(firstIn('line'));
    expect(TITLE_OUT).toBeLessThan(TITLE_IN);
  });
  it('no overshoot: every value stays in 0…1 (soft ease, no bounce)', () => {
    for (let f = -5; f < 260; f++) for (const v of Object.values(titleState(f, 0, 200))) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('chapter title type and colour', () => {
  it('wide: title 44–48 px, second line 22–24 px; social (50 % preview): title ≥ 52, line ≥ 30', () => {
    expect(WIDE_TYPE.title).toBeGreaterThanOrEqual(44);
    expect(WIDE_TYPE.title).toBeLessThanOrEqual(48);
    expect(WIDE_TYPE.line).toBeGreaterThanOrEqual(22);
    expect(WIDE_TYPE.line).toBeLessThanOrEqual(24);
    expect(SOCIAL_TYPE.title).toBeGreaterThanOrEqual(52);
    expect(SOCIAL_TYPE.line).toBeGreaterThanOrEqual(30);
  });
  it('the second line has ≥ 4.5:1 on the slate', () => {
    // oklch(0.78 0.012 240) ≈ sRGB (178, 184, 192); the slate rgb(16, 20, 26).
    expect(LINE_INK).toBe('oklch(0.78 0.012 240)');
    expect(SLATE_BG).toBe('rgb(16, 20, 26)');
    const lum = (r: number, g: number, b: number) =>
      [r, g, b]
        .map((c) => c / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (lum(178, 184, 192) + 0.05) / (lum(16, 20, 26) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('chapter copy and numbering', () => {
  it('the brief\'s seven titles verbatim, each with one second line; the discounts have none', () => {
    expect(Object.values(defaultProps.chapters).map((c) => c.title)).toEqual([
      'Свободное окно → запись в 2 клика',
      'Цена — под поколение',
      'Работа и её запчасти — одним блоком',
      'Статус — одним движением',
      'Заказ-наряд в PDF — из тех же данных',
      'Любая машина по VIN — за секунду',
      'Владелец видит выручку и загрузку',
    ]);
    for (const c of Object.values(defaultProps.chapters)) expect(c.line.length).toBeGreaterThan(10);
    expect(Object.keys(defaultProps.chapters)).not.toContain('discounts');
  });
  it('hero «01 / 07» … «07 / 07» in scene order; social (no docs) «01 / 06» … «06 / 06»', () => {
    expect(chaptersOf(SCENES)).toEqual(['booking', 'generation', 'block', 'board', 'docs', 'vin', 'dashboard']);
    expect(chaptersOf(SCENES_SOCIAL)).toEqual(['booking', 'generation', 'block', 'board', 'vin', 'dashboard']);
    expect(chapterIndex('booking', SCENES)).toEqual({ n: 1, total: 7 });
    expect(chapterIndex('dashboard', SCENES)).toEqual({ n: 7, total: 7 });
    expect(chapterIndex('vin', SCENES_SOCIAL)).toEqual({ n: 5, total: 6 });
    expect(indexLabel(1, 7)).toBe('01 / 07');
    expect(() => chapterIndex('docs', SCENES_SOCIAL)).toThrow();
    expect(Object.values(SCENE_CHAPTERS).flat()).toHaveLength(7);
  });
  it('social line breaks: a dash or an arrow never starts a line, a short word or a number never ends one', () => {
    expect(titleText('Работа и её запчасти — одним блоком')).toBe(`Работа и${NB}её запчасти${NB}— одним блоком`);
    expect(titleText('Свободное окно → запись в 2 клика')).toBe(`Свободное окно${NB}→ запись в${NB}2${NB}клика`);
    for (const c of Object.values(defaultProps.chapters)) {
      expect(titleText(c.title).replaceAll(NB, ' ')).toBe(c.title);
      expect(titleText(c.line).replaceAll(NB, ' ')).toBe(c.line);
    }
  });
});
