import { useVideoConfig } from 'remotion';
import type { Layout } from './math';

/** `social` (1080×1350, portrait) vs `wide` (hero, loops, …). */
export function useLayout(): Layout {
  const { width, height } = useVideoConfig();
  return width < height ? 'social' : 'wide';
}
