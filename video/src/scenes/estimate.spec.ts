import { describe, expect, it } from 'vitest';
import { orderTotal } from '@crm/lib/format';
import { woHero } from '../fixtures';
import { estimateState } from './Estimate';

const at = (f: number) => estimateState(f, 30);

describe('estimate scene state', () => {
  it('switches snapshots on the confirm (150), the kit discount (195) and the order discount (225)', () => {
    expect(at(149).wo.id).toBe(woHero[0].id);
    expect(at(149).wo.labor_lines).toBe(woHero[0].labor_lines);
    expect(at(150).wo).toBe(woHero[1]);
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

  it('the sheet: open 80–149, all parts until the oil click (120), button 47 600 → 42 200', () => {
    expect(at(79).modalOpacity).toBe(0);
    expect(at(100).modalOpacity).toBeCloseTo(1);
    expect(at(150).modalOpacity).toBe(0);
    expect(at(119).picked.size).toBe(5);
    expect(at(120).picked.size).toBe(4);
    expect(at(119).buttonTotal).toBe(47600);
    expect(at(132).buttonTotal).toBe(42200);
  });

  it('only the lines new in snapshot 1 animate in, staggered by 3 frames', () => {
    const old = woHero[0].labor_lines![0].id;
    expect(at(152).rowStyle(old)).toBeUndefined();
    expect(at(152).rowStyle('hero-line-2')?.opacity).toBe(0);
    expect(at(156).rowStyle('hero-line-2')?.opacity).toBeGreaterThan(at(156).rowStyle('hero-line-3')!.opacity as number);
    expect(at(180).rowStyle('hero-line-6')).toBeUndefined();
  });

  it('types «5» into the order discount from 210', () => {
    expect(at(209).discountDraft).toBeUndefined();
    expect(at(210).discountDraft).toEqual({ type: 'percent', value: '' });
    expect(at(224).discountDraft).toEqual({ type: 'percent', value: '5' });
  });
});
