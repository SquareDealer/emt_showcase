import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

// test-utils -> seed -> demo -> repo root; root tsconfig has baseUrl "./", so 'src/...' is a valid bare import.
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function resolveRelative(from: string, spec: string): string {
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, resolve(base, 'index.ts')]) {
    if (c.endsWith('.ts') && existsSync(c)) return c;
  }
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

/** Absolute paths of reached .ts files plus bare specifiers of every static import/require. */
export function importClosure(entry: string): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    out.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1];
      if (spec.startsWith('.')) walk(resolveRelative(file, spec));
      else {
        out.add(spec);
        if (/^src[\\/]/.test(spec)) {
          try {
            walk(resolveRelative(resolve(REPO_ROOT, 'x'), `./${spec}`));
          } catch {
            // unresolved baseUrl import: the bare specifier is already recorded
          }
        }
      }
    }
  };
  walk(entry);
  return [...out];
}
