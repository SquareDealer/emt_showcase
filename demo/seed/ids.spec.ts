import { demoId } from './ids';

it('is a stable RFC-4122-shaped uuid', () => {
  expect(demoId('client', 1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(demoId('client', 1)).toBe(demoId('client', 1));
});
it('differs by scope and key', () => {
  expect(new Set([demoId('client', 1), demoId('client', 2), demoId('vehicle', 1), demoId('client', '1x')]).size).toBe(4);
});
