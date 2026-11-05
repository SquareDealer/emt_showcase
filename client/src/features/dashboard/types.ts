export interface DashboardData {
  /** Отчётный месяц KPI, загрузки и топа: 'октябрь 2026' — последний полный месяц. */
  month: string;
  /** Выручка и наряды за `month`; revenueDeltaPct — к предыдущему полному месяцу. */
  kpi: { revenue: number; orders: number; avgTicket: number; revenueDeltaPct: number };
  /** 6 точек, по возрастанию даты. */
  revenueByMonth: { month: string; revenue: number }[];
  /**
   * Последняя точка `revenueByMonth` — текущий, неполный месяц (по сегодняшний день): view рисует
   * её столбец бледным с пунктиром, метку со «*» и сноску; отчётный месяц — предпоследняя точка.
   * Без флага отчётный месяц — последняя точка.
   */
  partialLast?: boolean;
  masterLoad: { name: string; hours: number; capacityHours: number }[];
  /** 5 строк; view сортирует копию по выручке по убыванию */
  topWorks: { name: string; count: number; revenue: number }[];
}
