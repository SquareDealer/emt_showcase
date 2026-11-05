import { PriceResolutionService } from '../../../src/task-templates/price-resolution.service';
import { demoId } from '../ids';
import type { CatalogPlan, FreeLabor, LaborLinePlan, PartLinePlan, WorkPick } from '../types';
import { overrideFor, resolveTemplatePartsPlan, taskByKey } from './catalog';

export interface OrderLinesInput {
  woId: string;
  works: WorkPick[];
  free?: FreeLabor[];
  generation: string | null;
  catalog: CatalogPlan;
  rate: number;
  createdAt: Date;
  resolution: PriceResolutionService;
}

/**
 * Mirror of WorkOrderLinesService.applyTemplate: every work becomes one block (the labor
 * line plus its default parts) priced for the car's generation. Free labor stays outside
 * blocks. Every numeric field is set explicitly (numericTransformer writes undefined as NULL).
 */
export function buildOrderLines(input: OrderLinesInput): { labor: LaborLinePlan[]; parts: PartLinePlan[] } {
  const { woId, works, free = [], generation, catalog, rate, createdAt, resolution } = input;
  const labor: LaborLinePlan[] = [];
  const parts: PartLinePlan[] = [];
  const stamp = (n: number) => new Date(createdAt.getTime() + n * 1000);

  works.forEach((work, idx) => {
    const i = idx + 1;
    const task = taskByKey(catalog, work.taskKey);
    const groupKey = demoId('group', `${woId}:${i}`);
    const r = resolution.resolve(task, overrideFor(catalog, work.taskKey, generation), rate);
    const ln = labor.length + 1;
    labor.push({
      id: demoId('labor', `${woId}:${ln}`),
      template_id: task.id,
      name: task.name,
      hours: r.hours,
      rate_snapshot: r.rate_snapshot,
      price_override: r.price_override,
      discount_type: work.laborDiscountPct ? 'percent' : null,
      discount_value: work.laborDiscountPct ?? null,
      group_key: groupKey,
      group_name: task.name,
      group_sort: i,
      sort: labor.length,
      created_at: stamp(ln),
    });
    for (const c of resolveTemplatePartsPlan(catalog, work.taskKey, generation)) {
      if (!c.is_default) continue;
      const pn = parts.length + 1;
      parts.push({
        id: demoId('part-line', `${woId}:${pn}`),
        part_template_id: c.part.id,
        name: c.part.name,
        manufacturer: c.part.manufacturer,
        catalog_number: c.part.catalog_number,
        qty: c.qty,
        unit: c.part.unit,
        unit_price: c.part.default_price ?? 0,
        discount_type: null,
        discount_value: null,
        group_key: groupKey,
        group_name: task.name,
        group_sort: i,
        sort: parts.length,
        created_at: stamp(pn),
      });
    }
  });

  for (const f of free) {
    const ln = labor.length + 1;
    labor.push({
      id: demoId('labor', `${woId}:${ln}`),
      template_id: null,
      name: f.name,
      hours: f.hours,
      rate_snapshot: rate,
      price_override: null,
      discount_type: null,
      discount_value: null,
      group_key: null,
      group_name: null,
      group_sort: 0,
      sort: labor.length,
      created_at: stamp(ln),
    });
  }
  return { labor, parts };
}
