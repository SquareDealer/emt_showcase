import { addDays, isWorkday, mskAt, mskDay } from './time';

/**
 * Contract: the video plan imports HERO and heroSchedule (its Remotion bundle is webpack 5, without
 * Node's `crypto`). Keep imports to ./time and ./config: the ids are literals of `demoId(scope, key)`,
 * and hero.spec.ts checks each one against demoId.
 */
export const HERO = {
  client: { id: 'c42601d6-92c3-57bd-bc73-fcdad7897046', name: 'Ковалёв Артём Сергеевич' as const, phone: '+7 (555) 010-56-56' as const },
  r56: {
    vehicleId: '884787df-de44-5f5e-9433-faaec4bc7aa7',
    vin: 'WMWSV32050TZ56421' as const,
    plate: 'М056РК 77' as const,
    model: 'Cooper S' as const,
    year: 2011 as const,
  },
  secondVehicleId: '2c048705-f215-5def-aba5-05b4c9a5e728',
  diagnosticsOrderId: 'ce67ea41-ab1c-5b9e-a60e-b8f079906691',
  bigOrder: {
    id: '1e5ef750-2752-5d09-8cf1-0d1333f76619',
    vehicleId: '116df04b-e370-59e7-9c9d-193700588c63',
    clientId: '9e0779f1-f195-5307-91d2-afb317048978',
  },
  fleetClientId: '6d3cc3e3-ea88-5566-a079-83816b0d038c',
  pdfOrderId: '74cda438-c364-5c3c-bd73-4b0df27e7554',
  masterId: 'c8c535e3-52bd-5960-b6f1-ea4d14ff119b',
  logins: { owner: 'owner' as const, receptionist: 'reception1' as const, master: 'master1' as const },
  templates: { timingChain: 'd8ed88a0-2843-503c-ba4f-c56c5d80025f', engineDiagnostics: '71c9ed38-ef30-5bf3-9f22-08d9004680ed' },
  parts: {
    oil5w30: '7d05ea43-cac0-571f-807e-67d59d0fc30a',
    chainKit: '60f53037-7828-57a1-8653-549f3e6c4a47',
    tensioner: 'f20bf823-5036-533a-97c9-635fe84eb07c',
    tensionerR56: '7feaf7a6-3fbd-5cd4-87f7-d239e602df2a',
  },
};

/** busyDay is the demo "today"; the free slot is the next weekday after it, 14:00 MSK, 2 h. */
export function heroSchedule(demoNow: Date): { busyDay: string; freeSlot: { startsAt: Date; durationMin: 120 } } {
  const busyDay = mskDay(demoNow);
  let d = addDays(busyDay, 1);
  while (!isWorkday(d)) d = addDays(d, 1);
  return { busyDay, freeSlot: { startsAt: mskAt(d, 14), durationMin: 120 } };
}
