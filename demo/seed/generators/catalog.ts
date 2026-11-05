import { demoId } from '../ids';
import {
  GENERATION_FACTORS,
  LINK_SPECS,
  OVERRIDE_SPECS,
  PART_SPECS,
  TASK_SPECS,
} from '../data/catalog';
import type {
  CatalogPlan,
  LinkPlan,
  OverridePlan,
  PartCandidate,
  PartPlan,
  TaskPlan,
} from '../types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pure: same input tables, same plan. IDs are name-based, so rng order is irrelevant. */
export function planCatalog(): CatalogPlan {
  const tasks: TaskPlan[] = TASK_SPECS.map((t) => ({ ...t, id: demoId('task', t.key) }));
  const parts: PartPlan[] = PART_SPECS.map((p) => ({ ...p, id: demoId('part', p.key) }));
  const links: LinkPlan[] = LINK_SPECS.map((l) => ({
    ...l,
    id: demoId('ttp', `${l.task}:${l.part}:${l.generation ?? '*'}`),
  }));

  const explicit = new Set(OVERRIDE_SPECS.map((o) => `${o.task}:${o.generation}`));
  const derived = tasks
    .filter((t) => t.perGeneration && t.default_hours !== null)
    .flatMap((t) =>
      Object.entries(GENERATION_FACTORS)
        .filter(([g]) => !explicit.has(`${t.key}:${g}`))
        .map(([generation, factor]) => ({
          task: t.key,
          generation,
          hours: round1((t.default_hours as number) * factor),
          price: null,
        })),
    );
  const overrides: OverridePlan[] = [...OVERRIDE_SPECS, ...derived].map((o) => ({
    ...o,
    id: demoId('tgp', `${o.task}:${o.generation}`),
  }));

  return { tasks, parts, links, overrides };
}

export function taskByKey(c: CatalogPlan, key: string): TaskPlan {
  const t = c.tasks.find((x) => x.key === key);
  if (!t) throw new Error(`unknown task: ${key}`);
  return t;
}

export function partByKey(c: CatalogPlan, key: string): PartPlan {
  const p = c.parts.find((x) => x.key === key);
  if (!p) throw new Error(`unknown part: ${key}`);
  return p;
}

export function overrideFor(
  c: CatalogPlan,
  taskKey: string,
  generation: string | null,
): OverridePlan | null {
  if (!generation) return null;
  return c.overrides.find((o) => o.task === taskKey && o.generation === generation) ?? null;
}

/**
 * Mirror of WorkOrderLinesService.resolveTemplateParts: universal rows first, then rows
 * of the car's generation on top; a row's key is its trimmed lower-cased slot, or the part
 * itself when it has none. Map insertion order is kept (a replaced key keeps its position).
 */
export function resolveTemplatePartsPlan(
  c: CatalogPlan,
  taskKey: string,
  generation: string | null,
): PartCandidate[] {
  const rows = c.links.filter((l) => l.task === taskKey);
  const key = (l: LinkPlan) => l.slot?.trim().toLowerCase() || `part:${l.part}`;
  const by = new Map<string, { row: LinkPlan; specific: boolean }>();
  for (const l of rows.filter((r) => r.generation === null)) by.set(key(l), { row: l, specific: false });
  if (generation) {
    for (const l of rows.filter((r) => r.generation === generation)) by.set(key(l), { row: l, specific: true });
  }
  return [...by.values()].map(({ row, specific }) => ({
    part: partByKey(c, row.part),
    qty: row.qty ?? 1,
    is_default: row.is_default,
    generation_specific: specific,
  }));
}
