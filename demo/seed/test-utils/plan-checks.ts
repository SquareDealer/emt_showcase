import { PricingService } from '../../../src/work-orders/pricing.service';
import { LABOR_RATE_NEW, LABOR_RATE_OLD } from '../config';
import { HERO, heroSchedule } from '../hero';
import type { DemoPlan } from '../plan';
import { mskAt, mskDay, mskMinutes, subMonthsDay } from '../time';
import type { WorkOrderPlan, WorkOrderStatus } from '../types';

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

export function overlaps(aStart: Date, aDur: number, bStart: Date, bDur: number): boolean {
  const a0 = aStart.getTime();
  const b0 = bStart.getTime();
  return a0 < b0 + bDur * MS_MIN && b0 < a0 + aDur * MS_MIN;
}

/** The status table of the brief. Overdue orders (forced `scheduled`) are allowed here and counted separately. */
export function allowedStatuses(w: Pick<WorkOrderPlan, 'scheduled_at' | 'scheduled_duration_min'>, now: Date): WorkOrderStatus[] {
  const start = w.scheduled_at.getTime();
  const end = start + w.scheduled_duration_min * MS_MIN;
  const t = now.getTime();
  if (start > t) return ['scheduled'];
  const overdue: WorkOrderStatus[] = start >= t - 2 * MS_DAY ? ['scheduled'] : [];
  if (t < end) return ['in_progress', ...overdue];
  const age = (t - end) / MS_DAY;
  if (age <= 2) return ['closed', 'done', 'waiting', 'in_progress', ...overdue];
  if (age <= 3) return ['closed', 'done', 'waiting', ...overdue];
  if (age <= 7) return ['closed', 'waiting', 'done', ...overdue];
  return ['closed', 'done'];
}

/** Everything the brief requires of a plan for any `--now`. Returns failures instead of throwing, so a test shows them all. */
export function planViolations(plan: DemoPlan): string[] {
  const now = plan.demoNow;
  const wos = plan.workOrders;
  const pricing = new PricingService();
  const out: string[] = [];
  const bad = (w: WorkOrderPlan, msg: string) => out.push(`${w.id} ${msg}`);
  const change = mskAt(subMonthsDay(mskDay(now), 3), 0);
  const vehicles = new Map(plan.vehicles.map((v) => [v.id, v]));
  const clients = new Map(plan.clients.map((c) => [c.id, c]));
  const masters = new Set(plan.staff.filter((s) => s.role === 'master').map((s) => s.id));

  if (wos.length < 760 || wos.length > 840) out.push(`order count ${wos.length}`);
  if (new Set(wos.map((w) => w.id)).size !== wos.length) out.push('duplicate order ids');

  for (const w of wos) {
    if (!allowedStatuses(w, now).includes(w.status)) bad(w, `status ${w.status} not allowed`);
    if (!(w.created_at <= w.scheduled_at)) bad(w, 'created after scheduled');
    if (!(w.created_at <= now && w.updated_at <= now && w.created_at <= w.updated_at)) bad(w, 'created/updated order');
    if (w.status === 'closed') {
      if (!(w.closed_at && w.scheduled_at <= w.closed_at && w.closed_at <= w.updated_at)) bad(w, 'closed_at order');
      if (w.total_frozen !== w.total_cached || w.paid_amount !== w.total_cached) bad(w, 'closed not frozen/paid');
    } else if (w.total_frozen !== null || w.closed_at !== null || w.paid_amount !== 0) bad(w, 'open order frozen/paid');
    if (w.total_cached !== pricing.computeTotal(w.labor, w.parts, w.discount_type, w.discount_value)) bad(w, 'total mismatch');
    for (const l of w.labor) {
      if (l.rate_snapshot !== (l.created_at < change ? LABOR_RATE_OLD : LABOR_RATE_NEW)) bad(w, 'rate snapshot');
    }
    if (w.labor.length + w.parts.length === 0) bad(w, 'no lines');
    const v = vehicles.get(w.vehicle_id);
    const c = clients.get(w.client_id);
    if (!v || !c || v.client_id !== c.id) bad(w, 'vehicle/client mismatch');
    else if (!(v.created_at <= w.created_at && c.created_at <= w.created_at)) bad(w, 'vehicle/client created after order');
    if (!masters.has(w.assigned_master_id)) bad(w, 'not assigned to a master');
    const m0 = mskMinutes(w.scheduled_at);
    if (m0 < 8 * 60 || m0 + w.scheduled_duration_min > 20 * 60) bad(w, 'outside working hours');
    if (w.scheduled_duration_min < 30 || w.scheduled_duration_min > 480 || w.scheduled_duration_min % 30) bad(w, 'duration');
  }

  // Masters are never double-booked, and personal reserves are respected.
  const byMaster = new Map<string, WorkOrderPlan[]>();
  for (const w of wos) byMaster.set(w.assigned_master_id, [...(byMaster.get(w.assigned_master_id) ?? []), w]);
  for (const [id, list] of byMaster) {
    list.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());
    for (let i = 1; i < list.length; i++) {
      const p = list[i - 1];
      if (overlaps(p.scheduled_at, p.scheduled_duration_min, list[i].scheduled_at, list[i].scheduled_duration_min)) bad(list[i], `overlaps ${p.id}`);
    }
    for (const b of plan.blocks.filter((x) => x.user_id === id)) {
      for (const w of list) if (overlaps(w.scheduled_at, w.scheduled_duration_min, b.starts_at, b.duration_min)) bad(w, `overlaps block ${b.id}`);
    }
  }

  // Odometer: per vehicle, never back in time and never above the current mileage.
  const byVehicle = new Map<string, WorkOrderPlan[]>();
  for (const w of wos) byVehicle.set(w.vehicle_id, [...(byVehicle.get(w.vehicle_id) ?? []), w]);
  // A car is never in two overlapping orders.
  for (const list of byVehicle.values()) {
    const sorted = [...list].sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());
    for (let i = 1; i < sorted.length; i++) {
      for (let j = i - 1; j >= 0; j--) {
        if (overlaps(sorted[j].scheduled_at, sorted[j].scheduled_duration_min, sorted[i].scheduled_at, sorted[i].scheduled_duration_min)) bad(sorted[i], `same car as ${sorted[j].id}`);
      }
    }
  }
  const heroF60 = byVehicle.get(HERO.bigOrder.vehicleId)?.length ?? 0;
  if (heroF60 > 6) out.push(`hero F60 has ${heroF60} orders`);
  for (const [vid, list] of byVehicle) {
    list.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());
    list.forEach((w, i) => {
      if (i > 0 && w.odometer_km < list[i - 1].odometer_km) bad(w, 'odometer goes back');
      if (w.odometer_km > (vehicles.get(vid)?.mileage ?? 0)) bad(w, 'odometer above mileage');
    });
  }

  const overdue = wos.filter((w) => w.status === 'scheduled' && w.scheduled_at < now);
  if (overdue.length !== 2) out.push(`overdue scheduled: ${overdue.length}`);
  for (const w of overdue) if (w.scheduled_at.getTime() + w.scheduled_duration_min * MS_MIN > now.getTime()) bad(w, 'overdue order is still running');
  if (!wos.some((w) => w.status === 'waiting')) out.push('no waiting order');

  const big = wos.find((w) => w.id === HERO.bigOrder.id);
  const diag = wos.find((w) => w.id === HERO.diagnosticsOrderId);
  const pdf = wos.find((w) => w.id === HERO.pdfOrderId);
  const { busyDay, freeSlot } = heroSchedule(now);
  if (!big || big.status !== 'in_progress' || mskDay(big.scheduled_at) !== busyDay || big.assigned_master_id !== HERO.masterId) out.push('hero big order');
  if (!diag || diag.status !== 'closed' || diag.vehicle_id !== HERO.r56.vehicleId) out.push('hero diagnostics order');
  if (!pdf || pdf.status !== 'closed' || pdf.discount_type !== null) out.push('hero pdf order');
  if (wos.filter((w) => w.client_id === HERO.client.id).length !== 12) out.push('hero client visits');
  if (wos.filter((w) => mskDay(w.scheduled_at) === busyDay).length < 9) out.push('busy day < 9');
  if (wos.filter((w) => mskDay(w.scheduled_at) === mskDay(freeSlot.startsAt)).length < 4) out.push('next weekday < 4');
  if (wos.some((w) => overlaps(w.scheduled_at, w.scheduled_duration_min, freeSlot.startsAt, freeSlot.durationMin))) out.push('free slot taken');
  return out;
}
