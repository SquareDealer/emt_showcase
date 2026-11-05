/** RGBA pixels (pngjs's PNG has this shape). */
export type Rgba = { width: number; height: number; data: Uint8Array | Buffer };

/**
 * Share of pixels that differ between two same-sized RGBA images: a pixel counts when any of its
 * channels moves by more than `tolerance` (default 16 — h264/antialiasing noise stays under it).
 */
export function pixelDiff(a: Rgba, b: Rgba, tolerance = 16): { differing: number; total: number; share: number } {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`pixelDiff: size ${a.width}×${a.height} ≠ ${b.width}×${b.height}`);
  }
  const total = a.width * a.height;
  let differing = 0;
  for (let i = 0; i < total * 4; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) > tolerance ||
      Math.abs(a.data[i + 1] - b.data[i + 1]) > tolerance ||
      Math.abs(a.data[i + 2] - b.data[i + 2]) > tolerance ||
      Math.abs(a.data[i + 3] - b.data[i + 3]) > tolerance
    ) {
      differing++;
    }
  }
  return { differing, total, share: total ? differing / total : 0 };
}
