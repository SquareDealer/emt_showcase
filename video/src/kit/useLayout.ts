import { useVideoConfig } from 'remotion';

/** `social` (1080×1350, portrait) vs `wide` (hero, loops, …). */
export function useLayout(): 'wide' | 'social' {
  const { width, height } = useVideoConfig();
  return width < height ? 'social' : 'wide';
}
