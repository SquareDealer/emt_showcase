import { z } from 'zod';
import { zColor } from '@remotion/zod-types';
import { ACCENT } from './kit/tokens';

const chapter = z.object({ title: z.string(), line: z.string() });

export const showcaseSchema = z.object({
  brand: z.object({ name: z.string() }),
  theme: z.enum(['light', 'dark']),
  accent: zColor(),
  /** The intro's line under the mark. */
  tagline: z.string(),
  /** Chapter titles (kit/ChapterTitle): the claim and one factual line under it, per chapter. */
  chapters: z.object({
    booking: chapter,
    generation: chapter,
    block: chapter,
    board: chapter,
    docs: chapter,
    vin: chapter,
    dashboard: chapter,
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
  tagline: 'Сервис по MINI: запись, смета, документы — в одном месте',
  chapters: {
    booking: { title: 'Свободное окно → запись в 2 клика', line: 'Клик по пустому слоту — и заказ-наряд уже на это время' },
    generation: { title: 'Цена — под поколение', line: 'У R56, F56 и F60 своя цена одной и той же работы' },
    block: { title: 'Работа и её запчасти — одним блоком', line: 'Позиция прайса разворачивается вместе с деталями' },
    board: { title: 'Статус — одним движением', line: 'Карточку перетащили — статус наряда сменился' },
    docs: { title: 'Заказ-наряд в PDF — из тех же данных', line: 'Заказ-наряд и калькуляция собираются из сметы' },
    vin: { title: 'Любая машина по VIN — за секунду', line: 'Поиск по VIN, госномеру, телефону и ФИО' },
    dashboard: { title: 'Владелец видит выручку и загрузку', line: 'Выручка по месяцам, загрузка мастеров, топ работ' },
  },
  dashboardDeltaLabel: 'к прошлому месяцу',
  outro: { title: 'NestJS · React · PostgreSQL', subtitle: '', cta: '' },
  musicOffsetFrames: 0,
};
