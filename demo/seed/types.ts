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
