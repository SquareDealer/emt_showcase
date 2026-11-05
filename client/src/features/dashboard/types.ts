export interface DashboardData {
  /** 'ноябрь 2026' */
  month: string;
  kpi: { revenue: number; orders: number; avgTicket: number; revenueDeltaPct: number };
  /** 6 точек, по возрастанию даты */
  revenueByMonth: { month: string; revenue: number }[];
  masterLoad: { name: string; hours: number; capacityHours: number }[];
  /** 5 строк */
  topWorks: { name: string; count: number; revenue: number }[];
}
