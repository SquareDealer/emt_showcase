// Plan → insert rows. Every NOT NULL numeric is set explicitly: numericTransformer writes
// undefined as NULL, so a column DEFAULT would never apply (see CLAUDE.md).
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { LaborLine } from '../../src/entities/labor-line.entity';
import type { PartLine } from '../../src/entities/part-line.entity';
import type { WorkOrder } from '../../src/entities/work-order.entity';
import type { LaborLinePlan, PartLinePlan, WorkOrderPlan } from './types';

/** An insert row for `m.insert(Entity, rows)`; the index signature lets callers scan it with Object.values. */
export type InsertRow<T> = QueryDeepPartialEntity<T> & Record<string, unknown>;

/** Plan-only fields (labor, parts, client_id, odometer_km) are dropped; numbers go in as they are. */
export function toWorkOrderRow(p: WorkOrderPlan, docNumber: number | null): InsertRow<WorkOrder> {
  return {
    id: p.id,
    vehicle_id: p.vehicle_id,
    assigned_master_id: p.assigned_master_id,
    status: p.status,
    title: p.title,
    notes: p.notes,
    complaint: p.complaint,
    recommendation: p.recommendation,
    scheduled_at: p.scheduled_at,
    scheduled_duration_min: p.scheduled_duration_min,
    discount_type: p.discount_type,
    discount_value: p.discount_value,
    total_cached: p.total_cached,
    total_frozen: p.total_frozen,
    paid_amount: p.paid_amount,
    created_at: p.created_at,
    updated_at: p.updated_at,
    closed_at: p.closed_at,
    doc_number: docNumber,
    order_doc_number: null,
  };
}

export function toLaborRow(p: LaborLinePlan, woId: string): InsertRow<LaborLine> {
  return {
    id: p.id,
    work_order_id: woId,
    template_id: p.template_id,
    name: p.name,
    hours: p.hours,
    rate_snapshot: p.rate_snapshot,
    price_override: p.price_override,
    discount_type: p.discount_type,
    discount_value: p.discount_value,
    group_key: p.group_key,
    group_name: p.group_name,
    group_sort: p.group_sort,
    sort: p.sort,
    created_at: p.created_at,
  };
}

export function toPartRow(p: PartLinePlan, woId: string): InsertRow<PartLine> {
  return {
    id: p.id,
    work_order_id: woId,
    part_template_id: p.part_template_id,
    name: p.name,
    manufacturer: p.manufacturer,
    catalog_number: p.catalog_number,
    qty: p.qty,
    unit: p.unit,
    unit_price: p.unit_price,
    discount_type: p.discount_type,
    discount_value: p.discount_value,
    group_key: p.group_key,
    group_name: p.group_name,
    group_sort: p.group_sort,
    sort: p.sort,
    created_at: p.created_at,
  };
}

/**
 * doc_number the way the app hands it out: one nextval per close, in close order. Ties on
 * closed_at are broken by id (plain code-unit compare, no locale), so the result is stable.
 */
export function assignDocNumbers(closed: { id: string; closed_at: Date }[], numbers: number[]): Map<string, number> {
  if (closed.length !== numbers.length) {
    throw new Error(`assignDocNumbers: ${closed.length} closed orders, ${numbers.length} numbers`);
  }
  const order = [...closed].sort(
    (a, b) => a.closed_at.getTime() - b.closed_at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const nums = [...numbers].sort((a, b) => a - b);
  return new Map(order.map((w, i) => [w.id, nums[i]]));
}
