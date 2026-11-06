import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BrandBand } from '../kit/BrandMark';
import type { ShowcaseProps } from '../schema';
import { SCENES_SOCIAL } from '../timing';
import { ShowcaseAssembly } from './Hero';
import { brandBandRegion } from './social';

/** The frame's top band: the wordmark over every scene; it leaves with the wipe that brings in the
 *  outro (its own big mark). */
function SocialChrome({ name }: { name: string }) {
  const frame = useCurrentFrame();
  const region = brandBandRegion(frame, SCENES_SOCIAL);
  if (!region) return null;
  return (
    <AbsoluteFill
      style={{ pointerEvents: 'none', clipPath: `polygon(${region.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(', ')})` }}
    >
      <BrandBand name={name} />
    </AbsoluteFill>
  );
}

/**
 * The 4:5 cut (1080×1350, ≤ 40 s): the hero's assembly over SCENES_SOCIAL — no intro/docs, a shorter
 * dashboard and outro. Each scene frames one zone at a time between the brand band (top 120 px) and
 * the chapter band (bottom 260 px, kit/ChapterTitle's social form) — `CAM.social` in the scenes.
 */
export const HeroSocial = (props: ShowcaseProps) => (
  <ShowcaseAssembly scenes={SCENES_SOCIAL} props={props} overlay={<SocialChrome name={props.brand.name} />} />
);
