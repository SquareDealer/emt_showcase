import { TrendingUp, TrendingDown, BarChart3, Wrench, Trophy } from 'lucide-react';
import { money, num } from '../../lib/format';
import type { DashboardData } from './types';
import './dashboard.css';

export interface DashboardViewProps {
  data: DashboardData;
  /** Доля «вырастания» столбцов и полос, 0..1. */
  progress?: number;
  /** Demo: marks the block with data-highlight. */
  highlight?: 'revenue' | 'load' | 'top';
  /** Подпись динамики выручки после процента. */
  deltaLabel?: string;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hl = (on: boolean) => (on ? '' : undefined);

/** Одна единица для всех столбцов, чтобы разные значения не получали одинаковую подпись. */
function compact(n: number): string {
  return `${num(Math.round(n / 1000))} тыс`;
}

export function DashboardView({ data, progress = 1, highlight, deltaLabel = 'к прошлому месяцу' }: DashboardViewProps) {
  const p = clamp01(progress);
  const { kpi, revenueByMonth: rev, masterLoad, topWorks: topRaw } = data;
  const topWorks = [...topRaw].sort((x, y) => y.revenue - x.revenue);

  const max = Math.max(...rev.map((r) => r.revenue), 1) * 1.06;
  const up = kpi.revenueDeltaPct >= 0;
  const topMax = Math.max(...topWorks.map((w) => w.revenue), 1);
  const n = Math.max(rev.length, 1);
  const slot = 100 / n;
  const barW = slot * 0.58;
  /** Неполный (текущий) месяц — последняя точка; отчётный месяц KPI выделен акцентом. */
  const partialIdx = data.partialLast ? rev.length - 1 : -1;
  const reportIdx = data.partialLast ? rev.length - 2 : rev.length - 1;
  const barClass = (i: number) =>
    i === partialIdx ? 'dash-bar partial' : i === reportIdx ? 'dash-bar current' : 'dash-bar';
  const valClass = (i: number) =>
    `dash-val mono${i === reportIdx ? ' current' : i === partialIdx ? ' partial' : ''}`;

  return (
    <div className="page dash" data-demo="dashboard">
      <header className="dash-head">
        <h1 className="page-title">Обзор</h1>
        <span className="dash-month">{data.month}</span>
      </header>

      <div className="dash-kpis" data-demo="kpis">
        <div className="dash-kpi">
          <span className="dash-kpi-label">Выручка</span>
          <span className="dash-kpi-val mono">{money(kpi.revenue)}</span>
          <span className={`dash-delta mono ${up ? 'up' : 'down'}`}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {up ? '+' : '−'}
            {num(Math.abs(kpi.revenueDeltaPct))}% {deltaLabel}
          </span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Закрытых нарядов</span>
          <span className="dash-kpi-val mono">{num(kpi.orders)}</span>
        </div>
        <div className="dash-kpi">
          <span className="dash-kpi-label">Средний чек</span>
          <span className="dash-kpi-val mono">{money(kpi.avgTicket)}</span>
        </div>
      </div>

      <div className="dash-grid">
        <section
          className="dash-panel dash-revenue"
          data-demo="revenue"
          data-highlight={hl(highlight === 'revenue')}
        >
          <h2 className="dash-panel-title">
            <BarChart3 size={16} /> Выручка по месяцам
          </h2>
          <div className="dash-plot-wrap">
            <div className="dash-plot" role="img" aria-label="Выручка по месяцам">
              <span className="dash-gridline" style={{ bottom: '50%' }} />
              <span className="dash-gridline" style={{ bottom: `${100 / 1.06}%` }} />
              <svg className="dash-bars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {rev.map((r, i) => {
                  const h = (r.revenue / max) * 100 * p;
                  return (
                    <rect
                      key={r.month + i}
                      data-demo="rev-bar"
                      className={barClass(i)}
                      vectorEffect={i === partialIdx ? 'non-scaling-stroke' : undefined}
                      x={slot * i + (slot - barW) / 2}
                      y={100 - h}
                      width={barW}
                      height={h}
                    />
                  );
                })}
              </svg>
              {rev.map((r, i) => (
                <span
                  key={r.month + i}
                  className={valClass(i)}
                  style={{
                    left: `${slot * i + slot / 2}%`,
                    bottom: `calc(${(r.revenue / max) * 100 * p}% + 6px)`,
                    opacity: p,
                  }}
                >
                  {compact(r.revenue)}
                </span>
              ))}
            </div>
            <div className="dash-ticks">
              {rev.map((r, i) => (
                <span key={r.month + i} className={i === partialIdx ? 'dash-tick partial' : 'dash-tick'}>
                  {r.month}
                  {i === partialIdx ? '*' : ''}
                </span>
              ))}
            </div>
            {partialIdx >= 0 ? (
              <p className="dash-note" data-demo="rev-note">
                * текущий месяц, по сегодняшний день
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="dash-panel dash-load"
          data-demo="load"
          data-highlight={hl(highlight === 'load')}
        >
          <h2 className="dash-panel-title">
            <Wrench size={16} /> Загрузка мастеров
          </h2>
          <ul className="dash-rows">
            {masterLoad.map((m, i) => {
              const ratio = m.capacityHours > 0 ? m.hours / m.capacityHours : 0;
              return (
                <li key={m.name + i} className="dash-row">
                  <div className="dash-row-head">
                    <span className="dash-row-name">{m.name}</span>
                    <span className="dash-row-num mono">
                      {num(m.hours)} / {num(m.capacityHours)} ч · {Math.round(ratio * 100)}%
                    </span>
                  </div>
                  <div className="dash-track" aria-hidden>
                    <div
                      data-demo="load-bar"
                      className={ratio > 0.9 ? 'dash-fill hot' : 'dash-fill'}
                      style={{ width: `${clamp01(ratio) * 100 * p}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="dash-panel dash-top"
          data-demo="top"
          data-highlight={hl(highlight === 'top')}
        >
          <h2 className="dash-panel-title">
            <Trophy size={16} /> Топ работ месяца
          </h2>
          <ul className="dash-rows">
            {topWorks.map((w, i) => (
              <li key={w.name + i} className="dash-row">
                <div className="dash-row-head">
                  <span className="dash-row-name">{w.name}</span>
                  <span className="dash-row-num mono">
                    {num(w.count)} шт · {money(w.revenue)}
                  </span>
                </div>
                <div className="dash-track" aria-hidden>
                  <div
                    data-demo="top-bar"
                    className="dash-fill accent"
                    style={{ width: `${(w.revenue / topMax) * 100 * p}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
