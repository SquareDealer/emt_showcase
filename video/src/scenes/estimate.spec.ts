import { describe, expect, it } from 'vitest';
import { orderTotal } from '@crm/lib/format';
import { woHero } from '../fixtures';
import { estimateState, newLineIds } from './Estimate';

const at = (f: number) => estimateState(f, 30);
/** Lines of wo-hero.1 absent in wo-hero.0, in rowStyle order (works, then parts). */
const NEW = newLineIds(woHero[0], woHero[1]);

describe('estimate scene state', () => {
  it('new lines come from the fixtures: the template work + its parts without the oil', () => {
    expect(NEW).toHaveLength(1 + (woHero[1].part_lines ?? []).length);
    expect(NEW[0]).toBe(woHero[1].labor_lines!.at(-1)!.id);
  });

  it('switches snapshots 3 frames after the confirm press (153), on the kit discount (195) and the order discount (225)', () => {
    expect(at(152).wo.labor_lines).toBe(woHero[0].labor_lines);
    expect(at(153).wo).toBe(woHero[1]);
    expect(at(195).wo).toBe(woHero[2]);
    expect(at(224).wo).toBe(woHero[2]);
    expect(at(225).wo.part_lines).toBe(woHero[3].part_lines);
  });

  it('totals: 2 200 → 44 400 → 42 910 → counts to 40 764,50 by 255', () => {
    expect(at(0).wo.total_cached).toBe(2200);
    expect(at(160).wo.total_cached).toBe(44400);
    expect(at(200).wo.total_cached).toBe(42910);
    expect(at(225).wo.total_cached).toBe(orderTotal(woHero[2]));
    expect(at(255).wo.total_cached).toBe(40764.5);
    expect(at(269).wo.total_cached).toBe(orderTotal(woHero[3]));
  });

  it('the sheet: open 80–152 (still under the confirm press), all parts until the oil click, button 47 600 → 42 200', () => {
    expect(at(79).modalOpacity).toBe(0);
    expect(at(100).modalOpacity).toBeCloseTo(1);
    expect(at(152).modalOpacity).toBeCloseTo(1);
    expect(at(153).modalOpacity).toBe(0);
    expect(at(119).picked.size).toBe(5);
    expect(at(120).picked.size).toBe(4);
    expect(at(119).buttonTotal).toBe(47600);
    expect(at(132).buttonTotal).toBe(42200);
  });

  it('only the lines new in snapshot 1 animate in, staggered by 3 frames; their headers fade with them', () => {
    const old = woHero[0].labor_lines![0].id;
    expect(at(155).rowStyle(old)).toBeUndefined();
    expect(at(155).rowStyle(NEW[0])?.opacity).toBe(0);
    const s = at(159);
    expect(s.rowStyle(NEW[0])?.opacity).toBeGreaterThan(s.rowStyle(NEW[1])!.opacity as number);
    expect(at(185).rowStyle(NEW.at(-1)!)).toBeUndefined();
    expect(at(153).headerMasks).toEqual([1, 1]);
    expect(at(185).headerMasks).toEqual([0, 0]);
    expect(at(150).headerMasks).toEqual([0, 0]);
  });

  it('discount type «%» 3 frames after the 210 click, then «5»', () => {
    expect(at(212).discountDraft).toBeUndefined();
    expect(at(213).discountDraft).toEqual({ type: 'percent', value: '' });
    expect(at(218).discountDraft).toEqual({ type: 'percent', value: '5' });
    expect(at(240).discountDraft).toEqual({ type: 'percent', value: '5' });
  });
});
