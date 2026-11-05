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
