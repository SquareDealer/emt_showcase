import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BrandBand } from '../kit/BrandMark';
import type { ShowcaseProps } from '../schema';
import { SCENES_SOCIAL } from '../timing';
import { ShowcaseAssembly } from './Hero';
import { brandBandOpacity } from './social';

/** The frame's top band: the wordmark over every scene, fading out as the outro (its own big mark) enters. */
function SocialChrome({ name }: { name: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <BrandBand name={name} opacity={brandBandOpacity(frame, SCENES_SOCIAL)} />
    </AbsoluteFill>
  );
}

/**
 * The 4:5 cut (1080×1350, ≤ 30 s): the hero's assembly over SCENES_SOCIAL — no intro/docs, shorter
 * booking and dashboard. Each scene frames one zone at a time between the brand band (top 120 px) and
 * the caption plaque (bottom 260 px, Callout's social form) — `CAM.social` in the scenes.
 */
export const HeroSocial = (props: ShowcaseProps) => (
  <ShowcaseAssembly scenes={SCENES_SOCIAL} props={props} overlay={<SocialChrome name={props.brand.name} />} />
);
