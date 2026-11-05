import { isUUID } from 'class-validator';
import { demoId } from './ids';

// The IsUUID('4') shape: version nibble 4, variant 8–b.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

it('is a stable RFC 4122 version-4-shaped uuid (passes IsUUID(\'4\'))', () => {
  expect(demoId('client', 1)).toMatch(UUID_V4);
  expect(demoId('part', 'oil-5w30-1l')[14]).toBe('4');
  expect(isUUID(demoId('part', 'oil-5w30-1l'), '4')).toBe(true);
  expect(demoId('client', 1)).toBe(demoId('client', 1));
});
it('differs by scope and key', () => {
  expect(new Set([demoId('client', 1), demoId('client', 2), demoId('vehicle', 1), demoId('client', '1x')]).size).toBe(4);
});
