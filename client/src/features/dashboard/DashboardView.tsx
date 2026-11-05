import { TrendingUp, TrendingDown, Gauge, Wrench } from 'lucide-react';
import { money, num } from '../../lib/format';
import type { DashboardData } from './types';
import './dashboard.css';

export interface DashboardViewProps {
  data: DashboardData;
  /** Доля «вырастания» столбцов и полос, 0..1. */
  progress?: number;
  /** Demo: marks the block with data-highlight. */
  highlight?: 'revenue' | 'load' | 'top';
}

const W = 640;
const H = 320;
const PAD = { l: 8, r: 8, t: 28, b: 30 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hl = (on: boolean) => (on ? '' : undefined);

function compact(n: number): string {
  if (n >= 1_000_000) return `${num(Math.round(n / 100_000) / 10)} млн`;
  return `${num(Math.round(n / 1000))} тыс`;
}

export function DashboardView({ data, progress = 1, highlight }: DashboardViewProps) {
  const p = clamp01(progress);
  const { kpi, revenueByMonth: rev, masterLoad, topWorks } = data;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const max = Math.max(...rev.map((r) => r.revenue), 1) * 1.06;
  const slot = plotW / Math.max(rev.length, 1);
  const barW = slot * 0.58;
  const up = kpi.revenueDeltaPct >= 0;
  const topMax = Math.max(...topWorks.map((w) => w.revenue), 1);

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
            {num(Math.abs(kpi.revenueDeltaPct))}% к прошлому месяцу
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
            <Gauge size={16} /> Выручка по месяцам
          </h2>
          <svg
            className="dash-chart"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Выручка по месяцам"
          >
            {[0.5, 1].map((t) => {
              const y = PAD.t + plotH * (1 - t);
              return <line key={t} className="dash-grid-line" x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} />;
            })}
            <line
              className="dash-axis"
              x1={PAD.l}
              x2={W - PAD.r}
              y1={PAD.t + plotH}
              y2={PAD.t + plotH}
            />
            {rev.map((r, i) => {
              const full = (r.revenue / max) * plotH;
              const h = full * p;
              const x = PAD.l + slot * i + (slot - barW) / 2;
              const y = PAD.t + plotH - h;
              const last = i === rev.length - 1;
              return (
                <g key={r.month}>
                  <rect
                    data-demo="rev-bar"
                    className={last ? 'dash-bar current' : 'dash-bar'}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={3}
                  />
                  <text
                    className={`dash-val mono${last ? ' current' : ''}`}
                    x={x + barW / 2}
                    y={y - 7}
                    textAnchor="middle"
                    opacity={p}
                  >
                    {compact(r.revenue)}
                  </text>
                  <text
                    className="dash-tick"
                    x={x + barW / 2}
                    y={H - 9}
                    textAnchor="middle"
                  >
                    {r.month}
                  </text>
                </g>
              );
            })}
          </svg>
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
            {masterLoad.map((m) => {
              const ratio = m.capacityHours > 0 ? m.hours / m.capacityHours : 0;
              return (
                <li key={m.name} className="dash-row">
                  <div className="dash-row-head">
                    <span className="dash-row-name">{m.name}</span>
                    <span className="dash-row-num mono">
                      {num(m.hours)} / {num(m.capacityHours)} ч · {Math.round(ratio * 100)}%
                    </span>
                  </div>
                  <svg className="dash-track" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
                    <rect className="dash-track-bg" x="0" y="0" width="100" height="8" rx="4" />
                    <rect
                      data-demo="load-bar"
                      className={ratio > 0.9 ? 'dash-fill hot' : 'dash-fill'}
                      x="0"
                      y="0"
                      width={clamp01(ratio) * 100 * p}
                      height="8"
                      rx="4"
                    />
                  </svg>
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
          <h2 className="dash-panel-title">Топ работ месяца</h2>
          <ul className="dash-rows">
            {topWorks.map((w) => (
              <li key={w.name} className="dash-row">
                <div className="dash-row-head">
                  <span className="dash-row-name">{w.name}</span>
                  <span className="dash-row-num mono">
                    {num(w.count)} шт · {money(w.revenue)}
                  </span>
                </div>
                <svg className="dash-track" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
                  <rect className="dash-track-bg" x="0" y="0" width="100" height="8" rx="4" />
                  <rect
                    data-demo="top-bar"
                    className="dash-fill accent"
                    x="0"
                    y="0"
                    width={(w.revenue / topMax) * 100 * p}
                    height="8"
                    rx="4"
                  />
                </svg>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
