import { demoId } from './ids';
import { addDays, isWorkday, mskAt, mskDay } from './time';

/** Contract: the video plan imports HERO and heroSchedule. Keep imports to ./ids, ./time, ./config. */
export const HERO = {
  client: { id: demoId('client', 'hero'), name: 'Ковалёв Артём Сергеевич' as const, phone: '+7 (555) 010-56-56' as const },
  r56: {
    vehicleId: demoId('vehicle', 'hero-r56'),
    vin: 'WMWSV32050TZ56421' as const,
    plate: 'М056РК 77' as const,
    model: 'Cooper S' as const,
    year: 2011 as const,
  },
  secondVehicleId: demoId('vehicle', 'hero-rav4'),
  diagnosticsOrderId: demoId('wo', 'hero-diagnostics'),
  bigOrder: {
    id: demoId('wo', 'hero-big'),
    vehicleId: demoId('vehicle', 'hero-f60'),
    clientId: demoId('client', 'hero-f60'),
  },
  fleetClientId: demoId('client', 'hero-fleet'),
  pdfOrderId: demoId('wo', 'hero-pdf'),
  masterId: demoId('user', 'master1'),
  logins: { owner: 'owner' as const, receptionist: 'reception1' as const, master: 'master1' as const },
  templates: { timingChain: demoId('task', 'timing-chain-n14'), engineDiagnostics: demoId('task', 'engine-diagnostics') },
  parts: {
    oil5w30: demoId('part', 'oil-5w30-1l'),
    chainKit: demoId('part', 'chain-kit-n14'),
    tensioner: demoId('part', 'chain-tensioner'),
    tensionerR56: demoId('part', 'chain-tensioner-r56'),
  },
};

/** busyDay is the demo "today"; the free slot is the next weekday after it, 14:00 MSK, 2 h. */
export function heroSchedule(demoNow: Date): { busyDay: string; freeSlot: { startsAt: Date; durationMin: 120 } } {
  const busyDay = mskDay(demoNow);
  let d = addDays(busyDay, 1);
  while (!isWorkday(d)) d = addDays(d, 1);
  return { busyDay, freeSlot: { startsAt: mskAt(d, 14), durationMin: 120 } };
}
