import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardView } from './DashboardView';
import type { DashboardData } from './types';
import { money } from '../../lib/format';

const data: DashboardData = {
  month: 'ноябрь 2026',
  kpi: { revenue: 1284500, orders: 47, avgTicket: 27329, revenueDeltaPct: 12.4 },
  revenueByMonth: [
    { month: 'июн', revenue: 820000 },
    { month: 'июл', revenue: 910000 },
    { month: 'авг', revenue: 760000 },
    { month: 'сен', revenue: 1050000 },
    { month: 'окт', revenue: 1142000 },
    { month: 'ноя', revenue: 1284500 },
  ],
  masterLoad: [
    { name: 'Алексей Громов', hours: 34, capacityHours: 40 },
    { name: 'Игорь Соколов', hours: 27, capacityHours: 40 },
  ],
  topWorks: [
    { name: 'Замена цепи ГРМ', count: 9, revenue: 284000 },
    { name: 'Диагностика двигателя', count: 21, revenue: 63000 },
    { name: 'Замена масла и фильтра', count: 18, revenue: 54000 },
    { name: 'Замена свечей зажигания', count: 11, revenue: 33000 },
    { name: 'Замена тормозных колодок', count: 7, revenue: 49000 },
  ],
};

const render = (p: { progress?: number; highlight?: 'revenue' | 'load' | 'top' } = {}) =>
  renderToStaticMarkup(<DashboardView data={data} {...p} />);

const barHeights = (html: string) =>
  [...html.matchAll(/<rect[^>]*data-demo="rev-bar"[^>]*>/g)].map((m) =>
    Number(/height="([\d.]+)"/.exec(m[0])![1]),
  );

describe('DashboardView', () => {
  it('выводит выручку через money()', () => {
    expect(render().replace(/&nbsp;/g, ' ')).toContain(money(data.kpi.revenue));
  });

  it('рисует 6 столбцов выручки', () => {
    expect(barHeights(render())).toHaveLength(6);
  });

  it('progress=0.5 даёт половину высоты последнего столбца', () => {
    const full = barHeights(render({ progress: 1 })).at(-1)!;
    const half = barHeights(render({ progress: 0.5 })).at(-1)!;
    expect(full).toBeGreaterThan(0);
    expect(half).toBeCloseTo(full / 2, 1);
  });

  it('highlight=load ставит data-highlight на блок загрузки', () => {
    const html = render({ highlight: 'load' });
    expect(html).toMatch(/data-demo="load"[^>]*data-highlight=""|data-highlight=""[^>]*data-demo="load"/);
    expect(render()).not.toContain('data-highlight');
  });

  it('progress=0 даёт нулевую высоту, по умолчанию = progress=1', () => {
    expect(barHeights(render({ progress: 0 })).every((h) => h === 0)).toBe(true);
    expect(render()).toBe(render({ progress: 1 }));
  });

  it('ширина полос загрузки и топа масштабируется progress', () => {
    const widths = (html: string, k: string) =>
      [...html.matchAll(new RegExp(`data-demo="${k}"[^>]*style="width:([\\d.]+)%`, 'g'))].map((m) =>
        Number(m[1]),
      );
    for (const k of ['load-bar', 'top-bar']) {
      const full = widths(render({ progress: 1 }), k);
      const half = widths(render({ progress: 0.5 }), k);
      expect(full).toHaveLength(k === 'load-bar' ? 2 : 5);
      full.forEach((w, i) => expect(half[i]).toBeCloseTo(w / 2, 5));
    }
  });

  it('отрицательная динамика: «−» и класс down', () => {
    const html = renderToStaticMarkup(
      <DashboardView data={{ ...data, kpi: { ...data.kpi, revenueDeltaPct: -3.5 } }} />,
    );
    expect(html).toMatch(/dash-delta mono down/);
    expect(html).toContain('−3,5%');
  });

  it.each([['revenue'], ['top']] as const)('highlight=%s подсвечивает свой блок', (h) => {
    const html = render({ highlight: h });
    expect(html.match(/data-highlight=""/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`data-demo="${h}"[^>]*data-highlight=""`));
  });

  it('топ работ отсортирован по выручке', () => {
    const html = render();
    const order = ['Замена цепи ГРМ', 'Диагностика двигателя', 'Замена масла и фильтра', 'Замена тормозных колодок', 'Замена свечей зажигания'];
    const idx = order.map((n) => html.indexOf(n));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('подписи 1 050 000 и 1 142 000 различаются', () => {
    const labels = [...render().matchAll(/class="dash-val mono[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(labels).toHaveLength(6);
    expect(new Set(labels).size).toBe(6);
  });
});
