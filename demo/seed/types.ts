export type TaskCategory =
  | 'maintenance'
  | 'oil'
  | 'brakes'
  | 'diagnostics'
  | 'tires'
  | 'suspension'
  | 'timing'
  | 'clutch'
  | 'cooling'
  | 'electrical'
  | 'other';

export interface TaskSpec {
  key: string;
  name: string;
  category: TaskCategory;
  default_hours: number | null;
  default_price: number | null;
  /** Relative frequency of the work in generated orders. */
  weight: number;
  /** Gets a price-override row for each generation in GENERATION_FACTORS. */
  perGeneration?: boolean;
  /** Works of one group are alternatives (ТО already changes the oil, discs come with pads): an order holds at most one. */
  exclusive?: string;
}

export interface PartSpec {
  key: string;
  name: string;
  manufacturer: string;
  catalog_number: string;
  unit: 'pcs' | 'l';
  default_price: number;
}

export interface LinkSpec {
  task: string;
  part: string;
  /** Generation code; null = every generation. */
  generation: string | null;
  qty: number | null;
  is_default: boolean;
  slot: string | null;
}

export interface OverrideSpec {
  task: string;
  generation: string;
  hours: number | null;
  price: number | null;
}

export type TaskPlan = TaskSpec & { id: string };
export type PartPlan = PartSpec & { id: string };
export type LinkPlan = LinkSpec & { id: string };
export type OverridePlan = OverrideSpec & { id: string };

export interface CatalogPlan {
  tasks: TaskPlan[];
  parts: PartPlan[];
  links: LinkPlan[];
  overrides: OverridePlan[];
}

export interface PartCandidate {
  part: PartPlan;
  qty: number;
  is_default: boolean;
  generation_specific: boolean;
}

export interface GenerationSpec {
  code: string;
  model: string;
  years: string;
}

export type UserRole = 'owner' | 'master_receptionist' | 'master';
export type ClientSource = 'manual' | 'telegram_bot' | 'csv_import';

export interface StaffPlan {
  id: string;
  name: string;
  login: string;
  role: UserRole;
  loadWeight: number;
}

export interface ClientPlan {
  id: string;
  full_name: string;
  phone: string;
  kind: 'person' | 'company';
  tier: 'regular' | 'occasional';
  source: ClientSource;
  discount_default_pct: number | null;
  imported_deals_count: number;
  imported_deals_sum: number;
  notes: string | null;
  created_at: Date;
  vehicleCount: number;
}

export interface VehiclePlan {
  id: string;
  client_id: string;
  make: string;
  /** null: VehiclesService fills in the generation's model. */
  model: string | null;
  generationCode: string | null;
  vin: string;
  plate: string;
  year: number;
  baseKm: number;
  annualKm: number;
  mileage: number;
  created_at: Date;
}

export interface LaborLinePlan {
  id: string;
  template_id: string | null;
  name: string;
  hours: number | null;
  rate_snapshot: number;
  price_override: number | null;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number | null;
  group_key: string | null;
  group_name: string | null;
  group_sort: number;
  sort: number;
  created_at: Date;
}

export interface PartLinePlan {
  id: string;
  part_template_id: string | null;
  name: string;
  manufacturer: string | null;
  catalog_number: string | null;
  qty: number;
  unit: 'pcs' | 'l';
  unit_price: number;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number | null;
  group_key: string | null;
  group_name: string | null;
  group_sort: number;
  sort: number;
  created_at: Date;
}

export interface WorkPick {
  taskKey: string;
  laborDiscountPct?: number;
}

export interface FreeLabor {
  name: string;
  hours: number;
}

export interface BlockPlan {
  id: string;
  title: string | null;
  starts_at: Date;
  duration_min: number;
  /** null: shared reserve (the lift), visible to everyone. */
  user_id: string | null;
  notes: string | null;
  created_at: Date;
}

/** Mirrors work_order_status in src/entities/work-order.entity.ts (no "cancelled"). */
export type WorkOrderStatus = 'scheduled' | 'in_progress' | 'waiting' | 'done' | 'closed';

export interface WorkOrderPlan {
  id: string;
  vehicle_id: string;
  /** Not a column: the statistics need it. */
  client_id: string;
  assigned_master_id: string;
  status: WorkOrderStatus;
  title: string;
  notes: string | null;
  complaint: string | null;
  recommendation: string | null;
  scheduled_at: Date;
  scheduled_duration_min: number;
  discount_type: 'percent' | 'fixed' | null;
  discount_value: number | null;
  total_cached: number;
  total_frozen: number | null;
  paid_amount: number;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
  /** Not a column: written into notes as «Пробег при приёме: 123 450 км». */
  odometer_km: number;
  labor: LaborLinePlan[];
  parts: PartLinePlan[];
}
