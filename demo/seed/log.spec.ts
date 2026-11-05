import { HERO, heroSchedule } from './hero';
import { createProgressLog } from './log';
import { mskAt } from './time';

it('summary prints every HERO id and the free slot', () => {
  const lines: string[] = []; createProgressLog((l) => lines.push(l)).summary({ work_orders: 800 }, heroSchedule(mskAt('2026-11-04', 12)));
  const text = lines.join('\n');
  for (const id of [HERO.client.id, HERO.r56.vehicleId, HERO.bigOrder.id, HERO.fleetClientId, HERO.pdfOrderId, HERO.diagnosticsOrderId]) expect(text).toContain(id);
  expect(text).toContain('2026-11-05 14:00');
});
