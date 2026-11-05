import { describe, expect, it } from 'vitest';
import { STATUS_ORDER } from '@crm/lib/types';
import { boardOwner, woHero } from '../fixtures';
import { boardState, COLUMNS_AFTER, COLUMNS_BEFORE } from './Board';

const at = (f: number) => boardState(f, 30);
const HERO = woHero[3].id;

describe('board scene state', () => {
  it('columns: the hero on top of «Запланирована» (wo-hero.3), after the drop on top of «В работе» (wo-hero.4)', () => {
    expect(COLUMNS_BEFORE.scheduled[0]).toBe(woHero[3]);
    expect(COLUMNS_AFTER.in_progress[0]).toBe(woHero[4]);
    expect(COLUMNS_AFTER.scheduled).toBe(boardOwner.scheduled);
    expect(COLUMNS_BEFORE.in_progress).toBe(boardOwner.in_progress);
    for (const s of STATUS_ORDER) {
      const n = (c: typeof COLUMNS_BEFORE) => c[s].filter((w) => w.id === HERO).length;
      expect(n(COLUMNS_BEFORE) + n(COLUMNS_AFTER)).toBe(s === 'scheduled' || s === 'in_progress' ? 1 : 0);
    }
  });

  it('counters: scheduled −1, in_progress +1, 3 frames after the drop press (75 → 78)', () => {
    expect(at(77).columns).toBe(COLUMNS_BEFORE);
    expect(at(78).columns).toBe(COLUMNS_AFTER);
    expect(at(78).columns.scheduled.length).toBe(at(77).columns.scheduled.length - 1);
    expect(at(78).columns.in_progress.length).toBe(at(77).columns.in_progress.length + 1);
  });

  it('press at 30: the source becomes the ghost and the floating card appears exactly over it (no jump)', () => {
    expect(at(29).ghostId).toBeUndefined();
    expect(at(29).float).toBeNull();
    expect(at(29).hoverId).toBe(HERO);
    const s = at(30);
    expect(s.ghostId).toBe(HERO);
    expect(s.float).toMatchObject({ x: 273, y: 208, scale: 1, rotate: 0, opacity: 1 });
    expect(at(40).float!.scale).toBeCloseTo(1.03);
    expect(at(40).float!.rotate).toBeCloseTo(1.5);
  });

  it('the floating card follows the cursor with the grab offset preserved', () => {
    for (const f of [30, 45, 60, 74]) {
      const s = at(f);
      // Offset = cursor − card top-left is constant through the drag.
      expect(s.float!.x - at(30).float!.x).toBeCloseTo(s.cursor.x - at(30).cursor.x);
      expect(s.float!.y - at(30).float!.y).toBeCloseTo(s.cursor.y - at(30).cursor.y);
    }
  });

  it('«В работе» shows the app `over` state only while the cursor is over it, until the drop lands', () => {
    expect(at(30).overStatus).toBeUndefined();
    expect(at(74).overStatus).toBe('in_progress');
    expect(at(77).overStatus).toBe('in_progress');
    expect(at(78).overStatus).toBeUndefined();
    const first = [...Array(48).keys()].map((i) => 30 + i).find((f) => at(f).overStatus);
    expect(first).toBeGreaterThan(30);
    expect(at(first!).cursor.x).toBeGreaterThanOrEqual(520);
  });

  it('drop: the floating card glides into the slot (no teleport), then hands over to the real card', () => {
    const a = at(77).float!;
    const b = at(78).float!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(1);
    expect(at(88).float).toMatchObject({ x: expect.closeTo(529, 0), y: expect.closeTo(208, 0) });
    expect(at(87).rowStyle('in_progress', 0, HERO)).toEqual({ opacity: 0 });
    expect(at(88).rowStyle('in_progress', 0, HERO)).toBeUndefined();
    expect(at(92).float).toBeNull();
  });

  it('neighbours: «Запланирована» closes the gap, «В работе» makes room — starting from their old places', () => {
    const other = boardOwner.in_progress[0].id;
    expect(at(78).rowStyle('scheduled', 0, boardOwner.scheduled[0].id)).toEqual({ transform: 'translateY(163px)' });
    expect(at(78).rowStyle('in_progress', 1, other)).toEqual({ transform: 'translateY(-163px)' });
    expect(at(77).rowStyle('in_progress', 0, other)).toBeUndefined();
    expect(at(100).rowStyle('scheduled', 0, boardOwner.scheduled[0].id)).toBeUndefined();
  });

  it('pan: still until 90, then the board scrolls to its end (116) by 140', () => {
    expect(at(90).scroll).toBe(0);
    expect(at(115).scroll).toBeGreaterThan(0);
    expect(at(140).scroll).toBe(116);
    expect(at(149).scroll).toBe(116);
  });
});
