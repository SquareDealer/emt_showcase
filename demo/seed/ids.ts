import { createHash } from 'crypto';
import { DEMO_SEED } from './config';

/**
 * Name-based, stable and independent of rng call order — but in RFC 4122 *version 4* shape (version
 * nibble 4, variant 8–b): the API validates some ids with IsUUID('4') (apply-template's
 * part_template_ids), and a v5-shaped id is rejected there with 400.
 */
export function demoId(scope: string, key: string | number): string {
  const h = createHash('sha256').update(`${DEMO_SEED}:${scope}:${key}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
