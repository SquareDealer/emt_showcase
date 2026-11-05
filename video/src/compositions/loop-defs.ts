// The feature loops: ids, lengths, cross-fade overlaps. No imports — Root and scripts/loop-diff.ts
// (run by tsx, outside the bundler) both read it.
export const LOOP_W = 1600;
export const LOOP_H = 1000;

export const LOOP_DEFS = [
  { id: 'LoopBooking', dur: 180, overlap: 10, file: 'booking' },
  { id: 'LoopEstimate', dur: 240, overlap: 10, file: 'estimate' },
  { id: 'LoopDiscounts', dur: 180, overlap: 10, file: 'discounts' },
  { id: 'LoopPriceList', dur: 180, overlap: 10, file: 'price-list' },
  { id: 'LoopBoard', dur: 180, overlap: 10, file: 'board' },
  // The prerendered phone clip's last frame already equals its first: no cross-fade.
  { id: 'LoopMasterMobile', dur: 180, overlap: 0, file: 'master-mobile' },
] as const;

export type LoopId = (typeof LOOP_DEFS)[number]['id'];
