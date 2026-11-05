import { describe, expect, it } from 'vitest';
import { defaultProps } from '../schema';
import { PLAQUE_FONT, plaqueText } from './Callout';

const NB = '\u00a0';

describe('social plaque text', () => {
  it('type size is 52–56 px (plan)', () => {
    expect(PLAQUE_FONT).toBeGreaterThanOrEqual(52);
    expect(PLAQUE_FONT).toBeLessThanOrEqual(56);
  });
  it('a dash or an arrow never starts a line, a short preposition or a number never ends one', () => {
    expect(plaqueText('Работа и её запчасти — одним блоком')).toBe(`Работа и${NB}её запчасти${NB}— одним блоком`);
    expect(plaqueText('Свободное окно → запись в 2 клика')).toBe(`Свободное окно${NB}→ запись в${NB}2${NB}клика`);
    expect(plaqueText('Любая машина по VIN — за секунду')).toBe(`Любая машина по${NB}VIN${NB}— за${NB}секунду`);
    expect(plaqueText('10% + 5% = 14,5%, до копейки')).toBe(`10% + 5% = 14,5%, до${NB}копейки`);
  });
  it('every default caption keeps its words (only spaces change)', () => {
    for (const t of Object.values(defaultProps.callouts)) expect(plaqueText(t).replaceAll(NB, ' ')).toBe(t);
  });
});
