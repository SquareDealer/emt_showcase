import { describe, expect, it } from 'vitest';
import { HERO, heroSchedule } from '../../../demo/seed/hero';
import { orderTotal } from '../../../client/src/lib/format';
import {
  DEMO_NOW,
  blocksWeek,
  boardMaster,
  boardOwner,
  calendarWeek,
  clientHero,
  dashboard,
  meta,
  searchByPrefix,
  settings,
  templatePreview,
  woHero,
} from './index';

const MIN = 60_000;
const freeSlot = heroSchedule(DEMO_NOW).freeSlot;
const slotStart = freeSlot.startsAt.getTime();
const slotEnd = slotStart + freeSlot.durationMin * MIN;
const overlapsSlot = (start: number, end: number) => start < slotEnd && slotStart < end;

describe('fixtures: meta', () => {
  it('exportedAt — это demoNow, не реальное время', () => {
    expect(meta.exportedAt).toBe(meta.demoNow);
    expect(DEMO_NOW.toISOString()).toBe(meta.demoNow);
  });
});

describe('fixtures: hero snapshots', () => {
  it('wo-hero.3: total_cached бэкенда === orderTotal клиента', () => {
    expect(woHero[3].total_cached).toBe(orderTotal(woHero[3]));
  });

  it('каждый снимок: total_cached === orderTotal', () => {
    for (const wo of woHero) expect(wo.total_cached).toBe(orderTotal(wo));
  });

  it('ids нормализованы, время — demoNow', () => {
    for (const wo of woHero) {
      expect(wo.id).toBe('hero-copy');
      const lines = [...(wo.labor_lines ?? []), ...(wo.part_lines ?? [])];
      for (const l of lines) {
        expect(l.id).toMatch(/^hero-line-\d+$/);
        expect(l.work_order_id).toBe('hero-copy');
      }
      expect(wo.created_at).toBe(meta.demoNow);
    }
    // by block, labor before parts, then sort — and stable across snapshots
    for (const wo of woHero.slice(1)) {
      expect(wo.labor_lines!.map((l) => l.id)).toEqual(['hero-line-1', 'hero-line-2']);
      expect(wo.part_lines!.map((p) => p.id)).toEqual(['hero-line-3', 'hero-line-4', 'hero-line-5', 'hero-line-6']);
    }
  });

  it('снимки идут по алгоритму: шаблон без масла → скидка строки → скидка наряда → в работе', () => {
    const [w0, w1, w2, w3, w4] = woHero;
    expect(w0.scheduled_at).toBe(freeSlot.startsAt.toISOString());
    expect(w0.scheduled_duration_min).toBe(120);
    expect(w0.assigned_master_id).toBe(HERO.masterId);
    const partIds = (w: typeof w1) => (w.part_lines ?? []).map((p) => p.part_template_id);
    expect(partIds(w1)).toContain(HERO.parts.chainKit);
    expect(partIds(w1)).not.toContain(HERO.parts.oil5w30);
    const kit = w2.part_lines!.find((p) => p.part_template_id === HERO.parts.chainKit)!;
    expect([kit.discount_type, kit.discount_value]).toEqual(['percent', 10]);
    expect([w3.discount_type, w3.discount_value]).toEqual(['percent', 5]);
    expect(w3.total_cached).toBeLessThan(w2.total_cached);
    expect(w2.total_cached).toBeLessThan(w1.total_cached);
    expect(w4.status).toBe('in_progress');
    expect(w4.total_cached).toBe(w3.total_cached);
  });

  it('превью шаблона — шаблон цепи, масло среди кандидатов', () => {
    expect(templatePreview.template_id).toBe(HERO.templates.timingChain);
    expect(templatePreview.parts.map((p) => p.part_template_id)).toContain(HERO.parts.oil5w30);
  });
});

describe('fixtures: board', () => {
  it('доска мастера — только его наряды', () => {
    const all = Object.values(boardMaster).flat();
    expect(all.length).toBeGreaterThan(0);
    for (const wo of all) expect(wo.assigned_master_id).toBe(HERO.masterId);
  });

  it('колонка «Выдана» усечена до 6', () => {
    expect(boardOwner.closed.length).toBe(6);
    expect(boardMaster.closed.length).toBeLessThanOrEqual(6);
  });
});

describe('fixtures: calendar week', () => {
  it('ни одно событие не пересекает свободное окно героя', () => {
    expect(calendarWeek.length).toBeGreaterThan(0);
    for (const wo of calendarWeek) {
      const start = new Date(wo.scheduled_at!).getTime();
      const dur = wo.scheduled_duration_min ?? settings.default_appointment_min;
      expect(overlapsSlot(start, start + dur * MIN), wo.id).toBe(false);
    }
  });

  it('резервы тоже не занимают окно', () => {
    for (const b of blocksWeek) {
      const start = new Date(b.starts_at).getTime();
      expect(overlapsSlot(start, start + b.duration_min * MIN), b.id).toBe(false);
    }
  });
});

describe('fixtures: dashboard', () => {
  it('6 месяцев выручки', () => {
    expect(dashboard.revenueByMonth.length).toBe(6);
  });

  it('выручка растёт минимум в 4 из 5 переходов', () => {
    const r = dashboard.revenueByMonth.map((m) => m.revenue);
    const ups = r.slice(1).filter((v, i) => v > r[i]).length;
    expect(ups).toBeGreaterThanOrEqual(4);
  });

  it('KPI сходятся: средний чек = выручка / наряды', () => {
    const { revenue, orders, avgTicket } = dashboard.kpi;
    expect(avgTicket).toBe(Math.round(revenue / orders));
    expect(dashboard.revenueByMonth.at(-1)!.revenue).toBe(revenue);
    expect(dashboard.topWorks.length).toBe(5);
  });
});

describe('fixtures: search and client', () => {
  it('есть выдача для каждого префикса VIN 1..7, и VIN героя находится', () => {
    for (let n = 1; n <= 7; n++) {
      const hits = searchByPrefix[HERO.r56.vin.slice(0, n)];
      expect(hits, `prefix ${n}`).toBeDefined();
    }
    const full = searchByPrefix[HERO.r56.vin.slice(0, 7)];
    expect(full.some((h) => h.type === 'vehicle' && h.vin === HERO.r56.vin)).toBe(true);
  });

  it('карточка клиента — герой, его R56 и история', () => {
    expect(clientHero.client.id).toBe(HERO.client.id);
    expect(clientHero.vehicles.map((v) => v.id)).toContain(HERO.r56.vehicleId);
    expect(clientHero.orders.map((o) => o.id)).toContain(HERO.diagnosticsOrderId);
    for (const o of clientHero.orders) expect(o.vehicle?.client?.id).toBe(HERO.client.id);
  });
});
