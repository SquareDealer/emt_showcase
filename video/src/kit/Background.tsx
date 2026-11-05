import { AbsoluteFill } from 'remotion';

/** Frame backdrop behind the CRM window (same gradients the scaffold used inline). */
export function Background({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <AbsoluteFill
      style={{
        background:
          theme === 'dark'
            ? 'radial-gradient(120% 90% at 50% 0%, oklch(0.32 0.03 240), oklch(0.14 0.01 240))'
            : 'radial-gradient(120% 90% at 50% 0%, oklch(0.93 0.02 235), oklch(0.78 0.03 240))',
      }}
    />
  );
}
