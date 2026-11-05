import { planCatalog } from './generators/catalog';
import { planClients, planStaff } from './generators/people';
import { planBlocks } from './generators/schedule';
import { planVehicles } from './generators/vehicles';
import { planSettings, planWorkOrders } from './generators/work-orders';
import { makeFaker } from './rng';
import type { BlockPlan, CatalogPlan, ClientPlan, StaffPlan, VehiclePlan, WorkOrderPlan } from './types';

export type { WorkOrderPlan } from './types';

export interface DemoPlan {
  demoNow: Date;
  staff: StaffPlan[];
  settings: Record<string, string>;
  catalog: CatalogPlan;
  clients: ClientPlan[];
  vehicles: VehiclePlan[];
  blocks: BlockPlan[];
  workOrders: WorkOrderPlan[];
}

/** The whole demo data set, no DB. Each generator has its own rng stream, so editing one does not shift the others. */
export function buildDemoPlan(demoNow: Date): DemoPlan {
  const staff = planStaff();
  const catalog = planCatalog();
  const clients = planClients(makeFaker('clients', demoNow), demoNow);
  const vehicles = planVehicles(makeFaker('vehicles', demoNow), clients, demoNow);
  const blocks = planBlocks(staff, demoNow);
  const workOrders = planWorkOrders(makeFaker('work-orders', demoNow), { demoNow, catalog, clients, vehicles, staff, blocks });
  return { demoNow, staff, settings: planSettings(demoNow), catalog, clients, vehicles, blocks, workOrders };
}
