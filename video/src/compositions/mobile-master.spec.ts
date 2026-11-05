import { describe, expect, it } from 'vitest';
import { STATUS_ORDER } from '@crm/lib/types';
import { HERO } from '../../../demo/seed/hero';
import { boardMaster } from '../fixtures';
import {
  MASTER,
  MASTER_NAV,
  MOBILE_COLUMNS,
  MOBILE_FRAMES,
  PAN_MAX,
  TAP_CLOSE,
  TAP_OPEN,
  mobileMasterState,
} from './mobile-master';

const at = (f: number) => mobileMasterState(f, 30);

describe('mobile master: data', () => {
  it('the signed-in user is HERO.masterId, a plain master', () => {
    expect(MASTER.id).toBe(HERO.masterId);
    expect(MASTER.role).toBe('master');
  });

  it('nav is navForRole(master): no «Прайс-лист», no «Настройки», «Доска» kept', () => {
    const labels = MASTER_NAV.map((n) => n.label);
    expect(labels).not.toContain('Прайс-лист');
    expect(labels).not.toContain('Настройки');
    expect(MASTER_NAV.map((n) => n.to)).not.toContain('/price-list');
    expect(MASTER_NAV.map((n) => n.to)).not.toContain('/settings');
    expect(labels).toContain('Доска');
  });

  it('the board is board.master.json, and every order on it is assigned to HERO.masterId', () => {
    expect(MOBILE_COLUMNS).toBe(boardMaster);
    const all = STATUS_ORDER.flatMap((s) => MOBILE_COLUMNS[s]);
    expect(all.length).toBeGreaterThan(0);
    for (const wo of all) {
      expect(wo.assigned_master_id, wo.id).toBe(HERO.masterId);
      expect(wo.assigned_master?.id ?? HERO.masterId, wo.id).toBe(HERO.masterId);
    }
  });
});

describe('mobile master: timeline', () => {
  it('180 frames; taps on beats', () => {
    expect(MOBILE_FRAMES).toBe(180);
    expect(TAP_OPEN % 15).toBe(0);
    expect(TAP_CLOSE % 15).toBe(0);
  });

  it('starts closed and unpanned', () => {
    expect(at(0)).toMatchObject({ drawerOpen: false, drawer: 0, scroll: 0 });
    expect(at(TAP_OPEN + 2)).toMatchObject({ drawerOpen: false, drawer: 0 });
  });

  it('drawer slides in after the hamburger tap and is fully open through frame 60', () => {
    expect(at(TAP_OPEN + 3).drawerOpen).toBe(true);
    for (let f = 30; f <= 62; f++) expect(at(f), `frame ${f}`).toMatchObject({ drawerOpen: true, drawer: 1, scroll: 0 });
    for (let f = TAP_OPEN + 3; f < 30; f++) expect(at(f + 1).drawer).toBeGreaterThanOrEqual(at(f).drawer);
  });

  it('drawer closes after the close tap and stays closed before the pan', () => {
    for (let f = 63; f < 75; f++) expect(at(f + 1).drawer).toBeLessThanOrEqual(at(f).drawer);
    for (let f = 75; f < MOBILE_FRAMES; f++) expect(at(f), `frame ${f}`).toMatchObject({ drawerOpen: false, drawer: 0 });
  });

  it('board pans out to «Выдана» and back, never past the scroll range', () => {
    expect(at(75).scroll).toBe(0);
    expect(at(120).scroll).toBe(PAN_MAX);
    for (let f = 0; f < MOBILE_FRAMES; f++) {
      expect(at(f).scroll).toBeGreaterThanOrEqual(0);
      expect(at(f).scroll).toBeLessThanOrEqual(PAN_MAX);
    }
  });

  it('pans by whole pixels (crisp text; the last frame is pixel-identical to frame 0)', () => {
    for (let f = 0; f < MOBILE_FRAMES; f++) expect(Number.isInteger(at(f).scroll), `frame ${f}`).toBe(true);
  });

  it('pan range = 5 columns of 244 px + 4 gaps of 12 px − the 358-px board (390 − 2 × 16 padding)', () => {
    expect(PAN_MAX).toBe(5 * 244 + 4 * 12 - (390 - 2 * 16));
  });

  it('ends where it starts (loop-friendly): last frame = frame 0', () => {
    const last = at(MOBILE_FRAMES - 1);
    expect(last.drawerOpen).toBe(false);
    expect(last.scroll).toBe(0);
  });

  it('a tap mark only around the two taps', () => {
    expect(at(0).tap).toBeNull();
    expect(at(TAP_OPEN).tap).not.toBeNull();
    expect(at(TAP_CLOSE).tap).not.toBeNull();
    expect(at(120).tap).toBeNull();
    // under the drawer (z 400) for ☰, above it for its own «×»
    expect(at(TAP_OPEN).tap!.z).toBeLessThan(300);
    expect(at(TAP_OPEN).tap!.z).toBeGreaterThan(200);
    expect(at(TAP_CLOSE).tap!.z).toBeGreaterThan(400);
  });
});
