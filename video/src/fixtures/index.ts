// Fixtures exported from the demo API by `npm run fixtures` (scripts/export-fixtures.ts). Do not edit
// the JSON by hand: re-run the export. «Сейчас» of the whole video is DEMO_NOW, never the real clock.
import type {
  AppSettings,
  CalendarBlock,
  Client,
  PriceListRow,
  SearchHit,
  TaskTemplate,
  TemplatePreview,
  User,
  Vehicle,
  VehicleGeneration,
  WorkOrder,
  WorkOrderStatus,
} from '../../../client/src/lib/types';
import type { DashboardData } from '../../../client/src/features/dashboard/types';

import metaJson from './meta.json';
import settingsJson from './settings.json';
import usersJson from './users.json';
import generationsJson from './generations.json';
import templatesJson from './templates.json';
import calendarWeekJson from './calendar.week.json';
import blocksWeekJson from './blocks.week.json';
import boardOwnerJson from './board.owner.json';
import boardMasterJson from './board.master.json';
import priceBaseJson from './price-list.base.json';
import priceR56Json from './price-list.R56.json';
import priceF56Json from './price-list.F56.json';
import priceF60Json from './price-list.F60.json';
import clientHeroJson from './client-hero.json';
import wo0 from './wo-hero.0.json';
import wo1 from './wo-hero.1.json';
import wo2 from './wo-hero.2.json';
import wo3 from './wo-hero.3.json';
import wo4 from './wo-hero.4.json';
import templatePreviewJson from './template-preview.json';
import dashboardJson from './dashboard.json';
// One file per prefix of HERO.r56.vin (WMWSV32050TZ56421), length 1..7 — what TypeText shows.
import s1 from './search/W.json';
import s2 from './search/WM.json';
import s3 from './search/WMW.json';
import s4 from './search/WMWS.json';
import s5 from './search/WMWSV.json';
import s6 from './search/WMWSV3.json';
import s7 from './search/WMWSV32.json';

const as = <T>(x: unknown) => x as T;

export type Board = Record<WorkOrderStatus, WorkOrder[]>;

export interface Meta {
  demoNow: string;
  seed: number;
  upstreamSha: string;
  exportedAt: string;
}

export const meta = as<Meta>(metaJson);
/** The video's «now»: settings.demo_now at 12:00 MSK. */
export const DEMO_NOW = new Date(meta.demoNow);

export const settings = as<AppSettings>(settingsJson);
export const users = as<User[]>(usersJson);
export const generations = as<VehicleGeneration[]>(generationsJson);
export const templates = as<TaskTemplate[]>(templatesJson);

/** Work orders and reserves of DEMO_NOW's week (Mon–Sun, MSK), owner's view. */
export const calendarWeek = as<WorkOrder[]>(calendarWeekJson);
export const blocksWeek = as<CalendarBlock[]>(blocksWeekJson);

/** /work-orders/board as owner and as master1; `closed` keeps the 6 latest by closed_at. */
export const boardOwner = as<Board>(boardOwnerJson);
export const boardMaster = as<Board>(boardMasterJson);

export const priceList = {
  base: as<PriceListRow[]>(priceBaseJson),
  R56: as<PriceListRow[]>(priceR56Json),
  F56: as<PriceListRow[]>(priceF56Json),
  F60: as<PriceListRow[]>(priceF60Json),
};

export const clientHero = as<{ client: Client; vehicles: Vehicle[]; orders: WorkOrder[] }>(clientHeroJson);

/**
 * The hero order on a copy of HERO.diagnosticsOrderId, after each real API mutation:
 * 0 booked into the free slot · 1 timing-chain template without oil · 2 chain kit −10% ·
 * 3 order −5% · 4 in progress. Ids are `hero-copy` / `hero-line-<n>` / `hero-group-<n>`.
 */
export const woHero = as<[WorkOrder, WorkOrder, WorkOrder, WorkOrder, WorkOrder]>([wo0, wo1, wo2, wo3, wo4]);
export const templatePreview = as<TemplatePreview>(templatePreviewJson);

export const dashboard = as<DashboardData>(dashboardJson);

export const searchByPrefix: Record<string, SearchHit[]> = {
  W: as<SearchHit[]>(s1),
  WM: as<SearchHit[]>(s2),
  WMW: as<SearchHit[]>(s3),
  WMWS: as<SearchHit[]>(s4),
  WMWSV: as<SearchHit[]>(s5),
  WMWSV3: as<SearchHit[]>(s6),
  WMWSV32: as<SearchHit[]>(s7),
};
