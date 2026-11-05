import { createHash } from 'crypto';
import { DEMO_SEED } from './config';

/** Name-based UUID (v5 shape): stable and independent of rng call order. */
export function demoId(scope: string, key: string | number): string {
  const h = createHash('sha256').update(`${DEMO_SEED}:${scope}:${key}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
