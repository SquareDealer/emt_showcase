import { z } from 'zod';
import { zColor } from '@remotion/zod-types';
import { ACCENT } from './kit/tokens';

export const showcaseSchema = z.object({
  brand: z.object({ name: z.string() }),
  theme: z.enum(['light', 'dark']),
  accent: zColor(),
  callouts: z.object({
    intro: z.string(),
    booking: z.string(),
    generation: z.string(),
    block: z.string(),
    discounts: z.string(),
    board: z.string(),
    docs: z.string(),
    vin: z.string(),
    dashboard: z.string(),
  }),
  /** Delta label under the dashboard revenue figure (passed to DashboardView by the dashboard scene). */
  dashboardDeltaLabel: z.string(),
  outro: z.object({ title: z.string(), subtitle: z.string(), cta: z.string() }),
  musicOffsetFrames: z.number().int(),
});

export type ShowcaseProps = z.infer<typeof showcaseSchema>;

export const defaultProps: ShowcaseProps = {
  brand: { name: 'Гараж CRM' },
  theme: 'light',
  accent: ACCENT,
  callouts: {
    intro: 'Сервис по MINI: запись, смета, документы — в одном месте',
    booking: 'Свободное окно → запись в 2 клика',
    generation: 'Цена — под поколение',
    block: 'Работа и её запчасти — одним блоком',
    discounts: '10% + 5% = 14,5%, до копейки',
    board: 'Статус — одним движением',
    docs: 'Заказ-наряд в PDF — из тех же данных',
    vin: 'Любая машина по VIN — за секунду',
    dashboard: 'Владелец видит выручку и загрузку',
  },
  dashboardDeltaLabel: 'к прошлому месяцу',
  outro: { title: 'NestJS · React · PostgreSQL', subtitle: '', cta: '' },
  musicOffsetFrames: 0,
};
