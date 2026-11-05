// Stand-in for client/src/lib/api.ts, swapped in by NormalModuleReplacementPlugin
// (remotion.config.ts). Scenes never talk to the API: everything on screen comes from
// src/fixtures. If a scene pulls lib/api in transitively, the bundle still builds, but any
// call throws loudly — that import is a bug to fix, not to paper over.
const MARKER = '__VIDEO_MOCK_API__';

function fail(name: string): never {
  throw new Error(`${MARKER}: lib/api.${name}() called in the video — scenes must use fixtures`);
}

export function getToken(): string | null {
  return null;
}

export function setToken(_t: string | null): void {
  fail('setToken');
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api: Record<string, (...args: unknown[]) => never> = new Proxy(
  {},
  { get: (_target, name) => () => fail(String(name)) },
);
